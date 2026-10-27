import { hmacHex, normalizeEmail, randomCode, randomId, randomToken, safeEqual, sha256Hex, validEmail } from './util';

export interface Env {
  DB: D1Database;
  /** Private R2 bucket holding receipt ciphertext, keyed `<accountId>/<name>`. */
  RECEIPTS: R2Bucket;
  /** Mixed into email and code hashes. Set with `wrangler secret put PEPPER`. */
  PEPPER: string;
  /** Resend API key. Set with `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY?: string;
  MAIL_FROM: string;
  ALLOWED_ORIGINS: string;
  /** Test hook: replaces the Resend call. */
  SEND_MAIL?: (to: string, code: string) => Promise<void>;
}

const MAX_SNAPSHOT = 8 * 1024 * 1024;
// Room for a 10 MB receipt file (the app's limit) plus encryption overhead.
const MAX_RECEIPT = 10 * 1024 * 1024 + 1024;
const MAX_RECEIPTS_TOTAL = 150 * 1024 * 1024;
/** Old receipts still in D1 that one list call moves to R2. */
const MIGRATE_PER_LIST = 5;
const CHUNK = 900 * 1024;
const CODE_TTL = 10 * 60_000;
const CODE_TRIES = 5;
const MAX_DEVICES = 10;
const MAX_KEY_BUNDLE = 4096;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

class HttpError extends Error {
  constructor(public status: number, public body: unknown = { error: 'error' }) {
    super(String(status));
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
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

  const auth = await authenticate(req, env);

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
      const text = await req.text();
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
    await migrateSome(env, auth.accountId, MIGRATE_PER_LIST);
    const { results } = await env.DB.prepare('SELECT name, size FROM receipts WHERE account_id = ? ORDER BY name').bind(auth.accountId).all();
    return json(200, { receipts: results });
  }
  const rc = path.match(/^\/receipts\/([^/]+)$/);
  if (rc) {
    const name = decodeURIComponent(rc[1]);
    if (!NAME.test(name)) throw new HttpError(400);
    if (m === 'GET') return receiptGet(env, auth.accountId, name);
    if (m === 'PUT') return receiptPut(req, env, auth.accountId, name);
    if (m === 'DELETE') return receiptDelete(env, auth.accountId, name);
  }
  if (path === '/account' && m === 'DELETE') {
    await deleteAccount(env, auth.accountId);
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
  const text = await req.text();
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
    `INSERT INTO login_codes (email_hash, code_hash, expires_at, tries) VALUES (?, ?, ?, 0)
     ON CONFLICT(email_hash) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, tries = 0`,
  ).bind(emailHash, await hmacHex(env.PEPPER, `${emailHash}:${code}`), Date.now() + CODE_TTL).run();
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
  const row = await env.DB.prepare('SELECT code_hash, expires_at, tries FROM login_codes WHERE email_hash = ?')
    .bind(emailHash).first<{ code_hash: string; expires_at: number; tries: number }>();
  if (!row || row.expires_at < Date.now() || row.tries >= CODE_TRIES) throw new HttpError(401, { error: 'code' });
  const ok = safeEqual(row.code_hash, await hmacHex(env.PEPPER, `${emailHash}:${code}`));
  if (!ok) {
    await env.DB.prepare('UPDATE login_codes SET tries = tries + 1 WHERE email_hash = ?').bind(emailHash).run();
    throw new HttpError(401, { error: 'code' });
  }
  await env.DB.prepare('DELETE FROM login_codes WHERE email_hash = ?').bind(emailHash).run();

  const now = Date.now();
  let account = await env.DB.prepare('SELECT id, key_bundle FROM accounts WHERE email_hash = ?')
    .bind(emailHash).first<{ id: string; key_bundle: string | null }>();
  if (!account) {
    const id = randomId();
    await env.DB.prepare('INSERT INTO accounts (id, email_hash, created_at) VALUES (?, ?, ?)').bind(id, emailHash, now).run();
    account = { id, key_bundle: null };
  }
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

async function authenticate(req: Request, env: Env): Promise<{ accountId: string; deviceId: string }> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token.length < 20 || token.length > 100) throw new HttpError(401, { error: 'auth' });
  const row = await env.DB.prepare('SELECT id, account_id, last_seen FROM devices WHERE token_hash = ?')
    .bind(await sha256Hex(token)).first<{ id: string; account_id: string; last_seen: number }>();
  if (!row) throw new HttpError(401, { error: 'auth' });
  const now = Date.now();
  if (now - row.last_seen > 3_600_000) await env.DB.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(now, row.id).run();
  await hit(env, `acct:${row.account_id}`, 3000, 3_600_000);
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
  const data = new Uint8Array(await req.arrayBuffer());
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
async function moveToR2(env: Env, accountId: string, name: string): Promise<Uint8Array | null> {
  const data = await readChunks(env, accountId, `rcpt:${name}`);
  if (data.length === 0) return null;
  await env.RECEIPTS.put(r2Key(accountId, name), data);
  // Only forget the D1 copy once R2 has the object.
  await env.DB.batch([
    env.DB.prepare('UPDATE receipts SET in_r2 = 1 WHERE account_id = ? AND name = ?').bind(accountId, name),
    env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id = ?').bind(accountId, `rcpt:${name}`),
  ]);
  return data;
}

async function migrateSome(env: Env, accountId: string, limit: number) {
  const { results } = await env.DB.prepare('SELECT name FROM receipts WHERE account_id = ? AND in_r2 = 0 LIMIT ?')
    .bind(accountId, limit).all<{ name: string }>();
  for (const r of results) await moveToR2(env, accountId, r.name);
}

async function receiptGet(env: Env, accountId: string, name: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT in_r2 FROM receipts WHERE account_id = ? AND name = ?').bind(accountId, name).first<{ in_r2: number }>();
  if (!row) throw new HttpError(404);
  const headers = { 'content-type': 'application/octet-stream' };
  if (row.in_r2) {
    const obj = await env.RECEIPTS.get(r2Key(accountId, name));
    if (!obj) throw new HttpError(404);
    return new Response(obj.body, { headers });
  }
  const data = await moveToR2(env, accountId, name);
  if (!data) throw new HttpError(404);
  return new Response(data, { headers });
}

async function receiptPut(req: Request, env: Env, accountId: string, name: string): Promise<Response> {
  const data = new Uint8Array(await req.arrayBuffer());
  if (data.length === 0) throw new HttpError(400);
  if (data.length > MAX_RECEIPT) throw new HttpError(413);
  const total = await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM receipts WHERE account_id = ? AND name <> ?')
    .bind(accountId, name).first<{ n: number }>();
  if ((total?.n ?? 0) + data.length > MAX_RECEIPTS_TOTAL) throw new HttpError(413, { error: 'quota' });
  await env.RECEIPTS.put(r2Key(accountId, name), data);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id = ?').bind(accountId, `rcpt:${name}`),
    env.DB.prepare('INSERT OR REPLACE INTO receipts (account_id, name, size, updated_at, in_r2) VALUES (?, ?, ?, ?, 1)')
      .bind(accountId, name, data.length, Date.now()),
  ]);
  return new Response(null, { status: 204 });
}

async function receiptDelete(env: Env, accountId: string, name: string): Promise<Response> {
  await env.RECEIPTS.delete(r2Key(accountId, name));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM blob_chunks WHERE account_id = ? AND upload_id = ?').bind(accountId, `rcpt:${name}`),
    env.DB.prepare('DELETE FROM receipts WHERE account_id = ? AND name = ?').bind(accountId, name),
  ]);
  return new Response(null, { status: 204 });
}

async function deleteAccount(env: Env, accountId: string) {
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
