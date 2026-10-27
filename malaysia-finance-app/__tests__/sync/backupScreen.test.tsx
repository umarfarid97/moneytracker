import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Backup from '@/app/backup';
import { addExpense, listAllExpenses } from '@/db/repos/expenses';
import { createBackup } from '@/sync/backup';
import { SyncProvider } from '@/sync/SyncProvider';
import { CAT, freshDb, renderWithData } from '../screens/helpers';

// This test is about a build with no server address; the real address is set in cloudConfig.
jest.mock('@/sync/cloudConfig', () => ({ CLOUD_API_URL: '' }));
jest.mock('@/sync/googleAuth', () => ({
  googleAuth: {
    available: false,
    signIn: jest.fn(async () => ({ email: 'umar@example.com' })),
    getToken: jest.fn(async () => 'token'),
    refreshToken: jest.fn(async () => null),
    signOut: jest.fn(async () => {}),
  },
}));
jest.mock('@/sync/driveSync', () => ({
  ...jest.requireActual('@/sync/driveSync'),
  syncWithDrive: jest.fn(async () => ({ changedLocal: false })),
}));
jest.mock('@/sync/backupFile', () => ({ saveBackupFile: jest.fn(async () => {}), pickBackupFile: jest.fn() }));
jest.mock('@/sync/receiptFiles', () => ({
  RECEIPT_FILES: true,
  isStoredReceipt: (s: string | null) => !!s && s.startsWith('receipts/'),
  readReceiptBase64: jest.fn(async () => 'cGhvdG8='),
  writeReceiptBase64: jest.fn(async () => {}),
}));

const files = jest.requireMock('@/sync/backupFile');
const receipts = jest.requireMock('@/sync/receiptFiles');
const { confirmDelete } = jest.requireMock('@/ui/confirm');

beforeEach(() => {
  jest.clearAllMocks();
});

const show = async (db: Awaited<ReturnType<typeof freshDb>>) => {
  await renderWithData(db, <SyncProvider><Backup /></SyncProvider>);
  await waitFor(() => expect(screen.getByText('Backup file')).toBeTruthy());
};

test('says Duit cloud is not set up yet when the build has no server address', async () => {
  await show(await freshDb());
  expect(screen.getByText(/not set up in this version/)).toBeTruthy();
  expect(screen.queryByText('Set up')).toBeNull();
});

test('exports a backup file with data and receipt photos', async () => {
  const db = await freshDb();
  await addExpense(db, { amount: 1500, categoryId: CAT.Makan, date: '2026-10-01', note: 'nasi', receiptUri: 'receipts/r1.jpg' });
  await show(db);
  await fireEvent.press(screen.getByText('Export backup'));
  await waitFor(() => expect(screen.getByText(/Backup ready/)).toBeTruthy());
  const [name, text] = files.saveBackupFile.mock.calls[0];
  expect(name).toMatch(/^duit-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(text);
  expect(backup.tables.expenses[0].note).toBe('nasi');
  expect(backup.receipts).toEqual({ 'receipts/r1.jpg': 'cGhvdG8=' });
});

test('restores a backup after asking, replacing this device’s data', async () => {
  const source = await freshDb();
  await addExpense(source, { amount: 900, categoryId: CAT.Transport, date: '2026-10-02', note: 'grab', receiptUri: 'receipts/r2.jpg' });
  files.pickBackupFile.mockResolvedValue(await createBackup(source));

  const db = await freshDb();
  await addExpense(db, { amount: 100, categoryId: CAT.Makan, date: '2026-10-03', note: 'will go', receiptUri: null });
  await show(db);
  await fireEvent.press(screen.getByText('Restore from backup'));
  await waitFor(() => expect(screen.getByText('Backup restored.')).toBeTruthy());
  expect(confirmDelete).toHaveBeenCalledWith('Restore this backup?', expect.stringContaining('replaced'), 'Restore', 'Cancel');
  expect((await listAllExpenses(db)).map((e) => e.note)).toEqual(['grab']);
  expect(receipts.writeReceiptBase64).toHaveBeenCalledWith('receipts/r2.jpg', 'cGhvdG8=');
});

test('leaves data alone when the restore is cancelled or the file is not a backup', async () => {
  const db = await freshDb();
  await addExpense(db, { amount: 100, categoryId: CAT.Makan, date: '2026-10-03', note: 'stays', receiptUri: null });
  await show(db);

  files.pickBackupFile.mockResolvedValue('{"hello": 1}');
  await fireEvent.press(screen.getByText('Restore from backup'));
  await waitFor(() => expect(screen.getByText('That file is not a Duit backup.')).toBeTruthy());

  files.pickBackupFile.mockResolvedValue(await createBackup(await freshDb()));
  confirmDelete.mockResolvedValueOnce(false);
  await fireEvent.press(screen.getByText('Restore from backup'));
  await waitFor(() => expect(confirmDelete).toHaveBeenCalled());
  expect((await listAllExpenses(db)).map((e) => e.note)).toEqual(['stays']);
});
