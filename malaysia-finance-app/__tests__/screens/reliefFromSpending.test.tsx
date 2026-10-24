import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Tax from '@/app/(tabs)/tax';
import TaxCalculator from '@/app/tax-calculator';
import Relief from '@/app/relief/[id]';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2025-12-01' }));
jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u }));
const { router, useLocalSearchParams } = jest.requireMock('expo-router');

type TestDb = Awaited<ReturnType<typeof freshDb>>;
beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({ id: 'lifestyle' });
});

async function spending(db: TestDb, over: { amount?: number; relief?: string | null; claim?: number | null; receipt?: string | null; date?: string; note?: string } = {}) {
  await db.run(
    'INSERT INTO expenses (amount, category_id, date, note, receipt_uri, relief_id, relief_amount) VALUES (?, 1, ?, ?, ?, ?, ?)',
    [over.amount ?? 100000, over.date ?? '2025-06-10', over.note ?? 'Phone', over.receipt ?? null, over.relief === undefined ? 'lifestyle' : over.relief, over.claim ?? null],
  );
}

describe('Tax tab counts relief-tagged spending', () => {
  test('adds the claimable part of tagged spending to the total, once', async () => {
    const db = await freshDb();
    await spending(db, { amount: 100000, receipt: 'receipts/a.jpg' });
    await spending(db, { amount: 50000, claim: 20000, receipt: 'receipts/b.jpg', note: 'Book' });
    await spending(db, { amount: 77700, relief: null });
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByTestId('total-relief').props.children).toBe('RM 10,200.00'));
    expect(screen.getByText('RM 1,200.00 of RM 2,500.00')).toBeTruthy();
  });

  test('manual claims and tagged spending add up together and are capped together', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri) VALUES ('lifestyle', 2025, 200000, 'x')");
    await spending(db, { amount: 100000, receipt: 'receipts/a.jpg' });
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByTestId('total-relief').props.children).toBe('RM 11,500.00'));
    expect(screen.getByText('RM 500.00 is above the limit and cannot be claimed')).toBeTruthy();
  });

  test('warns about tagged spending that has no receipt', async () => {
    const db = await freshDb();
    await spending(db, { receipt: null });
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByText('Receipt missing')).toBeTruthy());
  });

  test('spending from another year is not counted', async () => {
    const db = await freshDb();
    await spending(db, { date: '2024-12-31', receipt: 'x' });
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByTestId('total-relief').props.children).toBe('RM 9,000.00'));
  });
});

describe('Tax calculator counts relief-tagged spending', () => {
  test('uses the claimable amount in the reliefs line', async () => {
    const db = await freshDb();
    await spending(db, { amount: 100000, claim: 60000, receipt: 'x' });
    await renderWithData(db, <TaxCalculator />);
    await waitFor(() => expect(screen.getByLabelText('Salary for the year')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Salary for the year'), '60000');
    expect(screen.getByTestId('reliefs').props.children).toBe('RM 9,600.00');
  });
});

describe('Relief page lists spending linked to the relief', () => {
  test('shows the linked spending with date, amount and claimable part, and opens it when tapped', async () => {
    const db = await freshDb();
    await spending(db, { amount: 100000, claim: 60000, receipt: null, note: 'Phone case', date: '2025-06-10' });
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText('Phone case')).toBeTruthy());
    expect(screen.getByText('From spending · 10 Jun')).toBeTruthy();
    expect(screen.getByText('RM 600.00 of RM 1,000.00')).toBeTruthy();
    expect(screen.getByText('Receipt missing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    await fireEvent.press(screen.getByText('Phone case'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/add-expense', params: { id: '1' } });
  });

  test('manual claims stay deletable and the headline counts both', async () => {
    const db = await freshDb();
    await spending(db, { amount: 100000, receipt: 'x', note: 'Phone' });
    await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri, note) VALUES ('lifestyle', 2025, 90000, 'x', 'Book')");
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText('Book')).toBeTruthy());
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    expect(screen.getByText('RM 1,900.00 of RM 2,500.00')).toBeTruthy();
  });
});
