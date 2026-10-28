import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Relief from '@/app/relief/[id]';
import { freshDb, renderWithData } from './helpers';

let mockToday = '2025-12-01';
jest.mock('@/hooks/useToday', () => ({ useToday: () => mockToday }));
jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u, useReceiptVersion: () => 0 }));
const { pickReceipt } = jest.requireMock('@/receipts');
const { useLocalSearchParams } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  mockToday = '2025-12-01';
  useLocalSearchParams.mockReturnValue({ id: 'lifestyle' });
});

const claimsIn = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ relief_id: string; year: number; amount: number; receipt_uri: string | null; note: string }>(
    'SELECT relief_id, year, amount, receipt_uri, note FROM relief_claims ORDER BY id',
  );

describe('Relief page', () => {
  test('shows the relief, its limit and an empty claims list', async () => {
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() =>
      expect(screen.getByText('Lifestyle: books, computer/phone/tablet, internet, skill courses')).toBeTruthy(),
    );
    expect(screen.getByText('RM 0.00 of RM 2,500.00')).toBeTruthy();
    expect(screen.getByText('No claims yet')).toBeTruthy();
  });

  test('adds a claim for the year of assessment and lists it', async () => {
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Add claim' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '1,200');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Phone');
    await fireEvent.press(screen.getByRole('button', { name: 'Add claim' }));
    await waitFor(() => expect(screen.getByText('Phone')).toBeTruthy());
    expect(await claimsIn(db)).toEqual([
      { relief_id: 'lifestyle', year: 2025, amount: 120000, receipt_uri: null, note: 'Phone' },
    ]);
    expect(screen.getByText('Receipt missing')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add another claim' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('');
  });

  test('a claim made in 2026 is filed under year 2026, not 2025', async () => {
    mockToday = '2026-10-24';
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '200');
    await fireEvent.press(screen.getByRole('button', { name: 'Add claim' }));
    await waitFor(async () => expect((await claimsIn(db)).length).toBe(1));
    expect((await claimsIn(db))[0].year).toBe(2026);
  });

  test('attaches a receipt photo to the claim', async () => {
    pickReceipt.mockResolvedValue('file:///docs/receipts/r1.jpg');
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '300');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await waitFor(() => expect(screen.getByText('Receipt attached')).toBeTruthy());
    expect(pickReceipt).toHaveBeenCalledWith('library');
    await fireEvent.press(screen.getByRole('button', { name: 'Add claim' }));
    await waitFor(async () => expect((await claimsIn(db)).length).toBe(1));
    expect((await claimsIn(db))[0].receipt_uri).toBe('file:///docs/receipts/r1.jpg');
    expect(screen.queryByText('Receipt missing')).toBeNull();
  });

  test('says how much is over the limit', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri) VALUES ('lifestyle', 2025, 300000, 'x')");
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText('RM 500.00 is above the limit and cannot be claimed')).toBeTruthy());
  });

  test('deletes a claim', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO relief_claims (relief_id, year, amount, receipt_uri, note) VALUES ('lifestyle', 2025, 10000, 'x', 'Book')");
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText('Book')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText('No claims yet')).toBeTruthy());
    expect(await claimsIn(db)).toEqual([]);
  });

  test('reliefs that do not need receipts show no receipt warning, but still allow a photo', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'epf' });
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '4000');
    await fireEvent.press(screen.getByRole('button', { name: 'Add claim' }));
    await waitFor(async () => expect((await claimsIn(db)).length).toBe(1));
    expect(screen.queryByText('Receipt missing')).toBeNull();
  });

  test('a saved claim can be edited and Cancel leaves it as it was', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'epf' });
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '4000');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'First');
    await fireEvent.press(screen.getByRole('button', { name: 'Add claim' }));
    await waitFor(async () => expect((await claimsIn(db)).length).toBe(1));
    // with a claim on file the form stays folded away until Edit or Add another claim
    expect(screen.queryByLabelText('Amount')).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('4000.00');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '2500');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect((await claimsIn(db))[0].amount).toBe(400000);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '2500');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await claimsIn(db))[0].amount).toBe(250000));
    expect((await claimsIn(db)).length).toBe(1);
  });

  test('per-child reliefs say to add one claim per child', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'child-under-18' });
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText('Add one claim for each child. Spending tagged here counts as one child. Add other children as separate claims.')).toBeTruthy());
  });

  test('an unknown relief id shows a not-found message', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'nope' });
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText('Relief not found')).toBeTruthy());
  });
});

describe('Relief page: per-child note', () => {
  test('explains that tagged spending counts as one child', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'child-higher-ed' });
    const db = await freshDb();
    await renderWithData(db, <Relief />);
    await waitFor(() => expect(screen.getByText(/Spending tagged here counts as one child/)).toBeTruthy());
  });
});
