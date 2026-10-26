import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddExpense from '@/app/add-expense';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u }));
jest.mock('@/receiptScan', () => ({ scanReceipt: jest.fn().mockResolvedValue(null) }));
jest.mock('@/fx', () => ({ loadCachedRates: jest.fn(), fetchRates: jest.fn() }));
const { loadCachedRates, fetchRates } = jest.requireMock('@/fx');
const { router, useLocalSearchParams } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
  loadCachedRates.mockResolvedValue(null);
  fetchRates.mockResolvedValue(null);
});

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('Spending in another currency', () => {
  test('uses the live rate, shows what it counts as, and stores both amounts', async () => {
    fetchRates.mockResolvedValue({ perUnit: { SGD: 3.3 }, fetchedAt: Date.now() });
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'SGD' }));
    await waitFor(() => expect(screen.getByLabelText('1 SGD = RM').props.value).toBe('3.3'));
    await type('Amount in SGD', '20');
    expect(screen.getByTestId('fx-counts').props.children).toBe('Counts as RM 66.00');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.get('SELECT amount, currency, foreign_amount AS f, fx_rate AS r FROM expenses')).toEqual({
      amount: 6600, currency: 'SGD', f: 2000, r: 3.3,
    });
  });

  test('a rate typed by hand wins over the live one, and works with no rates at all (offline)', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'USD' }));
    await type('Amount in USD', '10');
    // No rate yet: nothing to save.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await type('1 USD = RM', '4.5');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.get('SELECT amount, currency, foreign_amount AS f FROM expenses')).toEqual({ amount: 4500, currency: 'USD', f: 1000 });
  });

  test('a saved rate from an earlier trip is used while offline', async () => {
    loadCachedRates.mockResolvedValue({ perUnit: { THB: 0.13 }, fetchedAt: Date.now() });
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'THB' }));
    await waitFor(() => expect(screen.getByLabelText('1 THB = RM').props.value).toBe('0.13'));
    await type('Amount in THB', '1000');
    expect(screen.getByTestId('fx-counts').props.children).toBe('Counts as RM 130.00');
  });

  test('ringgit spending is unchanged', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await type('Amount', '12.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.get('SELECT amount, currency, foreign_amount AS f, fx_rate AS r FROM expenses')).toEqual({
      amount: 1250, currency: 'MYR', f: null, r: null,
    });
  });

  test('editing foreign spending shows the original amount and rate', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO expenses (amount, category_id, date, currency, foreign_amount, fx_rate) VALUES (6600, 1, '2026-10-20', 'SGD', 2000, 3.3)`);
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByText('Paid in SGD')).toBeTruthy());
    expect(screen.getByText('20.00 SGD at RM 3.3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Amount in SGD').props.value).toBe('20.00'));
    expect(screen.getByLabelText('1 SGD = RM').props.value).toBe('3.3');
  });
});
