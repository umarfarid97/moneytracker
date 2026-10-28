import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Budget from '@/app/budget';
import BudgetEdit from '@/app/budget-edit';
import Profile from '@/app/profile';
import { CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

const startDay = async (db: Awaited<ReturnType<typeof freshDb>>) =>
  (await db.get<{ budget_start_day: number }>('SELECT budget_start_day FROM profile'))!.budget_start_day;

describe('Budget period', () => {
  test('is the calendar month until a payday is chosen', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeTruthy());
    expect(await startDay(db)).toBe(1);
  });

  test('a payday on the 25th starts the period on 25 Sep today, and budgets are saved under it', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Salary day: Day 1')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Salary day: Day 1'));
    await fireEvent.press(screen.getByLabelText('Budget starts on day 25'));
    await waitFor(() => expect(screen.getByText('25 Sep - 24 Oct')).toBeTruthy());
    expect(screen.getByText('1 day left')).toBeTruthy();
    expect(await startDay(db)).toBe(25);
  });

  test('the salary day on the profile is the budget start day', async () => {
    const db = await freshDb();
    await renderWithData(db, <Profile />);
    await waitFor(() => expect(screen.getByLabelText('Salary day: Day 1')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Salary day: Day 1'));
    await fireEvent.press(screen.getByLabelText('Budget starts on day 25'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    expect(await startDay(db)).toBe(25);
  });

  test('budgets typed on the edit page are saved under the payday period', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET budget_start_day = 25');
    await renderWithData(db, <BudgetEdit />);
    await waitFor(() => expect(screen.getByText('25 Sep - 24 Oct')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Makan'), '600');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.all('SELECT category_id, month, limit_sen FROM budgets')).toEqual([
      { category_id: CAT.Makan, month: '2026-09', limit_sen: 60000 },
    ]);
  });

  test('the picker offers every day from 1 to 31, saves on pick, and 31 reads as the last day', async () => {
    const db = await freshDb();
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByLabelText('Salary day: Day 1')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Salary day: Day 1'));
    expect(screen.getAllByLabelText(/^Budget starts on day \d+$/)).toHaveLength(30);
    await fireEvent.press(screen.getByLabelText('Budget starts on day 26'));
    await waitFor(async () => expect(await startDay(db)).toBe(26));
    await fireEvent.press(screen.getByLabelText('Salary day: Day 26'));
    await fireEvent.press(screen.getByLabelText('Budget starts on the last day'));
    await waitFor(async () => expect(await startDay(db)).toBe(31));
    await waitFor(() => expect(screen.getByText('30 Sep - 30 Oct')).toBeTruthy());
    expect(screen.getByLabelText('Salary day: Last day')).toBeTruthy();
  });
});
