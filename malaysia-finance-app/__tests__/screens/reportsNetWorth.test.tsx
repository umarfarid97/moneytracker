import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Budget from '@/app/budget';
import NetWorth from '@/app/net-worth';
import Reports from '@/app/reports';
import { shareTextFile } from '@/exportFile';
import { addExpenseRow, CAT, freshDb, renderWithData, setBudgetRow } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
jest.mock('@/exportFile', () => ({ shareTextFile: jest.fn(() => Promise.resolve()), sharePdf: jest.fn(() => Promise.resolve()) }));

beforeEach(() => jest.clearAllMocks());

describe('Reports screen', () => {
  test('shows the period total and year, and exports CSV', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 2500, '2026-10-03');
    await addExpenseRow(db, CAT.Transport, 1000, '2026-09-03');
    await renderWithData(db, <Reports />);
    await waitFor(() => expect(screen.getByTestId('report-total').props.children).toBe('RM 25.00'));
    expect(screen.getByTestId('year-total').props.children).toBe('RM 35.00');
    await fireEvent.press(screen.getByText('Share for Excel (CSV)'));
    await waitFor(() => expect(shareTextFile).toHaveBeenCalled());
    expect((shareTextFile as jest.Mock).mock.calls[0][0]).toBe('duit-report-2026-10.csv');
    await fireEvent.press(screen.getByLabelText('Earlier period'));
    await waitFor(() => expect(screen.getByTestId('report-total').props.children).toBe('RM 10.00'));
  });
});

describe('Net worth screen', () => {
  test('starts at zero', async () => {
    const db = await freshDb();
    await renderWithData(db, <NetWorth />);
    await waitFor(() => expect(screen.getByTestId('net-worth').props.children).toBe('RM 0.00'));
  });
});

describe('Budget progress', () => {
  test('warns when a category is near or over its limit', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 10000);
    await addExpenseRow(db, CAT.Makan, 8500, '2026-10-03');
    await renderWithData(db, <Budget />);
    await waitFor(() => expect(screen.getByText('Makan has used 85% of its budget')).toBeTruthy());
  });
});
