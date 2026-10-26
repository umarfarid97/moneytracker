import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Home from '@/app/(tabs)/index';
import { addExpenseRow, CAT, freshDb, renderWithData, setBudgetRow } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

describe('Home', () => {
  test('shows today spent and a tile per category with left amount and status', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 60000);
    await setBudgetRow(db, CAT.Hiburan, '2026-10', 20000);
    await addExpenseRow(db, CAT.Makan, 8640, '2026-10-24');
    await addExpenseRow(db, CAT.Makan, 33360, '2026-10-10');
    await addExpenseRow(db, CAT.Hiburan, 26000, '2026-10-05');
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('RM 86.40')).toBeTruthy());
    expect(screen.getByText('Spent today')).toBeTruthy();
    expect(screen.getByText('RM 180.00 left')).toBeTruthy();
    expect(screen.getByText('On track')).toBeTruthy();
    expect(screen.getByText('RM 60.00 over')).toBeTruthy();
    expect(screen.getByText('Over budget')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Transport, RM 0.00 spent, No budget' })).toBeTruthy();
  });

  test('says how much is left for today', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 60000);
    await addExpenseRow(db, CAT.Makan, 2000, '2026-10-24');
    await addExpenseRow(db, CAT.Makan, 40000, '2026-10-10');
    await renderWithData(db, <Home />);
    // left at the start of today: 60000 - 40000 = 20000 over 8 days = 2500 a day, minus 2000 today = RM 5.00
    await waitFor(() => expect(screen.getByText('RM 5.00 left for today')).toBeTruthy());
  });

  test('says when today is already over the daily allowance', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 24000);
    await addExpenseRow(db, CAT.Makan, 8000, '2026-10-24');
    await renderWithData(db, <Home />);
    // 24000 over 8 days = 3000 a day; 8000 spent today -> RM 50.00 over
    await waitFor(() => expect(screen.getByText('RM 50.00 over for today')).toBeTruthy());
  });

  test('without budgets it asks to set one and opens the budget screen', async () => {
    const db = await freshDb();
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('Set a budget to see what is left for today')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Set a budget' }));
    expect(router.push).toHaveBeenCalledWith('/budget');
  });

  test('without budgets every category still has a tile that says no budget is set', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-24');
    await renderWithData(db, <Home />);
    const makan = await screen.findByRole('button', { name: 'Makan, RM 12.50 spent, No budget' });
    expect(screen.getAllByText('No budget').length).toBeGreaterThan(1);
    await fireEvent.press(makan);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/spending',
      params: expect.objectContaining({ categoryId: String(CAT.Makan) }),
    });
  });

  test('tapping a budget tile opens that category\'s spending', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 60000);
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('RM 600.00 left')).toBeTruthy());
    await fireEvent.press(screen.getByText('RM 600.00 left'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/spending',
      params: expect.objectContaining({ categoryId: String(CAT.Makan) }),
    });
    expect(router.push).not.toHaveBeenCalledWith('/budget');
  });

  test('shows RM 0.00 when nothing was spent today', async () => {
    const db = await freshDb();
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('RM 0.00')).toBeTruthy());
  });
});

describe('Home balance left', () => {
  test('shows take-home pay minus this month spending', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET gross_monthly = 600000, net_monthly_override = 500000');
    await addExpenseRow(db, CAT.Makan, 30000, '2026-10-03');
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('RM 4,700.00')).toBeTruthy());
    expect(screen.getByText('Balance left this month')).toBeTruthy();
  });

  test('asks for a salary when the profile has none and opens the profile', async () => {
    const db = await freshDb();
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('Add salary')).toBeTruthy());
    fireEvent.press(screen.getByText('Add salary'));
    expect(router.push).toHaveBeenCalledWith('/profile');
  });
});
