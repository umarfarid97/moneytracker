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
    expect(screen.getByText('you owe RM 20.00')).toBeTruthy();
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

  test('a bill can be split with a different amount for each person, under an event', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Split a bill' }));
    await type('Total bill (you paid)', '100');
    await type('Event (optional)', 'Penang trip');
    await type('Name', 'Aina');
    await fireEvent.press(screen.getByRole('button', { name: 'Add person' }));
    await type('Name', 'Ben');
    await fireEvent.press(screen.getByRole('button', { name: 'Add person' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Different amounts' }));
    await type('Aina owes', '25');
    await type('Ben owes', '60');
    expect(screen.getByTestId('split-mine').props.children).toBe('Your share is RM 15.00');
    await type('Ben owes', '90');
    expect(screen.getByTestId('split-over')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save split' })).toBeDisabled();
    await type('Ben owes', '60');
    await fireEvent.press(screen.getByRole('button', { name: 'Save split' }));

    await waitFor(() => expect(total()).toBe('RM 85.00'));
    expect(await db.all('SELECT person, amount, event FROM owed_entries ORDER BY id')).toEqual([
      { person: 'Aina', amount: 2500, event: 'Penang trip' },
      { person: 'Ben', amount: 6000, event: 'Penang trip' },
    ]);

    await fireEvent.press(screen.getByRole('button', { name: 'By event' }));
    await fireEvent.press(screen.getByRole('button', { name: /Penang trip/ }));
    expect(screen.getByTestId('event-balance').props.children).toBe('owes you RM 85.00');
    await fireEvent.press(screen.getByRole('button', { name: 'Settle up Penang trip' }));
    await waitFor(() => expect(total()).toBe('RM 0.00'));
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
});
