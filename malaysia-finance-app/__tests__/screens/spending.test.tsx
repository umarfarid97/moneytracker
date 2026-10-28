import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Spending from '@/app/(tabs)/spending';
import { addExpenseRow, CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

async function addBill(db: Awaited<ReturnType<typeof freshDb>>, name: string, day: number, amount = 3000, extra = '') {
  await db.run(
    `INSERT INTO commitments (name, amount, day_of_month, kind, active, auto_record, start_date, variable${extra ? ', starts_on' : ''}) VALUES (?, ?, ?, 'bill', 1, 0, '2026-10-01', 0${extra ? ', ?' : ''})`,
    extra ? [name, amount, day, extra] : [name, amount, day],
  );
}

describe('Spending: pending bills', () => {
  test('due bills show as pending, are not counted as spent, and become a normal transaction once marked paid', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1000, '2026-10-24', 'nasi');
    await addBill(db, 'Internet', 30);
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('Internet')).toBeTruthy());
    expect(screen.getByText('Pending bills')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText(/^Due (\w{3} )?30 Oct$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid Internet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm paid' }));
    await waitFor(() => expect(screen.queryByTestId('pending-row')).toBeNull());
    expect(screen.queryByTestId('pending-row')).toBeNull();
    expect(screen.queryByText('Pending bills')).toBeNull();
    expect(screen.getByText('Internet')).toBeTruthy(); // now a real transaction
    const rows = await db.all<{ date: string; due_date: string }>('SELECT date, due_date FROM expenses WHERE commitment_id IS NOT NULL');
    expect(rows).toEqual([{ date: '2026-10-24', due_date: '2026-10-30' }]);
  });

  test('bills due in a later period are not shown', async () => {
    const db = await freshDb();
    await addBill(db, 'Gym', 25, 5000, '2026-11-25');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
    expect(screen.queryByText('Gym')).toBeNull();
  });

  test('the Bills switch hides pending bills and the Filters toggle reflects it', async () => {
    const db = await freshDb();
    await addBill(db, 'Internet', 30);
    await db.run("INSERT INTO app_settings (key, value) VALUES ('showPendingBills', '0')");
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('pending-row')).toBeNull());
    await fireEvent.press(screen.getByText('Filters'));
    await fireEvent.press(screen.getByText('Show pending bills'));
    await waitFor(() => expect(screen.getByTestId('pending-row')).toBeTruthy());
  });

  test('pending bills can be hidden from the filters', async () => {
    const db = await freshDb();
    await addBill(db, 'Internet', 30);
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('Internet')).toBeTruthy());
    await fireEvent.press(screen.getByText('Filters'));
    await fireEvent.press(screen.getByText('Show pending bills'));
    expect(screen.queryByTestId('pending-row')).toBeNull();
  });
});

describe('Spending month setting', () => {
  test('follows its own start day, not the salary day', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET budget_start_day = 25, spending_start_day = 1');
    await addExpenseRow(db, CAT.Makan, 1000, '2026-10-24', 'in october');
    await addExpenseRow(db, CAT.Makan, 2000, '2026-09-30', 'in september');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('in october')).toBeTruthy());
    expect(screen.getByTestId('month-range').props.children).toBe('1 Oct - 31 Oct');
    expect(screen.queryByText('in september')).toBeNull();
  });

  test('a mid-month start day names the cycle after the month it ends in', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET spending_start_day = 25');
    await addExpenseRow(db, CAT.Makan, 1000, '2026-10-24', 'cycle expense');
    await addExpenseRow(db, CAT.Makan, 2000, '2026-10-25', 'next cycle');
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('cycle expense')).toBeTruthy());
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByTestId('month-range').props.children).toBe('25 Sep - 24 Oct');
    expect(screen.queryByText('next cycle')).toBeNull();
  });
});

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
    expect(screen.getByTestId('month-range').props.children).toBe('1 Oct - 31 Oct');
    expect(screen.queryByText(/spent this month/)).toBeNull();
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
