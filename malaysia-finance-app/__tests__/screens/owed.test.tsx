import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Owed from '@/app/owed';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
jest.mock('@/ui/confirm', () => ({ confirmDelete: jest.fn(() => Promise.resolve(true)) }));

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const total = () => screen.getByTestId('owed-total').props.children;

describe('Who owes me', () => {
  test('lending money shows up as owed, and settling up clears it', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByTestId('owed-total')).toBeTruthy());
    expect(total()).toBe('RM 0.00');

    await fireEvent.press(screen.getByRole('button', { name: 'Lend or borrow' }));
    await type('Person', 'Aina');
    await type('Amount', '50');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(total()).toBe('RM 50.00'));
    expect(screen.getByText('1 person · you are owed RM 50.00')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'By person' }));
    expect(screen.getByText('owes you RM 50.00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Aina' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Settle up with Aina' }));
    await waitFor(() => expect(total()).toBe('RM 0.00'));
    expect(await db.all('SELECT person, kind, amount FROM owed_entries ORDER BY id')).toEqual([
      { person: 'Aina', kind: 'lent', amount: 5000 },
      { person: 'Aina', kind: 'repaid', amount: 5000 },
    ]);
  });

  test('money I borrowed counts as what I owe, not what is owed to me', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date) VALUES ('Ben', 'borrowed', 2000, '2026-10-01')`);
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByTestId('owed-iowe')).toBeTruthy());
    expect(total()).toBe('RM 0.00');
    expect(screen.getByText('1 person · you owe RM 20.00')).toBeTruthy();
  });

  test('splitting a bill makes each friend owe their share and can record my share as spending', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Split a bill' }));
    await type('Total bill (you paid)', '100');
    await type('What was it for?', 'Dinner');
    await type('Name', 'Aina');
    await fireEvent.press(screen.getByRole('button', { name: 'Add person' }));
    await type('Name', 'Ben');
    await fireEvent.press(screen.getByRole('button', { name: 'Add person' }));
    expect(screen.getByTestId('split-each').props.children).toBe('Each person owes you RM 33.33');
    await fireEvent.press(screen.getByRole('button', { name: 'Also record my share as spending' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save split' }));

    await waitFor(() => expect(total()).toBe('RM 66.66'));
    expect(await db.all('SELECT person, amount, note FROM owed_entries ORDER BY id')).toEqual([
      { person: 'Aina', amount: 3333, note: 'Dinner' },
      { person: 'Ben', amount: 3333, note: 'Dinner' },
    ]);
    expect(await db.all('SELECT amount, note, date FROM expenses')).toEqual([{ amount: 3334, note: 'Dinner', date: '2026-10-26' }]);
  });

  test('save stays disabled without a name or amount', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lend or borrow' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Lend or borrow' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await type('Amount', '10');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await type('Person', 'Chen');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('items are grouped by event, with per-event balances and the overall balance per person', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, event) VALUES
      ('Aina', 'lent', 3000, '2026-10-10', 'Penang trip'),
      ('Ben', 'lent', 2000, '2026-10-11', 'Penang trip'),
      ('Aina', 'lent', 500, '2026-10-20', 'Hari Raya dinner'),
      ('Chen', 'lent', 100, '2026-10-25', '')`);
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Penang trip' })).toBeTruthy());
    expect(total()).toBe('RM 56.00');
    expect(screen.getByRole('button', { name: 'Hari Raya dinner' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No event' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Penang trip' }));
    await waitFor(() => expect(screen.getByTestId('event-owed').props.children).toBe('RM 50.00'));
    await fireEvent.press(screen.getByRole('button', { name: 'Settle Ben in Penang trip' }));
    await waitFor(() => expect(total()).toBe('RM 36.00'));
    expect(await db.get(`SELECT person, kind, amount, event FROM owed_entries WHERE kind = 'repaid'`)).toEqual({
      person: 'Ben', kind: 'repaid', amount: 2000, event: 'Penang trip',
    });
  });

  test('by person shows Aina once with her balance across events', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, event) VALUES
      ('Aina', 'lent', 3000, '2026-10-10', 'Penang trip'), ('Aina', 'lent', 500, '2026-10-20', 'Hari Raya dinner')`);
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'By person' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'By person' }));
    expect(screen.getByText('owes you RM 35.00')).toBeTruthy();
  });

  test('a new item can be put in a new event', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lend or borrow' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Lend or borrow' }));
    await type('Person', 'Aina');
    await type('Amount', '20');
    await type('New event', 'Langkawi trip');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Langkawi trip' })).toBeTruthy());
    expect(await db.get('SELECT event FROM owed_entries')).toEqual({ event: 'Langkawi trip' });
  });

  test('splitting with a different amount per person, and the remainder is shown', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Split a bill' }));
    await type('Total bill (you paid)', '100');
    await type('New event', 'Penang trip');
    for (const name of ['Aina', 'Ben']) {
      await type('Name', name);
      await fireEvent.press(screen.getByRole('button', { name: 'Add person' }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Amounts' }));
    await type('Amount for Aina', '25');
    await type('Amount for Ben', '40');
    expect(screen.getByTestId('split-mine').props.children).toBe('Left for you: RM 35.00');
    await type('Amount for Ben', '90');
    expect(screen.getByTestId('split-mine').props.children).toBe('Over by RM 15.00. Lower someone\'s part.');
    expect(screen.getByRole('button', { name: 'Save split' })).toBeDisabled();
    await type('Amount for Ben', '40');
    await fireEvent.press(screen.getByRole('button', { name: 'Save split' }));
    await waitFor(() => expect(total()).toBe('RM 65.00'));
    expect(await db.all('SELECT person, amount, event FROM owed_entries ORDER BY id')).toEqual([
      { person: 'Aina', amount: 2500, event: 'Penang trip' },
      { person: 'Ben', amount: 4000, event: 'Penang trip' },
    ]);
  });

  test('percent and shares split the bill by the numbers typed', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Split a bill' }));
    await type('Total bill (you paid)', '100');
    await type('Name', 'Aina');
    await fireEvent.press(screen.getByRole('button', { name: 'Add person' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Percent' }));
    await type('Percent for Aina', '30');
    expect(screen.getByText('Aina owes you RM 30.00')).toBeTruthy();
    expect(screen.getByText('Your part is 70%')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Shares' }));
    await type('Shares for Aina', '3');
    expect(screen.getByText('Aina owes you RM 75.00')).toBeTruthy();
    expect(screen.getByTestId('split-mine').props.children).toBe('Your share is RM 25.00');
  });
});
