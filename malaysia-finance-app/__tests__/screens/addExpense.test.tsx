import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddExpense from '@/app/add-expense';
import { addExpenseRow, CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
const { router, useLocalSearchParams } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
});

describe('AddExpense (new)', () => {
  test('save stays disabled until the amount is valid', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.999');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.50');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('amount, category, save: stores today in sen and closes', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Transport' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const rows = await db.all<{ amount: number; category_id: number; date: string }>(
      'SELECT amount, category_id, date FROM expenses',
    );
    expect(rows).toEqual([{ amount: 1250, category_id: CAT.Transport, date: '2026-10-24' }]);
  });

  test('yesterday chip sets yesterday and an invalid typed date blocks saving', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Yesterday' }));
    expect(screen.getByLabelText('Date').props.value).toBe('2026-10-23');
    await fireEvent.changeText(screen.getByLabelText('Date'), '2026-02-30');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('AddExpense (edit)', () => {
  test('prefills from the saved expense, saves changes and can delete', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-20', 'nasi lemak');
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount').props.value).toBe('12.50'));
    expect(screen.getByLabelText('Note').props.value).toBe('nasi lemak');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '15');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect((await db.get<{ amount: number }>('SELECT amount FROM expenses WHERE id = 1'))!.amount).toBe(1500);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(2));
    expect(await db.get('SELECT id FROM expenses WHERE id = 1')).toBeNull();
  });
});
