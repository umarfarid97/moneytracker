import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Home from '@/app/(tabs)/index';
import CustomizeHome from '@/app/customize-home';
import { getSetting } from '@/db/repos/appSettings';
import { addExpenseRow, CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/ui/confirm', () => ({ confirmDelete: jest.fn(async () => true) }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
/** Lets the pending database write finish, then returns what was saved. */
const savedLayout = async (db: Awaited<ReturnType<typeof freshDb>>) => {
  await Promise.resolve();
  return JSON.parse((await getSetting(db, 'homeLayout')) ?? '{}');
};
const toggle = (name: string) => fireEvent.press(screen.getByRole('switch', { name }));

describe('Customize Home', () => {
  test('Home opens the customize screen', async () => {
    const db = await freshDb();
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('Spent today')).toBeTruthy());
    press('Customize Home');
    expect(router.push).toHaveBeenCalledWith('/customize-home');
  });

  test('the default Home shows no optional cards', async () => {
    const db = await freshDb();
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('Spent today')).toBeTruthy());
    expect(screen.getByText('This month by category')).toBeTruthy();
    expect(screen.queryByText('Recent spending')).toBeNull();
    expect(screen.queryByText('Bills coming up')).toBeNull();
  });

  test('turning on a card, hiding a category and reordering are saved and shown on Home', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-24');
    await renderWithData(db, <CustomizeHome />);
    await waitFor(() => expect(screen.getByText('Recent spending')).toBeTruthy());

    toggle('Show Recent spending');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Hide Recent spending' })).toBeTruthy());
    toggle('Hide Transport');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show Transport' })).toBeTruthy());
    press('Move Recent spending up'); // above "Bills coming up"
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Recent spending down' }).props.accessibilityState.disabled).toBe(false));
    const saved = await savedLayout(db);
    expect(saved.visible.recent).toBe(true);
    expect(saved.categoryHidden).toEqual([CAT.Transport]);
    expect(saved.order.indexOf('recent')).toBeLessThan(saved.order.indexOf('upcomingBills'));
  });

  test('Home follows a saved layout: card order, hidden cards and chosen categories', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-24');
    const layout = {
      order: ['categories', 'recent', 'today'],
      visible: { recent: true, balance: false, getStarted: false },
      categoryOrder: [CAT.Bil, CAT.Makan],
      categoryHidden: [CAT.Transport],
    };
    await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['homeLayout', JSON.stringify(layout)]);
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('Recent spending')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Makan, RM 12.50 spent, No budget' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Transport/ })).toBeNull();
    expect(screen.queryByText('Balance left this month')).toBeNull();
    const text = JSON.stringify(screen.toJSON());
    expect(text.indexOf('This month by category')).toBeLessThan(text.indexOf('Recent spending'));
    expect(text.indexOf('Recent spending')).toBeLessThan(text.indexOf('Spent today'));
    expect(text.indexOf('"Bil, RM')).toBeGreaterThan(-1);
    expect(text.indexOf('"Bil, RM')).toBeLessThan(text.indexOf('"Makan, RM'));
  });

  test('a card moved down swaps places and the first and last rows cannot move further', async () => {
    const db = await freshDb();
    await renderWithData(db, <CustomizeHome />);
    await waitFor(() => expect(screen.getByText('Spent today')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Move Spent today up' }).props.accessibilityState.disabled).toBe(true);
    press('Move Spent today down');
    expect((await savedLayout(db)).order.slice(0, 2)).toEqual(['balance', 'today']);
  });

  test('Reset puts everything back', async () => {
    const db = await freshDb();
    await renderWithData(db, <CustomizeHome />);
    await waitFor(() => expect(screen.getByText('Recent spending')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Reset to default' }).props.accessibilityState.disabled).toBe(true);
    toggle('Show Zakat and giving');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Hide Zakat and giving' })).toBeTruthy());
    press('Reset to default');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show Zakat and giving' })).toBeTruthy());
  });
});

describe('optional Home cards', () => {
  test('every optional card renders with data or its empty state', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 4000, '2026-10-24', 'Nasi lemak');
    const all = ['upcomingBills', 'recent', 'topCategory', 'weeklyTrend', 'savings', 'netWorth', 'epf', 'owed', 'loans', 'taxRelief', 'zakat'];
    await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['homeLayout', JSON.stringify({ visible: Object.fromEntries(all.map((id) => [id, true])) })]);
    await renderWithData(db, <Home />);
    await waitFor(() => expect(screen.getByText('Recent spending')).toBeTruthy());
    expect(screen.getByText('Nasi lemak')).toBeTruthy();
    expect(screen.getByText('No bills coming up. Add them under Bills.')).toBeTruthy();
    expect(screen.getByText('Biggest category')).toBeTruthy();
    expect(screen.getByText('100% of the RM 40.00 spent this month')).toBeTruthy();
    expect(screen.getByText('Last 7 days')).toBeTruthy();
    for (const title of ['Savings and goals', 'Net worth', 'EPF balance', 'Buku owed and owing', 'Loan progress', 'Tax relief', 'Zakat and giving']) {
      expect(screen.getByRole('button', { name: title })).toBeTruthy();
    }
    press('Net worth');
    expect(router.push).toHaveBeenCalledWith('/net-worth');
  });
});
