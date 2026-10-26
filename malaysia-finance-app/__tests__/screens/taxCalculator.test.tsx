import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import TaxCalculator from '@/app/tax-calculator';
import { freshDb, renderWithData } from './helpers';

let mockToday = '2025-12-01';
jest.mock('@/hooks/useToday', () => ({ useToday: () => mockToday }));

beforeEach(() => {
  jest.clearAllMocks();
  mockToday = '2025-12-01';
});

async function ready() {
  await waitFor(() => expect(screen.getByLabelText('Salary for the year')).toBeTruthy());
}
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('Tax calculator', () => {
  test('starts at zero and shows the estimate notice and the tax year', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    expect(screen.getByText('Tax payable')).toBeTruthy();
    expect(screen.getByTestId('tax-payable').props.children).toBe('RM 0.00');
    expect(screen.getByText('This is an estimate for planning, not official tax or lending advice.')).toBeTruthy();
    expect(screen.getByText(/Year of assessment 2025/)).toBeTruthy();
  });

  test('salary of RM 60,000 gives RM 51,000 chargeable and RM 1,610 tax, recalculated as you type', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    await type('Salary for the year', '60000');
    expect(screen.getByTestId('chargeable').props.children).toBe('RM 51,000.00');
    expect(screen.getByTestId('tax-payable').props.children).toBe('RM 1,610.00');
    expect(screen.getByText('11% on RM 1,000.00')).toBeTruthy();
  });

  test('tax already paid turns the result into a balance or a refund', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    await type('Salary for the year', '60000');
    await type('Tax already paid (PCB)', '1500');
    expect(screen.getByText('Balance to pay')).toBeTruthy();
    expect(screen.getByTestId('balance').props.children).toBe('RM 110.00');
    await type('Tax already paid (PCB)', '2000');
    expect(screen.getByText('Refund')).toBeTruthy();
    expect(screen.getByTestId('balance').props.children).toBe('RM 390.00');
  });

  test('freelance income less business expenses is taxed', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    await type('Freelance or side income', '30000');
    await type('Allowable business expenses', '6000');
    // 24,000 less 9,000 relief = 15,000 chargeable
    expect(screen.getByTestId('chargeable').props.children).toBe('RM 15,000.00');
  });

  test('uses the reliefs claimed in the tracker on top of the automatic RM 9,000', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri) VALUES ('lifestyle', 2025, 250000, 'x')");
    await renderWithData(db, <TaxCalculator />);
    await ready();
    await type('Salary for the year', '60000');
    expect(screen.getByTestId('reliefs').props.children).toBe('RM 11,500.00');
    expect(screen.getByTestId('chargeable').props.children).toBe('RM 48,500.00');
  });

  test('low incomes show the rebate, and the spouse switch removes the rest of the tax', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    await type('Salary for the year', '40000');
    expect(screen.getByTestId('rebate').props.children).toBe('RM 400.00');
    expect(screen.getByTestId('tax-payable').props.children).toBe('RM 80.00');
    await fireEvent(screen.getByLabelText('Spouse has no income'), 'valueChange', true);
    expect(screen.getByTestId('tax-payable').props.children).toBe('RM 0.00');
  });

  test('prefills the salary from the income profile', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET gross_monthly = 500000 WHERE id = 1');
    await renderWithData(db, <TaxCalculator />);
    await waitFor(() => expect(screen.getByLabelText('Salary for the year').props.value).toBe('60000.00'));
  });

  test('for a year without published figures it says which figures it used', async () => {
    mockToday = '2026-10-24';
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    expect(screen.getByText('LHDN has not published YA 2026 figures yet, so YA 2025 rates and limits are used.')).toBeTruthy();
  });

  test('typing keeps only digits and two decimals', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxCalculator />);
    await ready();
    await type('Salary for the year', '60,000.999');
    expect(screen.getByLabelText('Salary for the year').props.value).toBe('60000.99');
  });
});
