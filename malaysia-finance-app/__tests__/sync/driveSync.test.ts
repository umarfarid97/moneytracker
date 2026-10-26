import { CAT, freshDb } from '../screens/helpers';
import { addExpense, listAllExpenses } from '@/db/repos/expenses';
import { DriveAuthError } from '@/sync/drive';
import { syncWithDrive, SYNC_FILE, SyncTooNewError } from '@/sync/driveSync';

jest.mock('@/sync/receiptFiles', () => ({
  RECEIPT_FILES: true,
  isStoredReceipt: (s: string | null) => !!s && s.startsWith('receipts/'),
  receiptExists: jest.fn((s: string) => s === 'receipts/here.jpg'),
  uploadReceipt: jest.fn(async () => {}),
  downloadReceipt: jest.fn(async () => {}),
}));
const receipts = jest.requireMock('@/sync/receiptFiles');

/** An in-memory appDataFolder behind the handful of Drive endpoints sync uses. */
function fakeDrive() {
  const files = new Map<string, { name: string; text: string }>();
  let next = 1;
  let token = 'good';
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const auth = (init.headers as Record<string, string>).Authorization;
    if (auth !== `Bearer ${token}`) return new Response('', { status: 401 });
    const u = new URL(url);
    const id = u.pathname.split('/files/')[1];
    if (u.pathname.endsWith('/files') && (init.method ?? 'GET') === 'GET') {
      return Response.json({ files: [...files].map(([fid, f]) => ({ id: fid, name: f.name })) });
    }
    if (id && u.searchParams.get('alt') === 'media') return new Response(files.get(id)!.text);
    if (id && init.method === 'PATCH') {
      files.get(id)!.text = String(init.body);
      return Response.json({ id });
    }
    if (u.searchParams.get('uploadType') === 'multipart') {
      const boundary = /boundary=(\S+)/.exec((init.headers as Record<string, string>)['Content-Type'])![1];
      const [meta, content] = String(init.body)
        .split(`--${boundary}`)
        .slice(1, 3)
        .map((part) => part.slice(part.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, ''));
      const fid = `f${next++}`;
      files.set(fid, { name: JSON.parse(meta).name, text: content });
      return Response.json({ id: fid });
    }
    throw new Error(`unexpected ${init.method} ${url}`);
  });
  return { files, fetchMock, expire: () => { token = 'fresh'; } };
}

let drive: ReturnType<typeof fakeDrive>;
beforeEach(() => {
  drive = fakeDrive();
  global.fetch = drive.fetchMock as unknown as typeof fetch;
  jest.clearAllMocks();
});

const spend = (db: Awaited<ReturnType<typeof freshDb>>, note: string, receiptUri: string | null = null) =>
  addExpense(db, { amount: 1000, categoryId: CAT.Makan, date: '2026-10-01', note, receiptUri });

test('first device uploads its data; a second device gets it and adds its own', async () => {
  const phone = await freshDb();
  await spend(phone, 'nasi');
  expect(await syncWithDrive(phone, 'good')).toEqual({ changedLocal: false });
  expect([...drive.files.values()].map((f) => f.name)).toEqual([SYNC_FILE]);

  const tablet = await freshDb();
  await spend(tablet, 'teh');
  expect(await syncWithDrive(tablet, 'good')).toEqual({ changedLocal: true });
  await syncWithDrive(phone, 'good');
  expect((await listAllExpenses(phone)).map((e) => e.note).sort()).toEqual(['nasi', 'teh']);
  expect(drive.files.size).toBe(1);
});

test('does not upload when nothing changed', async () => {
  const phone = await freshDb();
  await syncWithDrive(phone, 'good');
  drive.fetchMock.mockClear();
  await syncWithDrive(phone, 'good');
  expect(drive.fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
});

test('refuses Drive data from a newer app version', async () => {
  const phone = await freshDb();
  await syncWithDrive(phone, 'good');
  const file = [...drive.files.values()][0];
  file.text = JSON.stringify({ ...JSON.parse(file.text), schema: 99 });
  await expect(syncWithDrive(phone, 'good')).rejects.toBeInstanceOf(SyncTooNewError);
});

test('reports an expired token', async () => {
  const phone = await freshDb();
  drive.expire();
  await expect(syncWithDrive(phone, 'good')).rejects.toBeInstanceOf(DriveAuthError);
});

test('uploads receipt photos Drive lacks and downloads missing ones', async () => {
  const phone = await freshDb();
  await spend(phone, 'a', 'receipts/here.jpg');
  await spend(phone, 'b', 'receipts/elsewhere.jpg');
  drive.files.set('r1', { name: 'elsewhere.jpg', text: '' });
  await syncWithDrive(phone, 'good');
  expect(receipts.uploadReceipt).toHaveBeenCalledWith('good', 'receipts/here.jpg', 'here.jpg');
  expect(receipts.downloadReceipt).toHaveBeenCalledWith('good', 'r1', 'receipts/elsewhere.jpg');
});
