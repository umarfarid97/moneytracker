import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Spending from '@/app/(tabs)/spending';
import { addExpenseRow, CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

describe('Spending', () => {
  test('lists this month by day with day totals and a month total', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-24', 'nasi lemak');
    await addExpenseRow(db, CAT.Transport, 500, '2026-10-24', 'LRT');
    await addExpenseRow(db, CAT.Makan, 2000, '2026-10-23', 'dinner');
    await addExpenseRow(db, CAT.Makan, 9900, '2026-09-30', 'last month');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('nasi lemak')).toBeTruthy();
    expect(screen.getByText('RM 17.50')).toBeTruthy();
    expect(screen.getAllByText('RM 20.00')).toHaveLength(2); // day total and the dinner row
    expect(screen.getByText('RM 37.50 spent this month')).toBeTruthy();
    expect(screen.queryByText('last month')).toBeNull();
  });

  test('previous month button shows the earlier month', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 9900, '2026-09-30', 'last month');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
    expect(screen.getByText('No spending recorded')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Previous month'));
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText('last month')).toBeTruthy();
  });

  test('tapping a row opens it for editing', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-24', 'nasi lemak');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('nasi lemak')).toBeTruthy());
    await fireEvent.press(screen.getByText('nasi lemak'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/add-expense', params: { id: '1' } });
  });

  test('rows without a note show the category name', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Kesihatan, 4500, '2026-10-24');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getAllByText('Kesihatan').length).toBeGreaterThan(0));
  });
});
