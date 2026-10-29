import { DurableObject } from 'cloudflare:workers';
import { accountRoute, authenticate, cleanupAccount, HttpError, json, readBody, registerDevice, type Env } from './index';
import { randomId } from './util';

const MAX_RECEIPT = 10 * 1024 * 1024 + 1024;
const MAX_TOTAL = 150 * 1024 * 1024;
const RETRY_MS = 60_000;
type Journal = { kind: 'put' | 'delete'; accountId: string; name: string; key: string; oldKey: string | null };
type Fence = { accountId: string; status: 'deleting' | 'deleted' };

/** One ordering boundary for every operation on an account, including sign-in device creation.
 * The queue orders awaits in a live instance; durable journals/fences recover its lost work.
 */
export class AccountCoordinator extends DurableObject<Env> {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  private ordered<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pending >= 32) return Promise.reject(new HttpError(503, { error: 'retry' }));
    this.pending++;
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result.finally(() => { this.pending--; });
  }

  private async respond(operation: () => Promise<Response>): Promise<Response> {
    try { return await this.ordered(operation); }
    catch (error) {
      if (error instanceof HttpError) return json(error.status, error.body);
      // Never log ciphertext, codes, credentials or email addresses with storage exceptions.
      console.error('Account operation failed; durable recovery will retry');
      return json(503, { error: 'retry' });
    }
  }

  async fetch(req: Request): Promise<Response> {
    return this.respond(async () => {
      await this.recover();
      if (await this.ctx.storage.get<Fence>('fence')) throw new HttpError(410, { error: 'deleted' });
      // Routing authentication outside this boundary is only a lookup. Recheck after queued work.
      const auth = await authenticate(req, this.env);
      if (auth.accountId !== req.headers.get('x-duit-account')) throw new HttpError(401, { error: 'auth' });
      await this.bindAccount(auth.accountId);
      return accountRoute(req, this.env, auth, this);
    });
  }

  async register(accountId: string, emailHash: string, deviceName: string): Promise<Response> {
    return this.respond(async () => {
      await this.recover();
      if (await this.ctx.storage.get<Fence>('fence')) throw new HttpError(410, { error: 'deleted' });
      await this.bindAccount(accountId);
      return registerDevice(this.env, accountId, emailHash, deviceName);
    });
  }

  private async bindAccount(accountId: string) {
    const bound = await this.ctx.storage.get<string>('account');
    if (bound && bound !== accountId) throw new HttpError(401, { error: 'auth' });
    if (!bound) await this.ctx.storage.put('account', accountId);
  }

  private async journal(value: Journal) {
    // Alarm first: a crash after journal persistence must always have a recovery wake-up.
    await this.ctx.storage.setAlarm(Date.now() + RETRY_MS);
    await this.ctx.storage.put('journal', value);
  }

  async putReceipt(req: Request, accountId: string, name: string): Promise<Response> {
    const data = await readBody(req, MAX_RECEIPT);
    if (data.length === 0) throw new HttpError(400);
    await this.writeReceipt(accountId, name, data);
    return new Response(null, { status: 204 });
  }

  async writeReceipt(accountId: string, name: string, data: Uint8Array): Promise<void> {
    if (data.length > MAX_RECEIPT) throw new HttpError(413);
    const total = await this.env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM receipts WHERE account_id = ? AND name <> ?')
      .bind(accountId, name).first<{ n: number }>();
    if ((total?.n ?? 0) + data.length > MAX_TOTAL) throw new HttpError(413, { error: 'quota' });
    const old = await this.env.DB.prepare('SELECT in_r2, object_key FROM receipts WHERE account_id = ? AND name = ?')
      .bind(accountId, name).first<{ in_r2: number; object_key: string | null }>();
    const key = `${accountId}/_versions/${randomId()}`;
    await this.journal({ kind: 'put', accountId, name, key, oldKey: old?.in_r2 ? old.object_key ?? `${accountId}/${name}` : null });
    // Immutable key: until the D1 batch commits, both metadata and existing bytes remain intact.
    await this.env.RECEIPTS.put(key, data);
    await this.env.DB.batch([
      this.env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id = ?').bind(accountId, `rcpt:${name}`),
      this.env.DB.prepare('INSERT OR REPLACE INTO receipts (account_id, name, size, updated_at, in_r2, object_key) VALUES (?, ?, ?, ?, 1, ?)')
        .bind(accountId, name, data.length, Date.now(), key),
    ]);
    await this.recoverJournal();
  }

  async removeReceipt(accountId: string, name: string): Promise<Response> {
    const old = await this.env.DB.prepare('SELECT object_key FROM receipts WHERE account_id = ? AND name = ?')
      .bind(accountId, name).first<{ object_key: string | null }>();
    await this.journal({ kind: 'delete', accountId, name, key: old?.object_key ?? `${accountId}/${name}`, oldKey: null });
    await this.recoverJournal();
    return new Response(null, { status: 204 });
  }

  private async recoverJournal(): Promise<void> {
    const journal = await this.ctx.storage.get<Journal>('journal');
    if (!journal) return;
    if (journal.kind === 'put') {
      const current = await this.env.DB.prepare('SELECT object_key FROM receipts WHERE account_id = ? AND name = ?')
        .bind(journal.accountId, journal.name).first<{ object_key: string | null }>();
      const discard = current?.object_key === journal.key ? journal.oldKey : journal.key;
      if (discard) await this.env.RECEIPTS.delete(discard);
    } else {
      await this.env.DB.batch([
        this.env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id = ?').bind(journal.accountId, `rcpt:${journal.name}`),
        this.env.DB.prepare('DELETE FROM receipts WHERE account_id = ? AND name = ?').bind(journal.accountId, journal.name),
      ]);
      await this.env.RECEIPTS.delete(journal.key);
    }
    await this.ctx.storage.delete('journal');
    await this.ctx.storage.deleteAlarm();
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + RETRY_MS);
    await this.ctx.storage.put('fence', { accountId, status: 'deleting' } satisfies Fence);
    await this.recover();
  }

  private async recover(): Promise<void> {
    const fence = await this.ctx.storage.get<Fence>('fence');
    if (fence?.status === 'deleted') return;
    try {
      if (fence) {
        await cleanupAccount(this.env, fence.accountId);
        await this.ctx.storage.put('fence', { ...fence, status: 'deleted' } satisfies Fence);
        await this.ctx.storage.delete('journal');
        await this.ctx.storage.deleteAlarm();
      } else await this.recoverJournal();
    } catch (error) {
      await this.ctx.storage.setAlarm(Date.now() + RETRY_MS);
      throw error;
    }
  }

  async alarm(): Promise<void> {
    await this.ordered(() => this.recover());
  }
}
