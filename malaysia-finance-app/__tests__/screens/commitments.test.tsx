import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Commitments from '@/app/(tabs)/commitments';
import { RemindersSync } from '@/features/commitments/RemindersSync';
import { DataProvider } from '@/hooks/DataProvider';
import { freshDb, renderWithData } from './helpers';
import type { Db } from '@/db/types';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/notifications', () => ({ scheduleReminders: jest.fn(async () => 0), configureNotifications: jest.fn() }));
const { scheduleReminders } = jest.requireMock('@/notifications');

beforeEach(() => jest.clearAllMocks());

async function addRow(db: Db, name: string, amount: number, day: number, kind = 'bill', active = 1) {
  await db.run("INSERT INTO commitments (name, amount, day_of_month, kind, active, start_date) VALUES (?, ?, ?, ?, ?, '2026-10-20')", [
    name, amount, day, kind, active,
  ]);
}

describe('Commitments screen', () => {
  test('has a switch for unpaid bills in Spending, on by default, remembered in the database', async () => {
    const db = await freshDb();
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByLabelText('Show unpaid bills in Spending').props.value).toBe(true));
    await fireEvent(screen.getByLabelText('Show unpaid bills in Spending'), 'valueChange', false);
    await waitFor(async () =>
      expect(await db.all("SELECT value FROM app_settings WHERE key = 'showPendingBills'")).toEqual([{ value: '0' }]));
    expect(screen.getByLabelText('Show unpaid bills in Spending').props.value).toBe(false);
  });

  test('lists by next due date with due labels and a monthly total', async () => {
    const db = await freshDb();
    await addRow(db, 'Rumah', 120000, 1, 'loan');
    await addRow(db, 'Astro', 8900, 24, 'subscription');
    await addRow(db, 'Gym', 15000, 25, 'subscription');
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Astro')).toBeTruthy());
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText('Due tomorrow')).toBeTruthy();
    expect(screen.getByText('Due in 8 days')).toBeTruthy();
    expect(screen.getByTestId('commitments-total').props.children).toBe('RM 1,439.00');
    const names = screen.getAllByTestId('commitment-name').map((n) => n.props.children);
    expect(names).toEqual(['Rumah', 'Astro', 'Gym']);
  });

  test('groups by Bills, Loans and Subscriptions with a total each, and a filter', async () => {
    const db = await freshDb();
    await addRow(db, 'Rumah', 120000, 1, 'loan');
    await addRow(db, 'TNB', 10000, 5, 'bill');
    await addRow(db, 'Astro', 8900, 24, 'subscription');
    await addRow(db, 'Gym', 15000, 25, 'subscription');
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Astro')).toBeTruthy());
    expect(screen.getByTestId('group-total-bill').props.children).toBe('RM 100.00');
    expect(screen.getByTestId('group-total-loan').props.children).toBe('RM 1,200.00');
    expect(screen.getByTestId('group-total-subscription').props.children).toBe('RM 239.00');
    expect(screen.getAllByTestId('commitment-name').map((n) => n.props.children)).toEqual(['TNB', 'Rumah', 'Astro', 'Gym']);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Loans' })[0]);
    expect(screen.getAllByTestId('commitment-name').map((n) => n.props.children)).toEqual(['Rumah']);
  });

  test('paused commitments are listed last and left out of the total', async () => {
    const db = await freshDb();
    await addRow(db, 'Astro', 8900, 24);
    await addRow(db, 'Old gym', 5000, 10, 'subscription', 0);
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Old gym')).toBeTruthy());
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByTestId('commitments-total').props.children).toBe('RM 89.00');
    const names = screen.getAllByTestId('commitment-name').map((n) => n.props.children);
    expect(names).toEqual(['Astro', 'Old gym']);
  });

  test('empty state invites adding a first commitment', async () => {
    const db = await freshDb();
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('No bills or loans yet')).toBeTruthy());
  });

  test('add: fill the sheet and save', async () => {
    const db = await freshDb();
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add commitment' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add commitment' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Netflix');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '55');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Subscription' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Netflix')).toBeTruthy());
    expect(screen.getByText('Due in 19 days')).toBeTruthy();
    const row = await db.get<{ name: string; amount: number; day_of_month: number; kind: string }>(
      'SELECT name, amount, day_of_month, kind FROM commitments',
    );
    expect(row).toEqual({ name: 'Netflix', amount: 5500, day_of_month: 12, kind: 'subscription' });
  });

  test('day of month must be 1 to 31 and a name is required', async () => {
    const db = await freshDb();
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add commitment' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add commitment' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Netflix');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '55');
    for (const bad of ['0', '32', 'x', '']) {
      await fireEvent.changeText(screen.getByLabelText('Day of month'), bad);
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    }
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '31');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('edit: tap a row, change it, pause it, then delete it', async () => {
    const db = await freshDb();
    await addRow(db, 'Astro', 8900, 24, 'subscription');
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Astro')).toBeTruthy());
    await fireEvent.press(screen.getByText('Astro'));
    expect(screen.getByLabelText('Name').props.value).toBe('Astro');
    expect(screen.getByLabelText('Amount').props.value).toBe('89.00');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '95');
    await fireEvent(screen.getByLabelText('Active'), 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Paused')).toBeTruthy());
    expect((await db.get<{ amount: number; active: number }>('SELECT amount, active FROM commitments'))).toEqual({
      amount: 9500, active: 0,
    });

    await fireEvent.press(screen.getByText('Astro'));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText('No bills or loans yet')).toBeTruthy());
    expect(await db.get('SELECT id FROM commitments')).toBeNull();
  });
});

describe('RemindersSync', () => {
  test('schedules reminders for the saved commitments and again whenever they change', async () => {
    const db = await freshDb();
    await addRow(db, 'Astro', 8900, 24);
    await render(
      <DataProvider db={db}>
        <RemindersSync />
        <Commitments />
      </DataProvider>,
    );
    await waitFor(() => expect(scheduleReminders).toHaveBeenCalled());
    expect(scheduleReminders.mock.calls[0][0]).toHaveLength(1);
    const calls = scheduleReminders.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Add commitment' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Netflix');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '55');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(scheduleReminders.mock.calls.length).toBeGreaterThan(calls));
    const last = scheduleReminders.mock.calls[scheduleReminders.mock.calls.length - 1][0];
    expect(last.map((c: { name: string }) => c.name).sort()).toEqual(['Astro', 'Netflix']);
  });
});
