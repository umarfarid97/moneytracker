import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Commitments from '@/app/(tabs)/commitments';
import { BillsSync } from '@/features/commitments/BillsSync';
import { DataProvider } from '@/hooks/DataProvider';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/notifications', () => ({ scheduleReminders: jest.fn(async () => 0), configureNotifications: jest.fn() }));

type TestDb = Awaited<ReturnType<typeof freshDb>>;
beforeEach(() => jest.clearAllMocks());

async function bill(db: TestDb, o: { name: string; amount: number; day: number; start?: string; active?: number; auto?: number; cat?: number | null; method?: number | null; relief?: string | null }) {
  await db.run(
    `INSERT INTO commitments (name, amount, day_of_month, kind, active, category_id, payment_method_id, relief_id, auto_record, start_date)
     VALUES (?, ?, ?, 'bill', ?, ?, ?, ?, ?, ?)`,
    [o.name, o.amount, o.day, o.active ?? 1, o.cat ?? null, o.method ?? null, o.relief ?? null, o.auto ?? 0, o.start ?? '2026-10-01'],
  );
}
const billSpending = (db: TestDb) =>
  db.all<{ amount: number; date: string; due_date: string; category_id: number; payment_method_id: number | null; relief_id: string | null; note: string }>(
    'SELECT amount, date, due_date, category_id, payment_method_id, relief_id, note FROM expenses WHERE commitment_id IS NOT NULL ORDER BY id',
  );

describe('Bills: status', () => {
  test('shows due today, overdue, upcoming, paid and paused, most urgent first', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Today bill', amount: 1000, day: 24 });
    await bill(db, { name: 'Late bill', amount: 2000, day: 20 });
    await bill(db, { name: 'Soon bill', amount: 3000, day: 30 });
    await bill(db, { name: 'Off bill', amount: 4000, day: 10, active: 0 });
    await db.run("INSERT INTO expenses (amount, category_id, date, note, commitment_id, due_date) VALUES (3000, 3, '2026-10-02', 'x', 3, '2026-09-30')");
    await bill(db, { name: 'Paid bill', amount: 500, day: 2 });
    await db.run("INSERT INTO expenses (amount, category_id, date, note, commitment_id, due_date) VALUES (500, 3, '2026-10-02', 'x', 5, '2026-10-02')");
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Today bill')).toBeTruthy());
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText('Overdue by 4 days')).toBeTruthy();
    expect(screen.getByText('Due in 6 days')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByText('Paid · next due in 9 days')).toBeTruthy();
    const names = screen.getAllByTestId('commitment-name').map((n) => n.props.children);
    expect(names).toEqual(['Late bill', 'Today bill', 'Soon bill', 'Paid bill', 'Off bill']);
  });

  test('a bill added after its due date this month is not overdue', async () => {
    const db = await freshDb();
    await bill(db, { name: 'New bill', amount: 1000, day: 5, start: '2026-10-20' });
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Due in 12 days')).toBeTruthy());
    expect(screen.queryByText(/Overdue/)).toBeNull();
  });
});

describe('Bills: mark paid', () => {
  test('records the spending with the bill defaults and the amount you confirm, once', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Insurance', amount: 30000, day: 24, cat: 3, method: 3, relief: 'life-insurance' });
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark paid Insurance' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid Insurance' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('300.00');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '312.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm paid' }));
    await waitFor(() => expect(screen.getByText(/^Paid · next due/)).toBeTruthy());
    expect(await billSpending(db)).toEqual([
      { amount: 31250, date: '2026-10-24', due_date: '2026-10-24', category_id: 3, payment_method_id: 3, relief_id: 'life-insurance', note: 'Insurance' },
    ]);
    expect(screen.queryByRole('button', { name: 'Mark paid Insurance' })).toBeNull();
  });

  test('an overdue bill is recorded against its missed due date', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Late bill', amount: 2000, day: 20 });
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark paid Late bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid Late bill' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm paid' }));
    await waitFor(async () => expect((await billSpending(db)).length).toBe(1));
    const [row] = await billSpending(db);
    expect(row).toMatchObject({ due_date: '2026-10-20', date: '2026-10-24', amount: 2000 });
  });

  test('an upcoming bill can be paid early, against its next due date', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Soon bill', amount: 3000, day: 30 });
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark paid Soon bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid Soon bill' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm paid' }));
    await waitFor(async () => expect((await billSpending(db)).length).toBe(1));
    expect((await billSpending(db))[0].due_date).toBe('2026-10-30');
  });

  test('the amount must be valid before confirming', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Bill', amount: 3000, day: 24 });
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark paid Bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid Bill' }));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.999');
    expect(screen.getByRole('button', { name: 'Confirm paid' })).toBeDisabled();
  });
});

describe('Bills: sheet fields', () => {
  test('a new bill saves category, payment method, relief tag, automatic recording and its start date', async () => {
    const db = await freshDb();
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add commitment' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add commitment' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Insurance');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '300');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Bill category Kesihatan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bill method Credit card' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tax relief' }));
    await fireEvent.changeText(screen.getByLabelText('Search reliefs'), 'life insurance');
    await fireEvent.press(screen.getByText('Life insurance / family takaful / extra voluntary EPF'));
    await fireEvent(screen.getByLabelText('Record automatically on the due date'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Insurance')).toBeTruthy());
    expect(await db.get('SELECT category_id, payment_method_id, relief_id, auto_record, start_date FROM commitments')).toEqual({
      category_id: 6, payment_method_id: 3, relief_id: 'life-insurance', auto_record: 1, start_date: '2026-10-24',
    });
  });

  test('editing shows what was saved', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Insurance', amount: 30000, day: 12, cat: 6, method: 3, relief: 'life-insurance', auto: 1 });
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Insurance')).toBeTruthy());
    await fireEvent.press(screen.getByText('Insurance'));
    expect(screen.getByRole('button', { name: 'Bill category Kesihatan' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Bill method Credit card' })).toBeSelected();
    expect(screen.getAllByText('Life insurance / family takaful / extra voluntary EPF').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Record automatically on the due date').props.value).toBe(true);
  });
});

describe('Bills: automatic recording', () => {
  test('records the missed due dates once and the bill then shows as paid', async () => {
    const db = await freshDb();
    await bill(db, { name: 'Astro', amount: 8900, day: 5, start: '2026-08-05', auto: 1, cat: 3, method: 4 });
    await render(
      <DataProvider db={db}>
        <BillsSync />
        <Commitments />
      </DataProvider>,
    );
    await waitFor(async () => expect((await billSpending(db)).length).toBe(3));
    expect((await billSpending(db)).map((r) => r.due_date)).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
    await waitFor(() => expect(screen.getByText(/^Paid · next due/)).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await billSpending(db)).length).toBe(3);
  });
});
