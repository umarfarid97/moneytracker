import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { migration } from './fakeD1';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

let script: string;
let mf: Miniflare;
let persist: string;
let db: D1Database;
let bucket: R2Bucket;
let mailedCode = '';
let onIo: (action: string) => Promise<void> = async () => {};
const token = 'local-test-token-00000000000000000000';
const quota = 150 * 1024 * 1024;
const account = 'a'.repeat(32);
const call = (method: string, path: string, body?: string | Uint8Array, headers: Record<string,string> = {}) =>
  mf.dispatchFetch('https://local.test' + path, { method, body, headers: { authorization: 'Bearer ' + token, ...headers } });

beforeAll(async () => {
  const result = await build({ entryPoints: ['test/runtime-worker.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] });
  script = result.outputFiles[0].text;
});
async function startRuntime() {
  mf = new Miniflare({ ...convertV4MiniflareOptions({ name: 'security-test', modules: true, script, durableObjects: { ACCOUNTS: { className: 'TestCoordinator', useSQLite: true } }, serviceBindings: { TEST_IO: async (req: Request) => { const url = new URL(req.url); if (url.pathname === '/mail') mailedCode = url.searchParams.get('code')!; await onIo(url.pathname); return new Response('ok'); } }, compatibilityDate: '2026-10-01', d1Databases: { DB: 'local-db' }, r2Buckets: { RECEIPTS: 'local-receipts' }, bindings: { PEPPER: 'local', ALLOWED_ORIGINS: 'https://app.test', MAIL_FROM: 'local@example.test' } }), resourcePersistencePath: persist });
  db = await mf.getD1Database('DB') as unknown as D1Database;
  bucket = await mf.getR2Bucket('RECEIPTS') as unknown as R2Bucket;
}
beforeEach(async () => {
  persist = mkdtempSync(join(tmpdir(), 'duit-worker-'));
  onIo = async () => {};
  await startRuntime();
  // D1 exec accepts one statement per line; comments are irrelevant to these dummy fixtures.
  for (const statement of migration().replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  await db.prepare('INSERT INTO accounts(id,email_hash,created_at) VALUES (?,?,0)').bind(account, 'local-email').run();
  await db.prepare('INSERT INTO devices(id,account_id,token_hash,name,created_at,last_seen) VALUES (?,?,?,?,0,?)').bind('d'.repeat(32), account, createHash('sha256').update(token).digest('hex'), 'local', Date.now()).run();
});
afterEach(async () => {
  await mf?.dispose();
  if (dirname(persist) !== tmpdir()) throw new Error('Unexpected test storage path');
  rmSync(persist, { recursive: true, force: true });
});
const state = async () => (await mf.dispatchFetch(`https://local.test/__test/${account}/__state`)).json() as Promise<{ journal?: unknown; fence?: { status: string }; alarm: number | null }>;
async function restart() { await mf.dispose(); await startRuntime(); }
const alarm = () => mf.dispatchFetch(`https://local.test/__test/${account}/__alarm`);

async function liveTicket(bearer = token) {
  const response = await call('POST', '/events/ticket', undefined, { authorization: 'Bearer ' + bearer });
  expect(response.status).toBe(200);
  return (await response.json() as { ticket: string }).ticket;
}
async function connectLive(ticket: string, origin?: string) {
  const response = await mf.dispatchFetch('https://local.test/events?ticket=' + encodeURIComponent(ticket), { headers: { upgrade: 'websocket', ...(origin ? { origin } : {}) } });
  expect(response.status).toBe(101);
  const ws = response.webSocket!;
  const messages: string[] = [];
  ws.addEventListener('message', event => messages.push(String(event.data)));
  ws.accept();
  await new Promise(resolve => setTimeout(resolve, 30));
  return { ws, messages };
}
async function secondDevice() {
  const bearer = 'second-local-device-token-000000000000';
  await db.prepare('INSERT INTO devices(id,account_id,token_hash,name,created_at,last_seen) VALUES (?,?,?,?,0,?)')
    .bind('e'.repeat(32), account, createHash('sha256').update(bearer).digest('hex'), 'second', Date.now()).run();
  return bearer;
}

describe('live account change hints', () => {
  it('accepts configured browser origins and the Worker origin sent by Android native WebSockets', async () => {
    const browser = await connectLive(await liveTicket(), 'https://app.test');
    browser.ws.close();
    const android = await connectLive(await liveTicket(), 'https://local.test');
    expect(android.messages).toEqual(['{"type":"ready"}']);
    android.ws.close();
  });
  it('rejects expired, replaced and account-tampered tickets; pending tickets survive object restart', async () => {
    const first = await liveTicket();
    const second = await liveTicket();
    const upgrade = (ticket: string) => mf.dispatchFetch('https://local.test/events?ticket=' + ticket, { headers: { upgrade: 'websocket' } });
    expect((await upgrade(first)).status).toBe(401);
    expect((await upgrade(second.replace(account, 'b'.repeat(32)))).status).toBe(401);
    const unauthorizedState = await (await mf.dispatchFetch(`https://local.test/__test/${'b'.repeat(32)}/__state`)).json() as { boundAccount?: string };
    expect(unauthorizedState.boundAccount).toBeUndefined();
    await mf.dispatchFetch(`https://local.test/__test/${account}/__expireLiveTickets`);
    expect((await upgrade(second)).status).toBe(401);
    const pending = await liveTicket();
    await restart();
    const live = await connectLive(pending);
    expect(live.messages).toEqual(['{"type":"ready"}']);
    live.ws.close();
  });

  it('does not echo changes to the originating device or another account', async () => {
    const own = await connectLive(await liveTicket());
    const otherToken = 'other-account-token-0000000000000000';
    const otherAccount = 'b'.repeat(32);
    await db.prepare('INSERT INTO accounts(id,email_hash,created_at) VALUES (?,?,0)').bind(otherAccount, 'other-email').run();
    await db.prepare('INSERT INTO devices(id,account_id,token_hash,name,created_at,last_seen) VALUES (?,?,?,?,0,?)')
      .bind('c'.repeat(32), otherAccount, createHash('sha256').update(otherToken).digest('hex'), 'other', Date.now()).run();
    const other = await connectLive(await liveTicket(otherToken));
    expect((await call('PUT', '/sync', 'encrypted', { 'if-match': '0', 'x-sync-schema': '17' })).status).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(own.messages).toEqual(['{"type":"ready"}']);
    expect(other.messages).toEqual(['{"type":"ready"}']);
    own.ws.close(); other.ws.close();
  });

  it('rejects excess device connections without evicting the existing connection', async () => {
    const live = [];
    for (let i = 0; i < 8; i++) live.push(await connectLive(await liveTicket()));
    const ticket = await liveTicket();
    expect((await mf.dispatchFetch('https://local.test/events?ticket=' + ticket, { headers: { upgrade: 'websocket' } })).status).toBe(429);
    live[0].ws.send('ping');
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(live[0].messages.at(-1)).toBe('pong');
    live.forEach(connection => connection.ws.close());
  });

  it('requires authentication and an allowed browser origin for tickets and upgrades', async () => {
    expect((await call('POST', '/events/ticket', undefined, { authorization: '' })).status).toBe(401);
    expect((await call('POST', '/events/ticket', undefined, { origin: 'https://evil.test' })).status).toBe(403);
    const ticket = await liveTicket();
    expect(ticket).not.toContain(token);
    expect((await mf.dispatchFetch('https://local.test/events?ticket=' + ticket, { headers: { upgrade: 'websocket', origin: 'https://evil.test' } })).status).toBe(403);
    const live = await connectLive(ticket);
    expect(live.messages).toEqual(['{"type":"ready"}']);
    expect((await mf.dispatchFetch('https://local.test/events?ticket=' + ticket, { headers: { upgrade: 'websocket' } })).status).toBe(401);
    live.ws.close();
  });

  it('notifies another device only after successful data commits, including receipts', async () => {
    const peer = await secondDevice();
    const live = await connectLive(await liveTicket(peer));
    expect((await call('PUT', '/sync', 'ciphertext', { 'if-match': '0', 'x-sync-schema': '17' })).status).toBe(200);
    expect((await call('PUT', '/receipts/a.enc', 'photo-ciphertext')).status).toBe(204);
    expect((await call('PUT', '/sync', 'conflict', { 'if-match': '0', 'x-sync-schema': '17' })).status).toBe(409);
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(live.messages).toEqual(['{"type":"ready"}', '{"type":"changed"}', '{"type":"changed"}']);
    live.ws.send('ping');
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(live.messages.at(-1)).toBe('pong');
    live.ws.close();
  });

  it('closes revoked devices and rejects tickets issued before revocation', async () => {
    const peer = await secondDevice();
    const live = await connectLive(await liveTicket(peer));
    const ticket = await liveTicket(peer);
    const closed = new Promise<number>(resolve => live.ws.addEventListener('close', event => resolve(event.code)));
    expect((await call('DELETE', '/devices/' + 'e'.repeat(32))).status).toBe(204);
    expect(await closed).toBe(4001);
    expect((await mf.dispatchFetch('https://local.test/events?ticket=' + ticket, { headers: { upgrade: 'websocket' } })).status).toBe(401);
  });

  it('closes live connections when account deletion begins', async () => {
    const live = await connectLive(await liveTicket());
    const closed = new Promise<number>(resolve => live.ws.addEventListener('close', event => resolve(event.code)));
    expect((await call('DELETE', '/account')).status).toBe(204);
    expect(await closed).toBe(4001);
  });
});

describe('local Cloudflare account ordering', () => {
  it('admits only one of two concurrent uploads that together exceed remaining quota', async () => {
    await db.prepare('INSERT INTO receipts(account_id,name,size,updated_at,in_r2) VALUES (?,?,?,0,1)').bind(account,'full.enc',quota-6).run();
    onIo = async action => { if (action === '/put') await new Promise(r => setTimeout(r, 100)); };
    const responses = await Promise.all([call('PUT','/receipts/a.enc',new Uint8Array(5)), call('PUT','/receipts/b.enc',new Uint8Array(5))]);
    expect(responses.map(r=>r.status).sort()).toEqual([204,413]);
    expect(await db.prepare('SELECT SUM(size) AS n FROM receipts').first()).toEqual({ n: quota-1 });
  });

  it('preserves the existing receipt when replacement metadata fails', async () => {
    expect((await call('PUT','/receipts/a.enc','original')).status).toBe(204);
    await db.prepare("CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'injected metadata failure'); END").run();
    expect((await call('PUT','/receipts/a.enc','replacement')).status).toBe(503);
    await db.prepare('DROP TRIGGER reject_receipt').run();
    const response = await call('GET','/receipts/a.enc');
    expect(await response.text()).toBe('original');
    expect(await db.prepare('SELECT size FROM receipts').first()).toEqual({ size: 8 });
  });

  it('does not allow concurrent snapshot writes to recreate chunks after account deletion', async () => {
    const results = await Promise.all([
      call('DELETE','/account'),
      // A tiny valid snapshot still creates chunks if admitted. A large rejected upload can
      // be transport-cancelled before Undici finishes writing and obscure this state assertion.
      call('PUT','/sync',new Uint8Array(4),{ 'if-match':'0','x-sync-schema':'17' }),
      call('PUT','/receipts/late.enc','late'),
      call('GET','/receipts'),
      call('PUT','/keys','{}'),
    ]);
    expect(results[0].status).toBe(204);
    for (const table of ['accounts','devices','snapshots','blob_chunks','receipts']) {
      expect(await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first(), table).toEqual({ n: 0 });
    }
    expect((await bucket.list()).objects).toHaveLength(0);
  });
});




// A held R2 write must finish before deletion is allowed to report completion.
it('orders deletion behind an already admitted receipt upload', async () => {
  let entered!: () => void;
  let release!: () => void;
  const atPut = new Promise<void>(r => entered = r);
  const gate = new Promise<void>(r => release = r);
  onIo = async action => { if (action === '/put') { entered(); await gate; } };
  const upload = call('PUT','/receipts/held.enc','held');
  await atPut;
  let deleted = false;
  const deletion = call('DELETE','/account').then(r => { deleted = true; return r; });
  await new Promise(r => setTimeout(r, 150));
  const completedTooSoon = deleted;
  release();
  expect((await upload).status).toBe(204);
  expect((await deletion).status).toBe(204);
  expect(completedTooSoon).toBe(false);
  expect((await bucket.list()).objects).toHaveLength(0);
});

it('recovers an uncommitted replacement after a real runtime restart before admitting new quota', async () => {
  await call('PUT','/receipts/a.enc','original');
  await db.prepare("CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'injected failure'); END").run();
  expect((await call('PUT','/receipts/a.enc','replacement')).status).toBe(503);
  expect((await state()).journal).toBeDefined();
  expect((await state()).alarm).not.toBeNull();
  await restart();
  await db.prepare('DROP TRIGGER reject_receipt').run();
  expect(await (await call('GET','/receipts/a.enc')).text()).toBe('original');
  expect((await bucket.list()).objects).toHaveLength(1);
  expect((await state()).journal).toBeUndefined();
  expect((await call('PUT','/receipts/b.enc','other')).status).toBe(204);
  expect(await db.prepare('SELECT SUM(size) AS n FROM receipts').first()).toEqual({ n: 13 });
});

it('recovers committed metadata after a restart without rolling back the new receipt', async () => {
  await call('PUT','/receipts/a.enc','original');
  onIo = async action => { if (action === '/delete') throw new Error('injected R2 outage'); };
  expect((await call('PUT','/receipts/a.enc','new')).status).toBe(503);
  expect((await bucket.list()).objects).toHaveLength(2);
  expect((await state()).journal).toBeDefined();
  await restart();
  onIo = async () => {};
  expect((await alarm()).status).toBe(200);
  expect(await (await call('GET','/receipts/a.enc')).text()).toBe('new');
  expect(await db.prepare('SELECT size FROM receipts').first()).toEqual({ size: 3 });
  expect((await bucket.list()).objects).toHaveLength(1);
});

it('persists a failed deletion fence across restart, blocks every account path and retries by alarm', async () => {
  await call('PUT','/receipts/a.enc','data');
  onIo = async action => { if (action === '/delete') throw new Error('injected R2 outage'); };
  expect((await call('DELETE','/account')).status).toBe(503);
  expect((await state()).fence).toEqual({ accountId: account, status: 'deleting' });
  expect((await state()).alarm).not.toBeNull();
  await restart();
  for (const [method,path,body] of [
    ['PUT','/keys','{}'], ['PUT','/sync','snapshot'], ['PUT','/receipts/new.enc','new'],
    ['DELETE','/receipts/a.enc',undefined], ['GET','/receipts',undefined], ['GET','/receipts/a.enc',undefined],
    ['DELETE','/devices/' + 'd'.repeat(32),undefined], ['POST','/auth/logout',undefined],
  ]) expect((await call(method!,path!,body)).status, path).toBe(503);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM receipts').first()).toEqual({ n: 1 });
  onIo = async () => {};
  expect((await alarm()).status).toBe(200);
  expect((await alarm()).status).toBe(200);
  for (const table of ['accounts','devices','snapshots','blob_chunks','receipts']) expect(await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).toEqual({ n: 0 });
  expect((await bucket.list()).objects).toHaveLength(0);
  expect((await state()).fence?.status).toBe('deleted');
  await restart();
  expect((await state()).fence?.status).toBe('deleted');
});


it('reauthenticates a queued mutation after the device has been revoked', async () => {
  let entered!: () => void;
  let release!: () => void;
  const gate = new Promise<void>(r => release = r);
  const atPut = new Promise<void>(r => entered = r);
  onIo = async action => { if (action === '/put') { entered(); await gate; } };
  const upload = call('PUT','/receipts/held.enc','held');
  await atPut;
  const pending = call('PUT','/keys','{"secret":"stale"}');
  await new Promise(r => setTimeout(r, 100));
  await db.prepare('DELETE FROM devices WHERE account_id = ?').bind(account).run();
  release();
  expect((await upload).status).toBe(204);
  expect((await pending).status).toBe(401);
  expect(await db.prepare('SELECT key_bundle FROM accounts WHERE id = ?').bind(account).first()).toEqual({ key_bundle: null });
});

it('orders legacy receipt migration with deletion and does not recreate old objects', async () => {
  await db.batch([
    db.prepare('INSERT INTO receipts(account_id,name,size,updated_at) VALUES (?, ?, 6, 0)').bind(account,'legacy.enc'),
    db.prepare('INSERT INTO blob_chunks(account_id,upload_id,idx,data) VALUES (?, ?, 0, ?)').bind(account,'rcpt:legacy.enc',new TextEncoder().encode('legacy')),
  ]);
  let entered!: () => void;
  let release!: () => void;
  const gate = new Promise<void>(r => release = r);
  const atPut = new Promise<void>(r => entered = r);
  onIo = async action => { if (action === '/put') { entered(); await gate; } };
  const migration = call('GET','/receipts');
  await atPut;
  const deletion = call('DELETE','/account');
  release();
  expect((await migration).status).toBe(200);
  expect((await deletion).status).toBe(204);
  expect((await bucket.list()).objects).toHaveLength(0);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM blob_chunks').first()).toEqual({ n: 0 });
});

it('keeps the deletion fence when D1 cleanup fails after R2 cleanup and resumes on restart', async () => {
  await call('PUT','/receipts/a.enc','receipt');
  await db.prepare("CREATE TRIGGER reject_delete BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT,'injected deletion failure'); END").run();
  expect((await call('DELETE','/account')).status).toBe(503);
  expect((await bucket.list()).objects).toHaveLength(0);
  expect((await state()).fence?.status).toBe('deleting');
  expect((await state()).alarm).not.toBeNull();
  await restart();
  await db.prepare('DROP TRIGGER reject_delete').run();
  expect((await alarm()).status).toBe(200);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE id = ?').bind(account).first()).toEqual({ n: 0 });
  expect((await state()).fence?.status).toBe('deleted');
});

it('signs in through the real coordinator RPC and assigns a fresh account ID after deletion', async () => {
  const signIn = async () => {
    expect((await call('POST','/auth/start',JSON.stringify({ email: 'new@example.test' }))).status).toBe(204);
    const response = await call('POST','/auth/verify',JSON.stringify({ email: 'new@example.test', code: mailedCode }));
    expect(response.status).toBe(200);
    return response.json() as Promise<{ token: string; accountId: string }>;
  };
  const first = await signIn();
  expect((await call('DELETE','/account',undefined,{ authorization: 'Bearer '+first.token })).status).toBe(204);
  await restart();
  const second = await signIn();
  expect(second.accountId).not.toBe(first.accountId);
  expect((await call('PUT','/receipts/fresh.enc','fresh',{ authorization: 'Bearer '+second.token })).status).toBe(204);
  expect((await call('GET','/receipts',undefined,{ authorization: 'Bearer '+second.token })).status).toBe(200);
  const fence = await (await mf.dispatchFetch(`https://local.test/__test/${first.accountId}/__state`)).json() as { fence: { status: string } };
  expect(fence.fence.status).toBe('deleted');
});
