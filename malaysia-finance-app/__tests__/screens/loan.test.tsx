import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Loan from '@/app/loan-calculator';
import { assessLoan } from '@/domain/loan';
import { formatRM } from '@/domain/money';
import { freshDb, renderWithData } from './helpers';

beforeEach(() => jest.clearAllMocks());

async function ready() {
  await waitFor(() => expect(screen.getByLabelText('Monthly take-home pay')).toBeTruthy());
}
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('Loan calculator', () => {
  test('starts on a home loan with the default rate and term', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    expect(screen.getByRole('button', { name: 'Home' })).toBeSelected();
    expect(screen.getByLabelText('Interest rate (% a year)').props.value).toBe('4.5');
    expect(screen.getByLabelText('Years').props.value).toBe('35');
    expect(screen.getByText('This is an estimate for planning, not official tax or lending advice.')).toBeTruthy();
  });

  test('asks for take-home pay when there is none', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    expect(screen.getByText('Add your monthly take-home pay to see what suits you')).toBeTruthy();
    expect(screen.queryByTestId('range')).toBeNull();
  });

  test('RM 5,000 take-home with RM 1,000 commitments: highest instalment RM 2,250 and the borrowing range', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    await type('Monthly take-home pay', '5000');
    await type('Monthly commitments', '1000');
    const r = assessLoan({
      netMonthly: 500000, commitments: 100000, kind: 'home', ratePct: 4.5, months: 420, method: 'reducing',
    });
    expect(screen.getByText('Highest monthly instalment RM 2,250.00')).toBeTruthy();
    expect(screen.getByTestId('range').props.children).toBe(
      `${formatRM(r.comfortablePrincipal)} to ${formatRM(r.maxPrincipal)}`,
    );
  });

  test('switching to a car loan uses a flat rate, 3% and 9 years', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    await type('Monthly take-home pay', '5000');
    await fireEvent.press(screen.getByRole('button', { name: 'Car' }));
    expect(screen.getByLabelText('Interest rate (% a year)').props.value).toBe('3');
    expect(screen.getByLabelText('Years').props.value).toBe('9');
    const r = assessLoan({
      netMonthly: 500000, commitments: 0, kind: 'car', ratePct: 3, months: 108, method: 'flat',
    });
    expect(screen.getByTestId('range').props.children).toBe(
      `${formatRM(r.comfortablePrincipal)} to ${formatRM(r.maxPrincipal)}`,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Personal' }));
    expect(screen.getByLabelText('Interest rate (% a year)').props.value).toBe('8');
    expect(screen.getByLabelText('Years').props.value).toBe('10');
  });

  test('a loan amount gets a verdict: comfortable, tight or not suitable', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    await type('Monthly take-home pay', '5000');
    await type('Monthly commitments', '1000');
    await type('Loan amount you are thinking of', '100000');
    expect(screen.getByTestId('verdict').props.children).toBe('Comfortable');
    await type('Loan amount you are thinking of', '350000');
    expect(screen.getByTestId('verdict').props.children).toBe('Tight');
    await type('Loan amount you are thinking of', '500000');
    expect(screen.getByTestId('verdict').props.children).toBe('Not suitable');
    expect(screen.getByText(/^Monthly instalment RM [\d,]+\.\d\d$/)).toBeTruthy();
  });

  test('commitments above the limit leave nothing to borrow', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    await type('Monthly take-home pay', '5000');
    await type('Monthly commitments', '4000');
    expect(screen.getByTestId('range').props.children).toBe('RM 0.00 to RM 0.00');
    expect(screen.getByText('Highest monthly instalment RM 0.00')).toBeTruthy();
  });

  test('a term above the maximum or a bad rate shows a message and hides results', async () => {
    const db = await freshDb();
    await renderWithData(db, <Loan />);
    await ready();
    await type('Monthly take-home pay', '5000');
    await type('Years', '40');
    expect(screen.getByText('Between 1 and 35 years')).toBeTruthy();
    expect(screen.queryByTestId('range')).toBeNull();
    await type('Years', '30');
    await type('Interest rate (% a year)', 'abc');
    expect(screen.getByText('Enter a rate like 4.5')).toBeTruthy();
    expect(screen.queryByTestId('range')).toBeNull();
    await type('Interest rate (% a year)', '0');
    expect(screen.getByTestId('range')).toBeTruthy();
  });

  test('prefills take-home pay from the income profile and commitments from the tracker', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET gross_monthly = 600000 WHERE id = 1');
    await db.run("INSERT INTO commitments (name, amount, day_of_month, kind, active) VALUES ('Car', 120000, 1, 'loan', 1)");
    await db.run("INSERT INTO commitments (name, amount, day_of_month, kind, active) VALUES ('Astro', 15000, 5, 'bill', 1)");
    await db.run("INSERT INTO commitments (name, amount, day_of_month, kind, active) VALUES ('Old', 99999, 5, 'bill', 0)");
    await renderWithData(db, <Loan />);
    await waitFor(() => expect(screen.getByLabelText('Monthly take-home pay').props.value).toBe('5298.00'));
    expect(screen.getByLabelText('Monthly commitments').props.value).toBe('1350.00');
  });
});
