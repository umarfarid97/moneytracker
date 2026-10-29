import { AccountCoordinator } from './accountCoordinator';
export { AccountCoordinator };
import { hmacHex, normalizeEmail, randomCode, randomId, randomToken, safeEqual, sha256Hex, validEmail } from './util';

export interface Env extends CloudflareBindings {
  /** Mixed into email and code hashes. Set with `wrangler secret put PEPPER`. */
  PEPPER: string;
  /** Resend API key. Set with `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY?: string;
  /** Test hook: replaces the Resend call. */
  SEND_MAIL?: (to: string, code: string) => Promise<void>;
}

const MAX_SNAPSHOT = 8 * 1024 * 1024;
/** Old receipts still in D1 that one list call moves to R2. */
const MIGRATE_PER_LIST = 5;
const CHUNK = 900 * 1024;
const CODE_TTL = 10 * 60_000;
const CODE_TRIES = 5;
const MAX_DEVICES = 10;
const MAX_KEY_BUNDLE = 4096;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export class HttpError extends Error {
  constructor(public status: number, public body: unknown = { error: 'error' }) {
    super(String(status));
  }
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const h: Record<string, string> = { vary: 'Origin' };
  if (origin && allowed.includes(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'GET, HEAD, PUT, POST, DELETE, OPTIONS';
    h['access-control-allow-headers'] = 'Authorization, Content-Type, If-Match, X-Sync-Schema';
    h['access-control-expose-headers'] = 'X-Sync-Version, X-Sync-Schema, X-Server-Time';
    h['access-control-max-age'] = '86400';
  }
  return h;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res: Response;
    try {
      res = await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) res = json(e.status, e.body);
      else {
        console.error(e);
        res = json(500, { error: 'server' });
      }
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    out.headers.set('X-Server-Time', String(Date.now()));
    out.headers.set('cache-control', 'no-store');
    return out;
  },
};

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (path === '/' && m === 'GET') return json(200, { app: 'duit-cloud', ok: true });
  if (path === '/auth/start' && m === 'POST') return authStart(req, env);
  if (path === '/auth/verify' && m === 'POST') return authVerify(req, env);

  const auth = await authenticate(req, env, false);
  const headers = new Headers(req.headers);
  headers.set('x-duit-account', auth.accountId);
  return env.ACCOUNTS.get(env.ACCOUNTS.idFromName(auth.accountId)).fetch(new Request(req, { headers }));
}

export async function accountRoute(req: Request, env: Env, auth: { accountId: string; deviceId: string }, coordinator: AccountCoordinator): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (path === '/auth/logout' && m === 'POST') {
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(auth.deviceId).run();
    return new Response(null, { status: 204 });
  }
  if (path === '/devices' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, name, created_at AS createdAt, last_seen AS lastSeen FROM devices WHERE account_id = ? ORDER BY created_at')
      .bind(auth.accountId).all();
    return json(200, { current: auth.deviceId, devices: results });
  }
  const dev = path.match(/^\/devices\/([0-9a-f]+)$/);
  if (dev && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM devices WHERE id = ? AND account_id = ?').bind(dev[1], auth.accountId).run();
    return new Response(null, { status: 204 });
  }
  if (path === '/keys') {
    if (m === 'GET') {
      const row = await env.DB.prepare('SELECT key_bundle FROM accounts WHERE id = ?').bind(auth.accountId).first<{ key_bundle: string | null }>();
      return json(200, { bundle: row?.key_bundle ? JSON.parse(row.key_bundle) : null });
    }
    if (m === 'PUT') {
      const text = new TextDecoder().decode(await readBody(req, MAX_KEY_BUNDLE));
      if (text.length > MAX_KEY_BUNDLE) throw new HttpError(413);
      try {
        if (typeof JSON.parse(text) !== 'object') throw 0;
      } catch {
        throw new HttpError(400);
      }
      await env.DB.prepare('UPDATE accounts SET key_bundle = ? WHERE id = ?').bind(text, auth.accountId).run();
      return new Response(null, { status: 204 });
    }
  }
  if (path === '/sync') {
    if (m === 'GET' || m === 'HEAD') return syncGet(env, auth.accountId, m === 'HEAD');
    if (m === 'PUT') return syncPut(req, env, auth.accountId);
  }
  if (path === '/receipts' && m === 'GET') {
    await migrateSome(env, auth.accountId, MIGRATE_PER_LIST, coordinator);
    const { results } = await env.DB.prepare('SELECT name, size FROM receipts WHERE account_id = ? ORDER BY name').bind(auth.accountId).all();
    return json(200, { receipts: results });
  }
  const rc = path.match(/^\/receipts\/([^/]+)$/);
  if (rc) {
    const name = decodeURIComponent(rc[1]);
    if (!NAME.test(name)) throw new HttpError(400);
    if (m === 'GET') return receiptGet(env, auth.accountId, name, coordinator);
    if (m === 'PUT') return coordinator.putReceipt(req, auth.accountId, name);
    if (m === 'DELETE') return coordinator.removeReceipt(auth.accountId, name);
  }
  if (path === '/account' && m === 'DELETE') {
    await coordinator.deleteAccount(auth.accountId);
    return new Response(null, { status: 204 });
  }
  throw new HttpError(404);
}

// ---- rate limiting ----------------------------------------------------------------------------

/** Counts one hit against `key` in a window of `windowMs`; throws 429 above `limit`. */
async function hit(env: Env, key: string, limit: number, windowMs: number) {
  const window = Math.floor(Date.now() / windowMs);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END, window = excluded.window
     RETURNING count`,
  ).bind(key, window).first<{ count: number }>();
  if ((row?.count ?? 1) > limit) throw new HttpError(429, { error: 'rate' });
}

const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? 'unknown';

// ---- auth -------------------------------------------------------------------------------------

async function readJson<T>(req: Request): Promise<T> {
  const text = new TextDecoder().decode(await readBody(req, 16_384));
  if (text.length > 16_384) throw new HttpError(413);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400);
  }
}

async function sendMail(env: Env, to: string, code: string) {
  if (env.SEND_MAIL) return env.SEND_MAIL(to, code);
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject: `Your Duit code is ${code}`,
      text: `Your Duit sign-in code is ${code}. It works for 10 minutes. If you did not ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
}

async function authStart(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(req);
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (!validEmail(email)) throw new HttpError(400, { error: 'email' });
  const emailHash = await hmacHex(env.PEPPER, email);
  await hit(env, `ip:${clientIp(req)}`, 20, 3_600_000);
  await hit(env, `mail:${emailHash}`, 5, 3_600_000);

  const code = randomCode();
  await env.DB.prepare(
    `INSERT INTO login_codes (email_hash, code_hash, expires_at, tries, generation) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email_hash) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, tries = 0, generation = excluded.generation`,
  ).bind(emailHash, await hmacHex(env.PEPPER, `${emailHash}:${code}`), Date.now() + CODE_TTL, randomId()).run();
  await sendMail(env, email, code);
  // Same answer for every address, so this cannot be used to find out who has an account.
  return new Response(null, { status: 204 });
}

async function authVerify(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown; code?: unknown; deviceName?: unknown }>(req);
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const deviceName = (typeof body.deviceName === 'string' ? body.deviceName : 'Device').slice(0, 60) || 'Device';
  if (!validEmail(email) || !/^\d{6}$/.test(code)) throw new HttpError(400, { error: 'code' });
  await hit(env, `ip:${clientIp(req)}`, 60, 3_600_000);

  const emailHash = await hmacHex(env.PEPPER, email);
  const row = await env.DB.prepare(
    `UPDATE login_codes SET tries = tries + 1
     WHERE email_hash = ? AND expires_at > ? AND tries < ? RETURNING code_hash, generation`,
  ).bind(emailHash, Date.now(), CODE_TRIES).first<{ code_hash: string; generation: string }>();
  if (!row || !safeEqual(row.code_hash, await hmacHex(env.PEPPER, `${emailHash}:${code}`))) {
    throw new HttpError(401, { error: 'code' });
  }
  const consumed = await env.DB.prepare(
    `DELETE FROM login_codes WHERE email_hash = ? AND generation = ? AND code_hash = ? AND expires_at > ? RETURNING email_hash`,
  ).bind(emailHash, row.generation, row.code_hash, Date.now()).first();
  if (!consumed) throw new HttpError(401, { error: 'code' });

  const now = Date.now();
  let account = await env.DB.prepare('SELECT id, key_bundle FROM accounts WHERE email_hash = ?')
    .bind(emailHash).first<{ id: string; key_bundle: string | null }>();
  if (!account) {
    const id = randomId();
    await env.DB.prepare('INSERT OR IGNORE INTO accounts (id, email_hash, created_at) VALUES (?, ?, ?)').bind(id, emailHash, now).run();
    account = (await env.DB.prepare('SELECT id, key_bundle FROM accounts WHERE email_hash = ?').bind(emailHash).first<{ id: string; key_bundle: string | null }>())!;
  }
  return env.ACCOUNTS.get(env.ACCOUNTS.idFromName(account.id)).register(account.id, emailHash, deviceName);
}

export async function registerDevice(env: Env, accountId: string, emailHash: string, deviceName: string): Promise<Response> {
  const account = await env.DB.prepare('SELECT id, key_bundle FROM accounts WHERE id = ? AND email_hash = ?')
    .bind(accountId, emailHash).first<{ id: string; key_bundle: string | null }>();
  if (!account) throw new HttpError(401, { error: 'auth' });
  const now = Date.now();
  // Keep the newest devices when over the limit.
  const { results: devices } = await env.DB.prepare('SELECT id FROM devices WHERE account_id = ? ORDER BY last_seen DESC')
    .bind(account.id).all<{ id: string }>();
  for (const d of devices.slice(MAX_DEVICES - 1)) await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(d.id).run();

  const token = randomToken();
  const deviceId = randomId();
  await env.DB.prepare('INSERT INTO devices (id, account_id, token_hash, name, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(deviceId, account.id, await sha256Hex(token), deviceName, now, now).run();
  return json(200, { token, deviceId, accountId: account.id, bundle: account.key_bundle ? JSON.parse(account.key_bundle) : null });
}

export async function authenticate(req: Request, env: Env, update = true): Promise<{ accountId: string; deviceId: string }> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token.length < 20 || token.length > 100) throw new HttpError(401, { error: 'auth' });
  const row = await env.DB.prepare('SELECT id, account_id, last_seen FROM devices WHERE token_hash = ?')
    .bind(await sha256Hex(token)).first<{ id: string; account_id: string; last_seen: number }>();
  if (!row) throw new HttpError(401, { error: 'auth' });
  const now = Date.now();
  if (update && now - row.last_seen > 3_600_000) await env.DB.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(now, row.id).run();
  if (update) await hit(env, `acct:${row.account_id}`, 3000, 3_600_000);
  return { accountId: row.account_id, deviceId: row.id };
}

// ---- snapshot ---------------------------------------------------------------------------------

type Head = { version: number; schema: number; size: number; upload_id: string; prev_upload_id: string };

async function readChunks(env: Env, accountId: string, uploadId: string): Promise<Uint8Array> {
  const { results } = await env.DB.prepare('SELECT data FROM blob_chunks WHERE account_id = ? AND upload_id = ? ORDER BY idx')
    .bind(accountId, uploadId).all<{ data: ArrayBuffer | number[] }>();
  const parts = results.map((r) => (r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : ArrayBuffer.isView(r.data) ? (r.data as unknown as Uint8Array) : Uint8Array.from(r.data)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function syncGet(env: Env, accountId: string, headOnly: boolean): Promise<Response> {
  const head = await env.DB.prepare('SELECT version, schema, size, upload_id, prev_upload_id FROM snapshots WHERE account_id = ?')
    .bind(accountId).first<Head>();
  if (!head || head.version === 0) return new Response(null, { status: 204, headers: { 'X-Sync-Version': '0' } });
  const headers = { 'X-Sync-Version': String(head.version), 'X-Sync-Schema': String(head.schema), 'content-type': 'application/octet-stream' };
  if (headOnly) return new Response(null, { status: 200, headers });
  return new Response(await readChunks(env, accountId, head.upload_id), { status: 200, headers });
}

async function syncPut(req: Request, env: Env, accountId: string): Promise<Response> {
  const expected = Number(req.headers.get('if-match'));
  const schema = Number(req.headers.get('x-sync-schema') ?? 0);
  if (!Number.isInteger(expected) || expected < 0 || !Number.isInteger(schema) || schema < 0) throw new HttpError(400);
  const data = await readBody(req, MAX_SNAPSHOT);
  if (data.length === 0) throw new HttpError(400);
  if (data.length > MAX_SNAPSHOT) throw new HttpError(413);

  await env.DB.prepare('INSERT OR IGNORE INTO snapshots (account_id, version) VALUES (?, 0)').bind(accountId).run();
  const uploadId = randomId();
  const stmts = [];
  for (let i = 0, idx = 0; i < data.length; i += CHUNK, idx++) {
    stmts.push(
      env.DB.prepare('INSERT INTO blob_chunks (account_id, upload_id, idx, data) VALUES (?, ?, ?, ?)')
        .bind(accountId, uploadId, idx, data.slice(i, i + CHUNK)),
    );
  }
  await env.DB.batch(stmts);

  // Only one writer can move the version from `expected`; the others get a 409 and merge first.
  const swapped = await env.DB.prepare(
    `UPDATE snapshots SET version = version + 1, schema = ?, size = ?, prev_upload_id = upload_id, upload_id = ?, updated_at = ?
     WHERE account_id = ? AND version = ?`,
  ).bind(schema, data.length, uploadId, Date.now(), accountId, expected).run();
  if (!swapped.meta.changes) {
    await env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id = ?').bind(accountId, uploadId).run();
    const head = await env.DB.prepare('SELECT version FROM snapshots WHERE account_id = ?').bind(accountId).first<{ version: number }>();
    return json(409, { error: 'conflict', version: head?.version ?? 0 });
  }
  const head = (await env.DB.prepare('SELECT version, upload_id, prev_upload_id FROM snapshots WHERE account_id = ?')
    .bind(accountId).first<Head>())!;
  // Keep the current and the previous copy so a bad upload can be rolled back by hand.
  await env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id NOT IN (?, ?) AND upload_id NOT LIKE ?')
    .bind(accountId, head.upload_id, head.prev_upload_id, 'rcpt:%').run();
  return json(200, { version: head.version });
}

// ---- receipts ---------------------------------------------------------------------------------

const r2Key = (accountId: string, name: string) => `${accountId}/${name}`;

/** Receipts saved before R2 sit in D1 chunks (`in_r2 = 0`); they are copied over on first read or list. */
async function moveToR2(env: Env, accountId: string, name: string, coordinator: AccountCoordinator): Promise<Uint8Array | null> {
  const data = await readChunks(env, accountId, `rcpt:${name}`);
  if (data.length === 0) return null;
  await coordinator.writeReceipt(accountId, name, data);
  return data;
}

async function migrateSome(env: Env, accountId: string, limit: number, coordinator: AccountCoordinator) {
  const { results } = await env.DB.prepare('SELECT name FROM receipts WHERE account_id = ? AND in_r2 = 0 LIMIT ?')
    .bind(accountId, limit).all<{ name: string }>();
  for (const r of results) await moveToR2(env, accountId, r.name, coordinator);
}

async function receiptGet(env: Env, accountId: string, name: string, coordinator: AccountCoordinator): Promise<Response> {
  const row = await env.DB.prepare('SELECT in_r2, object_key FROM receipts WHERE account_id = ? AND name = ?').bind(accountId, name).first<{ in_r2: number; object_key: string | null }>();
  if (!row) throw new HttpError(404);
  const headers = { 'content-type': 'application/octet-stream' };
  if (row.in_r2) {
    const obj = await env.RECEIPTS.get(row.object_key ?? r2Key(accountId, name));
    if (!obj) throw new HttpError(404);
    return new Response(obj.body, { headers });
  }
  const data = await moveToR2(env, accountId, name, coordinator);
  if (!data) throw new HttpError(404);
  return new Response(data, { headers });
}

export async function cleanupAccount(env: Env, accountId: string) {
  let cursor: string | undefined;
  do {
    const page = await env.RECEIPTS.list({ prefix: `${accountId}/`, cursor });
    if (page.objects.length) await env.RECEIPTS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM receipts WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM snapshots WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM devices WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
  ]);
}

/** Bound allocation while reading, including clients omitting Content-Length. */
export async function readBody(req: Request, limit: number): Promise<Uint8Array> {
  const length = Number(req.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) throw new HttpError(413);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new HttpError(408)), 15_000); });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new HttpError(413);
      parts.push(part.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally { clearTimeout(timer); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { data.set(part, offset); offset += part.byteLength; }
  return data;
}
