import { freshDb, CAT } from '../screens/helpers';
import { addExpense } from '@/db/repos/expenses';
import { createBackup, parseBackup, restoreBackup } from '@/sync/backup';
import { exportSnapshot } from '@/sync/snapshot';

jest.mock('expo-file-system', () => {
  class Directory { exists = true; }
  class File {
    uri: string;
    exists = true;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).join('/'); }
    async base64() { return 'cGhvdG8='; }
    async write() {}
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});

test('normalizes a supported local legacy receipt before backup and sync export', async () => {
  const db = await freshDb();
  await addExpense(db, { amount: 100, categoryId: CAT.Makan, date: '2026-10-01', note: 'legacy', receiptUri: 'file:///docs/receipts/old.jpg' });
  const snapshot = await exportSnapshot(db);
  expect(snapshot.tables.expenses[0].receipt_uri).toBe('receipts/old.jpg');
  const text = await createBackup(db);
  const target = await freshDb();
  await restoreBackup(target, await parseBackup(target, text));
  expect((await exportSnapshot(target)).tables.expenses[0].receipt_uri).toBe('receipts/old.jpg');
  expect(JSON.parse(text).receipts).toEqual({ 'receipts/old.jpg': 'cGhvdG8=' });
});
