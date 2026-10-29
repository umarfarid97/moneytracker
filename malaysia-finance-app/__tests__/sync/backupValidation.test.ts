import { freshDb } from '../screens/helpers';
import { canonical, exportSnapshot } from '@/sync/snapshot';
import { parseBackup, restoreBackup } from '@/sync/backup';
import { writeReceiptBase64 } from '@/sync/receiptFiles';

jest.mock('@/sync/receiptFiles', () => ({
  isStoredReceipt: (s: unknown) => typeof s === 'string' && s.startsWith('receipts/'),
  readReceiptBase64: jest.fn(),
  writeReceiptBase64: jest.fn(async () => {}),
}));

test.each(['receipts/%2e%2e%2fx.pdf', 'receipts/a\\b.pdf', 'javascript:a.pdf'])('rejects all receipt-map entries before any writes: %s', async (key) => {
  jest.clearAllMocks();
  const db = await freshDb();
  const snap = await exportSnapshot(db);
  const backup = { ...snap, receipts: { 'receipts/valid.jpg': 'eA==', [key]: 'eA==' } };
  await expect(parseBackup(db, JSON.stringify(backup))).rejects.toThrow('Not a Duit backup');
  await expect(restoreBackup(db, backup)).rejects.toThrow('Not a Duit backup');
  expect(writeReceiptBase64).not.toHaveBeenCalled();
  expect(canonical(await exportSnapshot(db))).toBe(canonical(snap));
});
