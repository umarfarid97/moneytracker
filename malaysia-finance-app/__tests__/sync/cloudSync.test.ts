import { CAT, freshDb } from '../screens/helpers';
import { addExpense, listAllExpenses } from '@/db/repos/expenses';
import { CloudApi, CloudAuthError, CloudCodeError } from '@/sync/cloudApi';
import { completeSignIn, createKeys, setNewPassphrase, unlock } from '@/sync/cloudAccount';
import { syncWithCloud } from '@/sync/cloudSync';
import { newDataKey, WrongSecretError } from '@/sync/cryptoBox';
import { SyncTooNewError } from '@/sync/syncErrors';
import { toBase64 } from '@/sync/bytes';

jest.mock('@/sync/random', () => ({ randomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)) }));
jest.mock('@/sync/receiptFiles', () => ({
  RECEIPT_FILES: true,
  prepareReceipts: jest.fn(async () => {}),
  isStoredReceipt: (s: string | null) => !!s && s.startsWith('receipts/'),
  receiptExists: jest.fn((s: string) => mockLocal.has(s)),
  readReceiptBase64: jest.fn(async (s: string) => mockLocal.get(s) ?? null),
  writeReceiptBase64: jest.fn(async (s: string, b64: string) => void mockLocal.set(s, b64)),
}));
const mockLocal = new Map<string, string>();

/** The Worker's contract (compare-and-swap snapshot, receipts, keys, email code) in memory. */
function fakeCloud() {
  let version = 0;
  let schema = 0;
  let blob: Uint8Array | null = null;
  let bundle: unknown = null;
  const receipts = new Map<string, Uint8Array>();
  const tokens = new Set<string>();
  let code = '123456';
  const calls: string[] = [];
  const state = { failNextPutWithConflict: false, quotaFull: false };
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    calls.push(`${method} ${path}`);
    const h = init.headers as Record<string, string>;
    const body = async () => new Uint8Array(init.body as ArrayBuffer);
    if (path === '/auth/start') return new Response(null, { status: 204 });
    if (path === '/auth/verify') {
      if (JSON.parse(String(init.body)).code !== code) return Response.json({ error: 'code' }, { status: 401 });
      const token = `tok-${tokens.size}-${'x'.repeat(30)}`;
      tokens.add(token);
      return Response.json({ token, deviceId: `d${tokens.size}`, accountId: 'a', bundle });
    }
    if (!tokens.has((h.Authorization ?? '').slice(7))) return new Response('{}', { status: 401 });
    if (path === '/keys' && method === 'GET') return Response.json({ bundle });
    if (path === '/keys' && method === 'PUT') {
      bundle = JSON.parse(String(init.body));
      return new Response(null, { status: 204 });
    }
    if (path === '/sync' && method === 'HEAD') return new Response(null, { headers: { 'X-Sync-Version': String(version) } });
    if (path === '/sync' && method === 'GET') {
      if (!blob) return new Response(null, { status: 204 });
      return new Response(blob as unknown as BodyInit, { headers: { 'X-Sync-Version': String(version), 'X-Sync-Schema': String(schema) } });
    }
    if (path === '/sync' && method === 'PUT') {
      const mine = Number(h['If-Match']);
      if (state.failNextPutWithConflict) {
        state.failNextPutWithConflict = false;
        return Response.json({ error: 'conflict', version }, { status: 409 });
      }
      if (mine !== version) return Response.json({ error: 'conflict', version }, { status: 409 });
      blob = await body();
      schema = Number(h['X-Sync-Schema']);
      version += 1;
      return Response.json({ version });
    }
    if (path === '/receipts' && method === 'GET') return Response.json({ receipts: [...receipts.keys()].map((name) => ({ name })) });
    const rc = path.match(/^\/receipts\/(.+)$/);
    if (rc && method === 'PUT') {
      if (state.quotaFull) return Response.json({ error: 'quota' }, { status: 413 });
      receipts.set(decodeURIComponent(rc[1]), await body());
      return new Response(null, { status: 204 });
    }
    if (rc && method === 'GET') return new Response(receipts.get(decodeURIComponent(rc[1])) as unknown as BodyInit);
    throw new Error(`unexpected ${method} ${path}`);
  });
  return { fetchMock, calls, state, setSchema: (n: number) => { schema = n; }, get blob() { return blob; }, get version() { return version; }, receipts };
}

let cloud: ReturnType<typeof fakeCloud>;
let key: Uint8Array;
const api = () => new CloudApi('https://cloud.test', 'tok-0-' + 'x'.repeat(30));
beforeEach(() => {
  cloud = fakeCloud();
  global.fetch = cloud.fetchMock as unknown as typeof fetch;
  key = newDataKey();
  mockLocal.clear();
  jest.clearAllMocks();
});
/** Signs a fake device in so its token is accepted. */
const login = async () => {
  const a = new CloudApi('https://cloud.test');
  return completeSignIn(a, 'umar@example.com', '123456', 'Phone', null);
};

const spend = (db: Awaited<ReturnType<typeof freshDb>>, note: string, receiptUri: string | null = null) =>
  addExpense(db, { amount: 1000, categoryId: CAT.Makan, date: '2026-10-01', note, receiptUri });

test('first device uploads encrypted data; a second device gets it and adds its own', async () => {
  await login();
  const phone = await freshDb();
  await spend(phone, 'nasi');
  const first = await syncWithCloud(phone, api(), key);
  expect(first).toMatchObject({ changedLocal: false, version: 1 });
  // The server holds only ciphertext.
  expect(Buffer.from(cloud.blob!).includes('nasi')).toBe(false);

  const tablet = await freshDb();
  await spend(tablet, 'teh');
  const second = await syncWithCloud(tablet, api(), key);
  expect(second.changedLocal).toBe(true);
  expect((await listAllExpenses(tablet)).map((e) => e.note).sort()).toEqual(['nasi', 'teh']);
  expect(cloud.version).toBe(2);

  expect((await syncWithCloud(phone, api(), key)).changedLocal).toBe(true);
  expect((await listAllExpenses(phone)).map((e) => e.note).sort()).toEqual(['nasi', 'teh']);
});

test('does not upload again when nothing changed', async () => {
  await login();
  const db = await freshDb();
  await spend(db, 'nasi');
  await syncWithCloud(db, api(), key);
  await syncWithCloud(db, api(), key);
  expect(cloud.version).toBe(1);
});

test('the periodic check stops after a HEAD when the cloud has not moved', async () => {
  await login();
  const db = await freshDb();
  const { version } = await syncWithCloud(db, api(), key);
  cloud.calls.length = 0;
  const quick = await syncWithCloud(db, api(), key, version);
  expect(quick).toEqual({ changedLocal: false, version });
  expect(cloud.calls).toEqual(['HEAD /sync']);
});

test('merges and retries when another phone uploaded first', async () => {
  await login();
  const a = await freshDb();
  await spend(a, 'from a');
  await syncWithCloud(a, api(), key);
  const b = await freshDb();
  await syncWithCloud(b, api(), key);
  await spend(b, 'from b');
  // a uploads while b is mid-sync: b's first PUT is refused, it fetches again and merges.
  await spend(a, 'a again');
  cloud.state.failNextPutWithConflict = true;
  await syncWithCloud(a, api(), key);
  await syncWithCloud(b, api(), key);
  await syncWithCloud(a, api(), key);
  expect((await listAllExpenses(a)).map((e) => e.note).sort()).toEqual(['a again', 'from a', 'from b']);
  expect((await listAllExpenses(b)).map((e) => e.note).sort()).toEqual(['a again', 'from a', 'from b']);
});

test('refuses cloud data from a newer app version', async () => {
  await login();
  const db = await freshDb();
  await spend(db, 'x');
  await syncWithCloud(db, api(), key);
  cloud.setSchema(999);
  await expect(syncWithCloud(await freshDb(), api(), key)).rejects.toBeInstanceOf(SyncTooNewError);
});

test('a wrong data key cannot read the cloud copy', async () => {
  await login();
  const db = await freshDb();
  await spend(db, 'x');
  await syncWithCloud(db, api(), key);
  await expect(syncWithCloud(await freshDb(), api(), newDataKey())).rejects.toThrow(/decrypted/);
});

test('a revoked token surfaces as an auth error', async () => {
  await expect(syncWithCloud(await freshDb(), new CloudApi('https://cloud.test', 'tok-9-' + 'x'.repeat(30)), key)).rejects.toBeInstanceOf(CloudAuthError);
});

test('receipt photos travel encrypted', async () => {
  await login();
  const phone = await freshDb();
  mockLocal.set('receipts/r1.jpg', toBase64(new Uint8Array([1, 2, 3, 4])));
  await spend(phone, 'with photo', 'receipts/r1.jpg');
  await syncWithCloud(phone, api(), key);
  expect([...cloud.receipts.keys()]).toEqual(['r1.jpg']);
  expect([...cloud.receipts.get('r1.jpg')!]).not.toEqual([1, 2, 3, 4]);

  mockLocal.clear();
  const tablet = await freshDb();
  await syncWithCloud(tablet, api(), key);
  expect(mockLocal.get('receipts/r1.jpg')).toBe(toBase64(new Uint8Array([1, 2, 3, 4])));
});

test('a quiet poll still fetches a photo another device uploaded after the data', async () => {
  await login();
  const phone = await freshDb();
  await spend(phone, 'with photo', 'receipts/r2.jpg');
  const first = await syncWithCloud(phone, api(), key); // data goes up, the photo is not on this phone yet
  expect(cloud.receipts.size).toBe(0);

  const tablet = await freshDb();
  const sync = await syncWithCloud(tablet, api(), key);
  expect(mockLocal.has('receipts/r2.jpg')).toBe(false);

  // The phone's photo arrives later, without any change to the data.
  mockLocal.set('receipts/r2.jpg', toBase64(new Uint8Array([9, 8, 7])));
  await syncWithCloud(phone, api(), key, first.version);
  expect(cloud.receipts.size).toBe(0); // quiet poll on the phone: nothing missing there, so no upload round

  await syncWithCloud(phone, api(), key); // full round after a change uploads it
  expect([...cloud.receipts.keys()]).toEqual(['r2.jpg']);

  await syncWithCloud(tablet, api(), key, sync.version);
  expect(mockLocal.get('receipts/r2.jpg')).toBe(toBase64(new Uint8Array([9, 8, 7])));
});

test('says so when the cloud refuses photos because storage is full', async () => {
  await login();
  const phone = await freshDb();
  mockLocal.set('receipts/big.jpg', toBase64(new Uint8Array([1])));
  await spend(phone, 'big', 'receipts/big.jpg');
  cloud.state.quotaFull = true;
  const result = await syncWithCloud(phone, api(), key);
  expect(result.photosFull).toBe(true);
  expect(cloud.receipts.size).toBe(0);
  cloud.state.quotaFull = false;
  expect((await syncWithCloud(phone, api(), key)).photosFull).toBe(false);
  expect(cloud.receipts.size).toBe(1);
});

describe('account flow', () => {
  const N = 1024;
  test('new account: create keys, then a second device unlocks with the passphrase or the recovery key', async () => {
    const a = new CloudApi('https://cloud.test');
    const first = await completeSignIn(a, 'umar@example.com', '123456', 'Phone', null);
    expect(first.next).toBe('create');
    const { session, recoveryKey } = await createKeys(new CloudApi('https://cloud.test', first.session.token), first.session, 'my passphrase', { N });
    expect(session.dataKey).toBeTruthy();

    const second = await completeSignIn(a, 'umar@example.com', '123456', 'Tablet', null);
    if (second.next !== 'unlock') throw new Error('expected unlock');
    expect(unlock(second.session, second.bundle, { passphrase: 'my passphrase' }).dataKey).toBe(session.dataKey);
    expect(unlock(second.session, second.bundle, { recoveryKey }).dataKey).toBe(session.dataKey);
    expect(() => unlock(second.session, second.bundle, { passphrase: 'nope' })).toThrow(WrongSecretError);
  });

  test('signing in again on the same device keeps the data key', async () => {
    const a = new CloudApi('https://cloud.test');
    const first = await completeSignIn(a, 'umar@example.com', '123456', 'Phone', null);
    const { session } = await createKeys(new CloudApi('https://cloud.test', first.session.token), first.session, 'pw', { N });
    const again = await completeSignIn(a, 'umar@example.com', '123456', 'Phone', session);
    expect(again.next).toBe('ready');
    expect(again.session.dataKey).toBe(session.dataKey);
    // A different email does not inherit it.
    const other = await completeSignIn(a, 'other@example.com', '123456', 'Phone', session);
    expect(other.next).toBe('unlock');
  });

  test('a wrong email code is rejected', async () => {
    await expect(completeSignIn(new CloudApi('https://cloud.test'), 'a@b.co', '000000', 'Phone', null)).rejects.toBeInstanceOf(CloudCodeError);
  });

  test('changing the passphrase keeps the recovery key working', async () => {
    const a = new CloudApi('https://cloud.test');
    const first = await completeSignIn(a, 'umar@example.com', '123456', 'Phone', null);
    const authed = new CloudApi('https://cloud.test', first.session.token);
    const { session, recoveryKey } = await createKeys(authed, first.session, 'old', { N });
    await setNewPassphrase(authed, session, 'new', { N });
    const second = await completeSignIn(a, 'umar@example.com', '123456', 'Tablet', null);
    if (second.next !== 'unlock') throw new Error('expected unlock');
    expect(unlock(second.session, second.bundle, { passphrase: 'new' }).dataKey).toBe(session.dataKey);
    expect(() => unlock(second.session, second.bundle, { passphrase: 'old' })).toThrow(WrongSecretError);
    expect(unlock(second.session, second.bundle, { recoveryKey }).dataKey).toBe(session.dataKey);
  });
});
