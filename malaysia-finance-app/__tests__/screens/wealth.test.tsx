import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Epf from '@/app/epf';
import Savings from '@/app/savings';
import Socso from '@/app/socso';
import TaxCalculator from '@/app/tax-calculator';
import Zakat from '@/app/zakat';
import ZakatCalculator from '@/app/zakat-calculator';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
jest.mock('@/ui/confirm', () => ({ confirmDelete: jest.fn(() => Promise.resolve(true)) }));

beforeEach(() => jest.clearAllMocks());

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('EPF screen', () => {
  test('adds an opening balance and a contribution, and shows the balance and this year\'s split', async () => {
    const db = await freshDb();
    await renderWithData(db, <Epf />);
    await waitFor(() => expect(screen.getByTestId('epf-balance')).toBeTruthy());
    expect(screen.getByTestId('epf-balance').props.children).toBe('RM 0.00');

    await fireEvent.press(screen.getByRole('button', { name: 'Add record' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Opening balance' }));
    await type('Amount', '10000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('epf-balance').props.children).toBe('RM 10,000.00'));

    await fireEvent.press(screen.getByRole('button', { name: 'Add record' }));
    await type('Employee', '440');
    await type('Employer', '520');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('epf-balance').props.children).toBe('RM 10,960.00'));
    expect(screen.getByTestId('epf-year-employee').props.children).toBe('RM 440.00');
    expect(screen.getByTestId('epf-year-employer').props.children).toBe('RM 520.00');
    expect(await db.get('SELECT amount, employer_share AS e FROM retirement_entries WHERE kind = ?', ['contribution'])).toEqual({ amount: 96000, e: 52000 });
  });

  test('adds the year\'s employee contributions to the tax reliefs once, and keeps that claim up to date', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO retirement_entries (scheme, kind, date, amount, employer_share) VALUES ('epf', 'contribution', '2026-01-31', 96000, 52000)`);
    await renderWithData(db, <Epf />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to tax reliefs' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add to tax reliefs' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Added to tax reliefs' })).toBeTruthy());
    expect(await db.all('SELECT relief_id AS r, year, amount FROM relief_claims')).toEqual([{ r: 'epf', year: 2026, amount: 44000 }]);
  });

  test('projects the balance to retirement once an age is entered', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO retirement_entries (scheme, kind, date, amount) VALUES ('epf', 'opening', '2026-01-01', 1000000)`);
    await renderWithData(db, <Epf />);
    await waitFor(() => expect(screen.getByLabelText('Your age now')).toBeTruthy());
    expect(screen.getByText('Enter your age to see the projection.')).toBeTruthy();
    await type('Your age now', '50');
    await type('Retire at age', '60');
    await type('Dividend a year (%)', '0');
    await type('Added each month (you + employer)', '1000');
    expect(screen.getByTestId('epf-projected').props.children).toBe('RM 130,000.00');
  });
});

describe('SOCSO screen', () => {
  test('records SOCSO and EIS from the payslip and counts them toward the SOCSO relief', async () => {
    const db = await freshDb();
    await renderWithData(db, <Socso />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add record' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add record' }));
    await type('Employee', '24.75');
    await type('Employer', '86.65');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('socso-total').props.children).toBe('RM 111.40'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to tax reliefs' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Added to tax reliefs' })).toBeTruthy());
    expect(await db.all('SELECT relief_id AS r, amount FROM relief_claims')).toEqual([{ r: 'socso', amount: 2475 }]);
  });
});

describe('Zakat and sedekah', () => {
  test('records zakat and sedekah and totals them for the year', async () => {
    const db = await freshDb();
    await renderWithData(db, <Zakat />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add giving' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add giving' }));
    await type('Amount', '250');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('giving-zakat').props.children).toBe('RM 250.00'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add giving' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sedekah' }));
    await type('Amount', '40');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('giving-total').props.children).toBe('RM 290.00'));
    expect(screen.getByTestId('giving-sedekah').props.children).toBe('RM 40.00');
  });

  test('the calculator defaults to zakat pendapatan and needs no gold price', async () => {
    const db = await freshDb();
    await renderWithData(db, <ZakatCalculator />);
    await waitFor(() => expect(screen.getByLabelText('Income for the year')).toBeTruthy());
    expect(screen.queryByLabelText('Gold price per gram')).toBeNull();
    await type('Income for the year', '60000');
    await type('EPF contributions for the year (deducted)', '6600');
    await type('Basic needs for the year', '0');
    expect(screen.getByTestId('zakat-base').props.children).toBe('RM 53,400.00');
    expect(screen.getByTestId('zakat-total').props.children).toBe('RM 1,335.00');
  });

  test('the calculator works out zakat from the gold price and savings', async () => {
    const db = await freshDb();
    await renderWithData(db, <ZakatCalculator />);
    await waitFor(() => expect(screen.getByLabelText('Income for the year')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Savings & gold' }));
    await waitFor(() => expect(screen.getByLabelText('Gold price per gram')).toBeTruthy());
    await type('Gold price per gram', '400');
    await type('Savings held for a year', '40000');
    expect(screen.getByTestId('zakat-nisab').props.children).toBe('RM 34,000.00');
    expect(screen.getByTestId('zakat-total').props.children).toBe('RM 1,000.00');
  });

  test('recorded zakat and donations start the tax calculator\'s fields', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO giving_records (kind, date, amount) VALUES ('zakat', '2026-03-01', 50000)`);
    await db.run(`INSERT INTO giving_records (kind, date, amount) VALUES ('sedekah', '2026-04-01', 20000)`);
    await renderWithData(db, <TaxCalculator />);
    await waitFor(() => expect(screen.getByLabelText('Zakat paid')).toBeTruthy());
    expect(screen.getByLabelText('Zakat paid').props.value).toBe('500.00');
    expect(screen.getByLabelText('Approved donations (sedekah, waqf)').props.value).toBe('200.00');
  });
});

describe('Savings and investments', () => {
  test('adds an account, deposits into it and shows progress to its goal', async () => {
    const db = await freshDb();
    await renderWithData(db, <Savings />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add account' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add account' }));
    await type('Worth now', '2000');
    await type('Goal (optional)', '10000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('20% of RM 10,000.00')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Add money to Tabung Haji' }));
    await type('Amount', '500');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('savings-total').props.children).toBe('RM 2,500.00'));
    expect(await db.get('SELECT balance, invested FROM savings_accounts')).toEqual({ balance: 250000, invested: 250000 });

    await fireEvent.press(screen.getByRole('button', { name: 'Update value of Tabung Haji' }));
    await type('Worth now', '2700');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('savings-total').props.children).toBe('RM 2,700.00'));
    expect(await db.get('SELECT balance, invested FROM savings_accounts')).toEqual({ balance: 270000, invested: 250000 });
  });
});
