import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Spending from '@/app/(tabs)/spending';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));

type TestDb = Awaited<ReturnType<typeof freshDb>>;
beforeEach(() => jest.clearAllMocks());

async function row(db: TestDb, o: { amount: number; cat?: number; note: string; method?: number | null; relief?: string | null; receipt?: string | null; date?: string }) {
  await db.run(
    'INSERT INTO expenses (amount, category_id, date, note, payment_method_id, relief_id, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [o.amount, o.cat ?? 1, o.date ?? '2026-10-24', o.note, o.method === undefined ? 1 : o.method, o.relief ?? null, o.receipt ?? null],
  );
}
async function seeded() {
  const db = await freshDb();
  await row(db, { amount: 1250, note: 'Nasi lemak', method: 1 });
  await row(db, { amount: 8500, cat: 6, note: 'Klinik Dr Ali', method: 3, relief: 'medical-serious', receipt: null });
  await row(db, { amount: 4000, cat: 6, note: 'Farmasi', method: 3, relief: 'medical-serious', receipt: 'receipts/a.jpg' });
  await row(db, { amount: 700, note: 'Roti', method: null });
  await renderWithData(db, <Spending />);
  await waitFor(() => expect(screen.getByText('Nasi lemak')).toBeTruthy());
  return db;
}
const shown = () => screen.queryAllByTestId('spending-note').map((n) => n.props.children);

describe('Spending: totals by payment method', () => {
  test('shows what was paid with each method this month, biggest first', async () => {
    await seeded();
    expect(screen.getByText('By payment method')).toBeTruthy();
    expect(screen.getByTestId('method-total-3').props.children).toBe('RM 125.00');
    expect(screen.getByTestId('method-total-1').props.children).toBe('RM 12.50');
    expect(screen.getByTestId('method-total-none').props.children).toBe('RM 7.00');
    expect(screen.getByText('No method')).toBeTruthy();
  });
});

describe('Spending: search', () => {
  test('finds spending by note, category or method and says when nothing matches', async () => {
    await seeded();
    await fireEvent.changeText(screen.getByLabelText('Search spending'), 'klinik');
    expect(shown()).toEqual(['Klinik Dr Ali']);
    await fireEvent.changeText(screen.getByLabelText('Search spending'), 'credit card');
    expect(shown()).toEqual(['Farmasi', 'Klinik Dr Ali']); // newest first within a day
    await fireEvent.changeText(screen.getByLabelText('Search spending'), 'zzz');
    expect(screen.getByText('Nothing matches these filters')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search spending'), '');
    expect(shown()).toHaveLength(4);
  });
});

describe('Spending: filters', () => {
  test('filter by category, then clear', async () => {
    await seeded();
    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filter category Kesihatan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(shown().sort()).toEqual(['Farmasi', 'Klinik Dr Ali']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeTruthy();
    expect(screen.getByText('Showing 2 of 4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Filters (1)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(shown()).toHaveLength(4);
  });

  test('filter by payment method', async () => {
    await seeded();
    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filter method Cash' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(shown()).toEqual(['Nasi lemak']);
  });

  test('tax relief only, and missing receipt', async () => {
    await seeded();
    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tax relief only' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(shown().sort()).toEqual(['Farmasi', 'Klinik Dr Ali']);
    await fireEvent.press(screen.getByRole('button', { name: 'Filters (1)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Missing receipt' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(shown()).toEqual(['Klinik Dr Ali']);
    expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeTruthy();
  });
});

describe('Spending: row details', () => {
  test('rows show the payment method, a tax relief badge and a missing-receipt warning', async () => {
    await seeded();
    expect(screen.getAllByText('Tax relief')).toHaveLength(2);
    expect(screen.getAllByText('Receipt missing')).toHaveLength(1);
    expect(screen.getAllByText('Credit card').length).toBeGreaterThan(0);
  });
});

describe('Spending: opened from a Home tile', () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router');
  afterEach(() => useLocalSearchParams.mockImplementation(() => ({})));

  test('shows only that category this month, and the chip clears it', async () => {
    useLocalSearchParams.mockImplementation(() => ({ categoryId: '6', at: '1' }));
    const db = await freshDb();
    await row(db, { amount: 1250, note: 'Nasi lemak' });
    await row(db, { amount: 8500, cat: 6, note: 'Klinik Dr Ali' });
    await row(db, { amount: 3000, cat: 6, note: 'Klinik last month', date: '2026-09-20' });
    await renderWithData(db, <Spending />);
    await waitFor(() => expect(screen.getByText('Klinik Dr Ali')).toBeTruthy());
    expect(shown()).toEqual(['Klinik Dr Ali']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Showing Kesihatan only. Show all categories' }));
    expect(shown().sort()).toEqual(['Klinik Dr Ali', 'Nasi lemak']);
  });
});
