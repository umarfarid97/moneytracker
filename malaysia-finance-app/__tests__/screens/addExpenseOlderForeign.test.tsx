import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddExpense from '@/app/add-expense';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u, useReceiptVersion: () => 0 }));
jest.mock('@/receiptScan', () => ({ scanReceipt: jest.fn().mockResolvedValue(null) }));
const { router, useLocalSearchParams } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
});

describe('Ringgit-only spending form', () => {
  test('has no currency tag or rate field, and saves ringgit', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Change currency/ })).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Amount'), '12.50');
    await waitFor(() => expect(screen.getByLabelText('Amount').props.value).toBe('12.50'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.get('SELECT amount, currency, foreign_amount AS f, fx_rate AS r FROM expenses')).toEqual({ amount: 1250, currency: 'MYR', f: null, r: null });
  });

  test('older foreign spending still shows its original amount and keeps it when edited without changing the amount', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO expenses (amount, category_id, date, currency, foreign_amount, fx_rate) VALUES (6600, 1, '2026-10-20', 'SGD', 2000, 3.3)`);
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByText('Paid in SGD')).toBeTruthy());
    expect(screen.getByText('20.00 SGD at RM 3.3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Amount').props.value).toBe('66.00'));
    fireEvent.changeText(screen.getByLabelText('Note'), 'Lunch');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.get('SELECT amount, currency, foreign_amount AS f FROM expenses')).toEqual({ amount: 6600, currency: 'SGD', f: 2000 });
  });
});
