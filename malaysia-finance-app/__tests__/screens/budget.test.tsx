import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Budget from '@/app/budget';
import { CAT, freshDb, renderWithData, setBudgetRow } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

const budgetsIn = (db: Awaited<ReturnType<typeof freshDb>>, month = '2026-10') =>
  db.all<{ category_id: number; limit_sen: number }>(
    'SELECT category_id, limit_sen FROM budgets WHERE month = ? ORDER BY category_id',
    [month],
  );

describe('Budget', () => {
  test('shows the month and a field for every category', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
    for (const name of ['Makan', 'Transport', 'Bil', 'Rumah', 'Hiburan', 'Kesihatan', 'Pendidikan', 'Lain-lain']) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
  });

  test('typing limits updates the total and save stores them in sen', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Makan')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Makan'), '600');
    await fireEvent.changeText(screen.getByLabelText('Transport'), '35.50');
    expect(screen.getByTestId('budget-total').props.children).toBe('RM 635.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await budgetsIn(db)).toEqual([
      { category_id: CAT.Makan, limit_sen: 60000 },
      { category_id: CAT.Transport, limit_sen: 3550 },
    ]);
  });

  test('prefills existing limits; clearing a field removes that budget; others stay', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 60000);
    await setBudgetRow(db, CAT.Bil, '2026-10', 25000);
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Makan').props.value).toBe('600.00'));
    await fireEvent.changeText(screen.getByLabelText('Makan'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await budgetsIn(db)).toEqual([{ category_id: CAT.Bil, limit_sen: 25000 }]);
  });

  test('letters and extra decimals are dropped as you type', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Makan')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Makan'), '12a.999');
    expect(screen.getByLabelText('Makan').props.value).toBe('12.99');
  });

  test('zero is a valid budget and means any spending is over', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Hiburan')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Hiburan'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await budgetsIn(db)).toEqual([{ category_id: CAT.Hiburan, limit_sen: 0 }]);
  });

  test('copy last month fills the fields from last month without overwriting this month', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-09', 50000);
    await setBudgetRow(db, CAT.Transport, '2026-09', 30000);
    await setBudgetRow(db, CAT.Transport, '2026-10', 35000);
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Transport').props.value).toBe('350.00'));
    await fireEvent.press(screen.getByRole('button', { name: 'Copy last month' }));
    await waitFor(() => expect(screen.getByLabelText('Makan').props.value).toBe('500.00'));
    expect(screen.getByLabelText('Transport').props.value).toBe('350.00');
  });
});
