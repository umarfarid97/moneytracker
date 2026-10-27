import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../src/index';
import { createFakeD1, createFakeR2, migration } from './fakeD1';

let env: Env;
let mails: { to: string; code: string }[];
const ORIGIN = 'https://umarfarid97.github.io';

beforeEach(async () => {
  mails = [];
  env = {
    DB: await createFakeD1(migration()),
    RECEIPTS: createFakeR2(),
    PEPPER: 'test-pepper',
    MAIL_FROM: 'Duit <login@example.com>',
    ALLOWED_ORIGINS: ORIGIN,
    SEND_MAIL: async (to, code) => void mails.push({ to, code }),
  };
});

const call = (method: string, path: string, init: { token?: string; body?: BodyInit; headers?: Record<string, string> } = {}) =>
  worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      body: init.body,
      headers: { ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), 'cf-connecting-ip': '1.2.3.4', ...init.headers },
    }),
    env,
  );
const post = (path: string, body: unknown) => call('POST', path, { body: JSON.stringify(body) });

async function signIn(email = 'umar@example.com', deviceName = 'Phone') {
  expect((await post('/auth/start', { email })).status).toBe(204);
  const code = mails[mails.length - 1].code;
  const res = await post('/auth/verify', { email, code, deviceName });
  expect(res.status).toBe(200);
  return (await res.json()) as { token: string; accountId: string; deviceId: string; bundle: unknown };
}

describe('sign-in', () => {
  it('sends a 6 digit code and exchanges it for a device token', async () => {
    const me = await signIn();
    expect(mails[0].to).toBe('umar@example.com');
    expect(mails[0].code).toMatch(/^\d{6}$/);
    expect(me.token.length).toBeGreaterThan(30);
    expect(me.bundle).toBeNull();
  });

  it('treats the email case-insensitively and gives the same account', async () => {
    const a = await signIn('Umar@Example.com');
    const b = await signIn('umar@example.com', 'Tablet');
    expect(b.accountId).toBe(a.accountId);
  });

  it('rejects a wrong code, and locks the code after 5 wrong tries', async () => {
    await post('/auth/start', { email: 'a@b.co' });
    const good = mails[0].code;
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await post('/auth/verify', { email: 'a@b.co', code: wrong })).status).toBe(401);
    expect((await post('/auth/verify', { email: 'a@b.co', code: good })).status).toBe(401);
  });

  it('a code works once', async () => {
    await post('/auth/start', { email: 'a@b.co' });
    const code = mails[0].code;
    expect((await post('/auth/verify', { email: 'a@b.co', code })).status).toBe(200);
    expect((await post('/auth/verify', { email: 'a@b.co', code })).status).toBe(401);
  });

  it('rejects an expired code', async () => {
    await post('/auth/start', { email: 'a@b.co' });
    await env.DB.prepare('UPDATE login_codes SET expires_at = 1').run();
    expect((await post('/auth/verify', { email: 'a@b.co', code: mails[0].code })).status).toBe(401);
  });

  it('limits codes per address to 5 an hour', async () => {
    for (let i = 0; i < 5; i++) expect((await post('/auth/start', { email: 'a@b.co' })).status).toBe(204);
    expect((await post('/auth/start', { email: 'a@b.co' })).status).toBe(429);
  });

  it('rejects a malformed email', async () => {
    expect((await post('/auth/start', { email: 'nope' })).status).toBe(400);
  });

  it('requires a token elsewhere', async () => {
    expect((await call('GET', '/sync')).status).toBe(401);
    expect((await call('GET', '/sync', { token: 'x'.repeat(40) })).status).toBe(401);
  });

  it('logs a device out and revokes it', async () => {
    const a = await signIn();
    const b = await signIn('umar@example.com', 'Tablet');
    const list = (await (await call('GET', '/devices', { token: a.token })).json()) as { devices: { id: string; name: string }[] };
    expect(list.devices.map((d) => d.name).sort()).toEqual(['Phone', 'Tablet']);
    expect((await call('DELETE', `/devices/${b.deviceId}`, { token: a.token })).status).toBe(204);
    expect((await call('GET', '/sync', { token: b.token })).status).toBe(401);
    expect((await call('POST', '/auth/logout', { token: a.token })).status).toBe(204);
    expect((await call('GET', '/sync', { token: a.token })).status).toBe(401);
  });
});

describe('key bundle', () => {
  it('is stored opaquely and returned at the next sign-in', async () => {
    const a = await signIn();
    const bundle = { v: 1, salt: 'abc', wrapped: 'def' };
    expect((await call('PUT', '/keys', { token: a.token, body: JSON.stringify(bundle) })).status).toBe(204);
    expect(await (await call('GET', '/keys', { token: a.token })).json()).toEqual({ bundle });
    const b = await signIn('umar@example.com', 'Tablet');
    expect(b.bundle).toEqual(bundle);
  });
  it('rejects junk and oversized bundles', async () => {
    const a = await signIn();
    expect((await call('PUT', '/keys', { token: a.token, body: 'not json' })).status).toBe(400);
    expect((await call('PUT', '/keys', { token: a.token, body: JSON.stringify({ x: 'a'.repeat(5000) }) })).status).toBe(413);
  });
});

const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);
const put = (token: string, version: number, data: Uint8Array, schema = 17) =>
  call('PUT', '/sync', { token, body: data, headers: { 'if-match': String(version), 'x-sync-schema': String(schema) } });

describe('snapshot', () => {
  it('starts empty', async () => {
    const a = await signIn();
    const res = await call('GET', '/sync', { token: a.token });
    expect(res.status).toBe(204);
    expect(res.headers.get('x-sync-version')).toBe('0');
  });

  it('stores and returns a snapshot, including one bigger than a chunk', async () => {
    const a = await signIn();
    const data = Uint8Array.from({ length: 2_000_000 }, (_, i) => i % 251);
    const res = await put(a.token, 0, data);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 1 });
    const got = await call('GET', '/sync', { token: a.token });
    expect(got.headers.get('x-sync-version')).toBe('1');
    expect(got.headers.get('x-sync-schema')).toBe('17');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(data);
    const head = await call('HEAD', '/sync', { token: a.token });
    expect(head.headers.get('x-sync-version')).toBe('1');
  });

  it('refuses an upload built on an old version', async () => {
    const a = await signIn();
    await put(a.token, 0, bytes(10, 1));
    await put(a.token, 1, bytes(10, 2));
    const stale = await put(a.token, 1, bytes(10, 3));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ version: 2 });
    const got = await call('GET', '/sync', { token: a.token });
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes(10, 2));
  });

  it('two phones racing from the same version: exactly one wins', async () => {
    const a = await signIn();
    const [x, y] = await Promise.all([put(a.token, 0, bytes(5, 1)), put(a.token, 0, bytes(5, 2))]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
  });

  it('keeps only the current and previous copy', async () => {
    const a = await signIn();
    for (let v = 0; v < 4; v++) await put(a.token, v, bytes(10, v + 1));
    const n = await env.DB.prepare('SELECT COUNT(DISTINCT upload_id) AS n FROM blob_chunks').first<{ n: number }>();
    expect(n?.n).toBe(2);
  });

  it('keeps accounts apart', async () => {
    const a = await signIn('a@b.co');
    const b = await signIn('c@d.co');
    await put(a.token, 0, bytes(10, 9));
    expect((await call('GET', '/sync', { token: b.token })).status).toBe(204);
  });

  it('rejects empty and oversized bodies', async () => {
    const a = await signIn();
    expect((await put(a.token, 0, new Uint8Array(0))).status).toBe(400);
    expect((await put(a.token, 0, bytes(8 * 1024 * 1024 + 1))).status).toBe(413);
  });
});

describe('receipts', () => {
  it('stores, lists and returns a receipt', async () => {
    const a = await signIn();
    const data = Uint8Array.from({ length: 1_000_000 }, (_, i) => i % 200);
    expect((await call('PUT', '/receipts/receipt-1.enc', { token: a.token, body: data })).status).toBe(204);
    expect(await (await call('GET', '/receipts', { token: a.token })).json()).toEqual({ receipts: [{ name: 'receipt-1.enc', size: 1_000_000 }] });
    const got = await call('GET', '/receipts/receipt-1.enc', { token: a.token });
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(data);
    expect((await call('GET', '/receipts/missing.enc', { token: a.token })).status).toBe(404);
  });
  it('keeps the bytes in R2, not D1, and deletes them', async () => {
    const a = await signIn();
    await call('PUT', '/receipts/r.enc', { token: a.token, body: bytes(7) });
    const r2 = env.RECEIPTS as unknown as { map: Map<string, Uint8Array> };
    expect([...r2.map.keys()]).toEqual([`${a.accountId}/r.enc`]);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM blob_chunks').first<{ n: number }>())?.n).toBe(0);
    expect((await call('DELETE', '/receipts/r.enc', { token: a.token })).status).toBe(204);
    expect(r2.map.size).toBe(0);
    expect((await call('GET', '/receipts/r.enc', { token: a.token })).status).toBe(404);
  });
  it('enforces the per-account quota', async () => {
    const a = await signIn();
    for (let i = 0; i < 50; i++) await env.DB.prepare('INSERT INTO receipts (account_id, name, size, updated_at, in_r2) VALUES (?, ?, ?, 0, 1)').bind(a.accountId, `f${i}.enc`, 3 * 1024 * 1024).run();
    const res = await call('PUT', '/receipts/new.enc', { token: a.token, body: bytes(5) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'quota' });
  });
  it('moves old D1 receipts to R2 when read, and on list, without losing any', async () => {
    const a = await signIn();
    const old = async (name: string, fill: number) => {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO blob_chunks (account_id, upload_id, idx, data) VALUES (?, ?, 0, ?)').bind(a.accountId, `rcpt:${name}`, bytes(4, fill)),
        env.DB.prepare('INSERT INTO receipts (account_id, name, size, updated_at) VALUES (?, ?, 4, 0)').bind(a.accountId, name),
      ]);
    };
    await old('a.enc', 1);
    await old('b.enc', 2);
    const got = await call('GET', '/receipts/a.enc', { token: a.token });
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes(4, 1));
    expect((env.RECEIPTS as unknown as { map: Map<string, unknown> }).map.has(`${a.accountId}/a.enc`)).toBe(true);
    const list = (await (await call('GET', '/receipts', { token: a.token })).json()) as { receipts: unknown[] };
    expect(list.receipts).toHaveLength(2);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM blob_chunks').first<{ n: number }>())?.n).toBe(0);
    const again = await call('GET', '/receipts/b.enc', { token: a.token });
    expect(new Uint8Array(await again.arrayBuffer())).toEqual(bytes(4, 2));
  });
  it('rejects bad names and big files', async () => {
    const a = await signIn();
    expect((await call('PUT', '/receipts/..%2Fx', { token: a.token, body: bytes(3) })).status).toBe(400);
    expect((await call('PUT', '/receipts/big.enc', { token: a.token, body: bytes(3 * 1024 * 1024 + 1) })).status).toBe(413);
  });
  it('does not touch the snapshot cleanup', async () => {
    const a = await signIn();
    await call('PUT', '/receipts/r.enc', { token: a.token, body: bytes(5) });
    for (let v = 0; v < 3; v++) await put(a.token, v, bytes(10, v + 1));
    expect((await call('GET', '/receipts/r.enc', { token: a.token })).status).toBe(200);
  });
});

describe('account', () => {
  it('delete wipes everything', async () => {
    const a = await signIn();
    await put(a.token, 0, bytes(10));
    await call('PUT', '/receipts/r.enc', { token: a.token, body: bytes(5) });
    expect((await call('DELETE', '/account', { token: a.token })).status).toBe(204);
    for (const t of ['accounts', 'devices', 'snapshots', 'blob_chunks', 'receipts']) {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>();
      expect(row?.n, t).toBe(0);
    }
    expect((env.RECEIPTS as unknown as { map: Map<string, unknown> }).map.size).toBe(0);
  });
});

describe('CORS', () => {
  it('answers the web app origin and no one else', async () => {
    const ok = await worker.fetch(new Request('https://api.test/sync', { method: 'OPTIONS', headers: { origin: ORIGIN } }), env);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(ok.headers.get('access-control-allow-headers')).toContain('If-Match');
    const bad = await worker.fetch(new Request('https://api.test/sync', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), env);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('exposes sync headers on real responses', async () => {
    const res = await worker.fetch(new Request('https://api.test/', { headers: { origin: ORIGIN } }), env);
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Sync-Version');
  });
});
