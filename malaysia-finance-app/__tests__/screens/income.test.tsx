import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Income from '@/app/income';
import { addRuleEntry, listIncomeRules } from '@/db/repos/income';
import { IncomeSync } from '@/features/income/IncomeSync';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
jest.mock('@/ui/confirm', () => ({ confirmDelete: jest.fn(() => Promise.resolve(true)) }));

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('Extra income', () => {
  test('a repeating rule adds its income on the day, once, and only from the day it was added', async () => {
    const db = await freshDb();
    await db.run(
      `INSERT INTO income_rules (name, amount, day_of_month, active, start_date) VALUES ('Rent', 120000, 5, 1, '2026-08-10')`,
    );
    await renderWithData(db, <><IncomeSync /><Income /></>);
    await waitFor(() => expect(screen.getByTestId('income-month').props.children).toBe('RM 1,200.00'));
    const dates = () => db.all('SELECT name, amount, date FROM income_entries ORDER BY date');
    expect(await dates()).toEqual([
      { name: 'Rent', amount: 120000, date: '2026-09-05' },
      { name: 'Rent', amount: 120000, date: '2026-10-05' },
    ]);
    expect(await db.get('SELECT last_run FROM income_rules')).toEqual({ last_run: '2026-10-05' });

    // Running again (a new launch) adds nothing.
    await renderWithData(db, <IncomeSync />);
    await new Promise((r) => setTimeout(r, 50));
    expect((await dates()).length).toBe(2);
  });

  test('two phones adding the same day end up with one entry after syncing', async () => {
    const db = await freshDb();
    await db.run(
      `INSERT INTO income_rules (name, amount, day_of_month, active, start_date, uid) VALUES ('Rent', 100, 5, 1, '2026-10-01', 'ruleuid')`,
    );
    const [rule] = await listIncomeRules(db);
    expect(await addRuleEntry(db, rule, '2026-10-05')).not.toBeNull();
    expect(await addRuleEntry(db, rule, '2026-10-05')).toBeNull();
    expect(await db.all('SELECT uid FROM income_entries')).toEqual([{ uid: 'inc-ruleuid-2026-10-05' }]);
  });

  test('adds a repeating rule and a one-off income from the screen', async () => {
    const db = await freshDb();
    await renderWithData(db, <Income />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add repeating income' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add repeating income' }));
    await type('Name', 'Freelance');
    await type('Amount', '300');
    await type('Day of the month', '40');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await type('Day of the month', '15');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Every month on day 15')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Add income once' }));
    await type('Name', 'Bonus');
    await type('Amount', '50');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('income-month').props.children).toBe('RM 50.00'));
    expect(await db.all('SELECT name, amount, date FROM income_entries')).toEqual([{ name: 'Bonus', amount: 5000, date: '2026-10-26' }]);
  });
});
