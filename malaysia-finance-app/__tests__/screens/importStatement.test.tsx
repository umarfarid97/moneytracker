import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import ImportStatement from '@/app/import-statement';
import { CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/statementFile', () => ({ pickStatementFile: jest.fn() }));
const { pickStatementFile } = jest.requireMock('@/statementFile');

const CSV = [
  'Date,Description,Debit,Credit,Balance',
  '01/10/2026,PETRONAS STATION,50.00,,950.00',
  '02/10/2026,SALARY,,3000.00,3950.00',
  '03/10/2026,MAMAK ABC,12.50,,3937.50',
].join('\n');

const rows = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ amount: number; note: string; category_id: number; date: string }>('SELECT amount, note, category_id, date FROM expenses ORDER BY date');

async function load(db: Awaited<ReturnType<typeof freshDb>>, text = CSV) {
  pickStatementFile.mockResolvedValueOnce({ name: 'maybank.csv', kind: 'csv', text });
  await renderWithData(db, <ImportStatement />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose CSV or PDF file' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Choose CSV or PDF file' }));
}

beforeEach(() => jest.clearAllMocks());

describe('Import statement screen', () => {
  test('previews spending lines, skips money in, and imports the ticked ones', async () => {
    const db = await freshDb();
    await load(db);
    await waitFor(() => expect(screen.getByText('2 spending lines in maybank.csv')).toBeTruthy());
    expect(screen.getByText('1 money-in lines skipped')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Include Mamak Abc' }));
    expect(screen.getByRole('button', { name: 'Import 1 · RM 50.00' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Import 1 · RM 50.00' }));
    await waitFor(() => expect(screen.getByText('Imported 1 spending lines.')).toBeTruthy());
    expect(await rows(db)).toEqual([{ amount: 5000, note: 'Petronas Station', category_id: CAT.Transport, date: '2026-10-01' }]);
  });

  test('a line can be edited and merged into the one above', async () => {
    const db = await freshDb();
    await load(db);
    await waitFor(() => expect(screen.getByText('2 spending lines in maybank.csv')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Mamak Abc' }));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.7x5');
    expect(screen.getByLabelText('Amount').props.value).toBe('12.75');
    await fireEvent.press(screen.getByRole('button', { name: 'Merge Mamak Abc into the line above' }));
    await waitFor(() => expect(screen.getByText('1 spending lines in maybank.csv')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /^Import 1/ }));
    await waitFor(() => expect(screen.getByText('Imported 1 spending lines.')).toBeTruthy());
    expect(await rows(db)).toEqual([expect.objectContaining({ amount: 6275, note: 'Petronas Station + Mamak Abc', date: '2026-10-01' })]);
  });

  test('a line that matches existing spending starts unticked', async () => {
    const db = await freshDb();
    await db.run('INSERT INTO expenses (amount, category_id, date, note) VALUES (?, ?, ?, ?)', [5000, CAT.Transport, '2026-10-01', 'Petrol']);
    await load(db);
    await waitFor(() => expect(screen.getByText('Already added?')).toBeTruthy());
    expect(screen.getByRole('checkbox', { name: 'Include Petronas Station' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Import 1 · RM 12.50' })).toBeTruthy();
  });

  test('says so when the file has no transactions', async () => {
    const db = await freshDb();
    await load(db, 'hello,world');
    await waitFor(() => expect(screen.getByText(/No transactions found/)).toBeTruthy());
  });
});
