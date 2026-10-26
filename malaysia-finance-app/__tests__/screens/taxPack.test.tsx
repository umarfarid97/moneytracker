import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import Tax from '@/app/tax';
import TaxPack from '@/app/tax-pack';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u }));
jest.mock('@/hooks/useToday', () => ({ useToday: () => '2025-12-01' }));
const { router } = jest.requireMock('expo-router');

type TestDb = Awaited<ReturnType<typeof freshDb>>;
beforeEach(() => jest.clearAllMocks());

async function seed(db: TestDb) {
  await db.run("INSERT INTO expenses (amount, category_id, date, note, receipt_uri, relief_id, relief_amount) VALUES (120000, 1, '2025-06-10', 'Phone', 'receipts/a.jpg', 'lifestyle', 100000)");
  await db.run("INSERT INTO expenses (amount, category_id, date, note, receipt_uri, relief_id) VALUES (8500, 6, '2025-07-02', 'Klinik', NULL, 'medical-serious')");
  await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri, note) VALUES ('epf', 2025, 400000, NULL, 'EPF 2025')");
}

describe('Tax filing pack (e-Filing)', () => {
  test('shows the Form BE summary and links a receipt to a claim that has none', async () => {
    const db = await freshDb();
    await seed(db);
    jest.requireMock('@/receipts').pickReceipt.mockResolvedValue('receipts/new.jpg');
    await renderWithData(db, <TaxPack />);
    await waitFor(() => expect(screen.getByText('e-Filing (Form BE) summary')).toBeTruthy());
    await fireEvent.press(screen.getAllByRole('button', { name: 'Add receipt' })[0]);
    await waitFor(() => expect(screen.queryByText('1 receipt still missing')).toBeNull());
  });
});

describe('Tax filing pack', () => {
  test('lists each relief with its items, the receipt status and the total', async () => {
    const db = await freshDb();
    await seed(db);
    await renderWithData(db, <TaxPack />);
    await waitFor(() => expect(screen.getByText('Phone')).toBeTruthy());
    expect(screen.getByText('Year of assessment 2025')).toBeTruthy();
    expect(screen.getByTestId('pack-total').props.children).toBe('RM 14,085.00');
    expect(screen.getByText('Klinik')).toBeTruthy();
    expect(screen.getByText('EPF 2025')).toBeTruthy();
    expect(screen.getByText('1 receipt still missing')).toBeTruthy();
    expect(screen.getAllByText('Receipt missing')).toHaveLength(1);
    expect(screen.getByText('RM 1,000.00 of RM 1,200.00')).toBeTruthy();
  });

  test('says so when nothing is claimed yet', async () => {
    const db = await freshDb();
    await renderWithData(db, <TaxPack />);
    await waitFor(() => expect(screen.getByText('Nothing claimed yet for this year')).toBeTruthy());
    expect(screen.getByTestId('pack-total').props.children).toBe('RM 9,000.00');
  });

  test('shares the pack as CSV text', async () => {
    const db = await freshDb();
    await seed(db);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await renderWithData(db, <TaxPack />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share as CSV' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Share as CSV' }));
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0] as { message: string; title: string };
    expect(arg.title).toBe('Duit tax relief pack 2025');
    expect(arg.message.split('\r\n')[0]).toBe('Year of assessment,2025');
    expect(arg.message).toContain('Total relief,14085.00');
  });

  test('a failed share never crashes the screen', async () => {
    const db = await freshDb();
    await seed(db);
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no share target'));
    await renderWithData(db, <TaxPack />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share as CSV' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Share as CSV' }));
    await waitFor(() => expect(screen.getByText('Could not share. Please try again.')).toBeTruthy());
  });

  test('is reachable from the Tax tab', async () => {
    const db = await freshDb();
    await renderWithData(db, <Tax />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tax filing pack' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Tax filing pack' }));
    expect(router.push).toHaveBeenCalledWith('/tax-pack');
  });
});
