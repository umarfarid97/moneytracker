import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Tax from '@/app/tax';
import type { Db } from '@/db/types';
import { freshDb, renderWithData } from './helpers';

let mockToday = '2025-12-01';
jest.mock('@/hooks/useToday', () => ({ useToday: () => mockToday }));
const { router } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  mockToday = '2025-12-01';
});

async function claim(db: Db, reliefId: string, amount: number, receipt: string | null = null) {
  await db.run('INSERT INTO relief_claims (relief_id, year, amount, receipt_uri) VALUES (?, 2025, ?, ?)', [
    reliefId, amount, receipt,
  ]);
}

describe('Tax reliefs tab', () => {
  test('shows the year, the automatic relief and the total with nothing claimed', async () => {
    const db = await freshDb();
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByText('Year of assessment 2025')).toBeTruthy());
    expect(screen.getByTestId('total-relief').props.children).toBe('RM 9,000.00');
    expect(screen.getByText('Individual and dependent relatives · Claimed automatically · RM 9,000.00')).toBeTruthy();
    expect(screen.getByText('Family & dependants')).toBeTruthy();
    expect(screen.getByText('Savings & insurance')).toBeTruthy();
    expect(screen.getByText('Lifestyle: books, computer/phone/tablet, internet, skill courses')).toBeTruthy();
    // lifestyle and EV charging both have a RM 2,500 limit
    expect(screen.getAllByText('RM 2,500.00')).toHaveLength(2);
  });

  test('caps a claim at its limit, says what cannot be claimed and adds it to the total', async () => {
    const db = await freshDb();
    await claim(db, 'lifestyle', 300000, 'file:///r.jpg');
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByTestId('total-relief').props.children).toBe('RM 11,500.00'));
    expect(screen.getByText('RM 2,500.00 of RM 2,500.00')).toBeTruthy();
    expect(screen.getByText('RM 500.00 is above the limit and cannot be claimed')).toBeTruthy();
    expect(screen.queryByText('Receipt missing')).toBeNull();
  });

  test('warns about a missing receipt only where a receipt is needed', async () => {
    const db = await freshDb();
    await claim(db, 'lifestyle', 100000, null);
    await claim(db, 'epf', 400000, null);
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByTestId('total-relief').props.children).toBe('RM 14,000.00'));
    expect(screen.getAllByText('Receipt missing')).toHaveLength(1);
  });

  test('tapping a relief opens its page', async () => {
    const db = await freshDb();
    await renderWithData(db, <Tax />);
    await waitFor(() =>
      expect(screen.getByText('Lifestyle: books, computer/phone/tablet, internet, skill courses')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText('Lifestyle: books, computer/phone/tablet, internet, skill courses'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/relief/[id]', params: { id: 'lifestyle' } });
  });

  test('links to the tax calculator', async () => {
    const db = await freshDb();
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tax calculator' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Tax calculator' }));
    expect(router.push).toHaveBeenCalledWith('/tax-calculator');
  });
});

describe('Tax year selection (review finding: 2026 receipts were filed under 2025)', () => {
  test('defaults to the current year, says when LHDN figures for it are not out, and hides other years claims', async () => {
    mockToday = '2026-10-24';
    const db = await freshDb();
    await claim(db, 'lifestyle', 100000, 'x');
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByText('Year of assessment 2026')).toBeTruthy());
    expect(screen.getByText('LHDN has not published YA 2026 figures yet, so YA 2025 rates and limits are used.')).toBeTruthy();
    expect(screen.getByTestId('total-relief').props.children).toBe('RM 9,000.00');
  });

  test('the year chips switch between this year and last year', async () => {
    mockToday = '2026-10-24';
    const db = await freshDb();
    await claim(db, 'lifestyle', 100000, 'x');
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByRole('button', { name: '2025' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: '2025' }));
    expect(screen.getByText('Year of assessment 2025')).toBeTruthy();
    expect(screen.queryByText(/has not published/)).toBeNull();
    expect(screen.getByTestId('total-relief').props.children).toBe('RM 10,000.00');
  });
});
