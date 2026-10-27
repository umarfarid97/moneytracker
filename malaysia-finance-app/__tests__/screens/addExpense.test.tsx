import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddExpense from '@/app/add-expense';
import { addExpenseRow, CAT, freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u, useReceiptVersion: () => 0 }));
jest.mock('@/receiptScan', () => ({ scanReceipt: jest.fn().mockResolvedValue(null) }));
const { scanReceipt } = jest.requireMock('@/receiptScan');
const { pickReceipt } = jest.requireMock('@/receipts');
const { router, useLocalSearchParams } = jest.requireMock('expo-router');
const { confirmDelete } = jest.requireMock('@/ui/confirm');

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
});

describe('AddExpense (new)', () => {
  test('save stays disabled until the amount is valid', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Amount'), 'abc');
    expect(screen.getByLabelText('Amount').props.value).toBe('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.50');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('amount, category, save: stores today in sen and closes', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.50');
    await fireEvent.press(screen.getByRole('button', { name: 'Transport' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const rows = await db.all<{ amount: number; category_id: number; date: string }>(
      'SELECT amount, category_id, date FROM expenses',
    );
    expect(rows).toEqual([{ amount: 1250, category_id: CAT.Transport, date: '2026-10-24' }]);
  });

  test('yesterday chip sets yesterday', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Yesterday' }));
    expect(screen.getByText('Fri 23 Oct 2026')).toBeTruthy();
  });

  test('a date picked from the calendar is saved', async () => {
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Date' }));
    await fireEvent(screen.getByTestId('date-picker'), 'valueChange', {}, new Date(2026, 9, 12));
    expect(screen.getByText('Mon 12 Oct 2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const row = await db.get<{ date: string }>('SELECT date FROM expenses');
    expect(row!.date).toBe('2026-10-12');
  });
});

describe('AddExpense (receipt)', () => {
  test('a photo can be attached, saved with the expense and removed', async () => {
    pickReceipt.mockResolvedValue('file:///docs/receipts/r1.jpg');
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await waitFor(() => expect(screen.getByText('Receipt attached')).toBeTruthy());
    expect(pickReceipt).toHaveBeenCalledWith('camera');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Receipt attached')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await waitFor(() => expect(screen.getByText('Receipt attached')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const row = await db.get<{ receipt_uri: string }>('SELECT receipt_uri FROM expenses');
    expect(row!.receipt_uri).toBe('file:///docs/receipts/r1.jpg');
  });

  test('cancelling the picker leaves no receipt', async () => {
    pickReceipt.mockResolvedValue(null);
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    expect(screen.queryByText('Receipt attached')).toBeNull();
  });
});

describe('AddExpense (receipt scan)', () => {
  test('a scanned receipt fills the empty amount, merchant and SST, and keeps typed values', async () => {
    pickReceipt.mockResolvedValue('receipts/r2.jpg');
    scanReceipt.mockResolvedValueOnce({ total: 4590, sst: 340, merchant: 'Mr Diy', date: '2026-10-12' });
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await waitFor(() => expect(screen.getByText(/Read from the receipt: total RM 45.90, SST RM 3.40/)).toBeTruthy());
    expect(screen.getByLabelText('Amount').props.value).toBe('45.90');
    expect(screen.getByLabelText('Note').props.value).toBe('Mr Diy');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const row = await db.get<{ amount: number; sst: number; note: string; date: string }>('SELECT amount, sst, note, date FROM expenses');
    expect(row).toEqual({ amount: 4590, sst: 340, note: 'Mr Diy', date: '2026-10-12' });
  });

  test('says so when nothing could be read', async () => {
    pickReceipt.mockResolvedValue('receipts/r3.jpg');
    scanReceipt.mockResolvedValueOnce(null);
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await waitFor(() => expect(screen.getByText('Could not read this receipt. Type the details in.')).toBeTruthy());
  });
});

describe('AddExpense (view)', () => {
  test('a saved spending opens read-only until Edit is tapped', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO expenses (amount, category_id, date, note, payment_method_id, relief_id, relief_amount) VALUES (20000, 1, '2026-10-20', 'Phone case', 3, 'lifestyle', 4000)");
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByTestId('expense-amount').props.children).toBe('RM 200.00'));
    expect(screen.getByText('Spending details')).toBeTruthy();
    expect(screen.getByText('Phone case')).toBeTruthy();
    expect(screen.getByText('Tue 20 Oct 2026')).toBeTruthy();
    expect(screen.getByText('Credit card')).toBeTruthy();
    expect(screen.getByText('RM 40.00')).toBeTruthy();
    expect(screen.getByText('No receipt attached')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Edit spending')).toBeTruthy();
    expect(screen.getByLabelText('Amount').props.value).toBe('200.00');
  });

  test('Close leaves without changes, and Delete works from the view', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-20', 'nasi lemak');
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(2));
    expect(await db.get('SELECT id FROM expenses WHERE id = 1')).toBeNull();
  });
});

describe('AddExpense (edit)', () => {
  test('prefills from the saved expense, saves changes and can delete', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-20', 'nasi lemak');
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Amount').props.value).toBe('12.50'));
    expect(screen.getByLabelText('Note').props.value).toBe('nasi lemak');
    await fireEvent.changeText(screen.getByLabelText('Amount'), '15');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect((await db.get<{ amount: number }>('SELECT amount FROM expenses WHERE id = 1'))!.amount).toBe(1500);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(2));
    expect(await db.get('SELECT id FROM expenses WHERE id = 1')).toBeNull();
  });
});

describe('AddExpense (safety and receipts)', () => {
  test('deleting asks first, and Cancel keeps the spending', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 1250, '2026-10-20', 'nasi lemak');
    useLocalSearchParams.mockReturnValue({ id: '1' });
    confirmDelete.mockResolvedValueOnce(false);
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByTestId('expense-amount').props.children).toBe('RM 12.50'));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(confirmDelete).toHaveBeenCalledWith(
      'Delete this spending?', 'nasi lemak, RM 12.50, will be removed. This cannot be undone.', 'Delete', 'Cancel',
    ));
    expect(router.back).not.toHaveBeenCalled();
    expect(await db.get('SELECT id FROM expenses WHERE id = 1')).not.toBeNull();
  });

  test('an attached receipt opens full screen and closes again', async () => {
    pickReceipt.mockResolvedValue('file:///docs/receipts/r1.jpg');
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Choose photo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'View receipt' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'View receipt' }));
    expect(screen.getByLabelText('Receipt, full screen')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Receipt, full screen')).toBeNull();
  });
});

describe('AddExpense layout', () => {
  const RN = jest.requireActual('react-native');
  const size = (width: number, height: number) =>
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width, height, scale: 2, fontScale: 1 });
  afterEach(() => jest.restoreAllMocks());

  test.each([
    ['phone', 390, 844],
    ['tablet portrait', 920, 1400],
    ['tablet landscape', 1400, 920],
  ])('saves on a %s', async (_name, width, height) => {
    size(width, height);
    const db = await freshDb();
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Amount'), '8.20');
    await fireEvent.press(screen.getByRole('button', { name: 'Hiburan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.all('SELECT amount, category_id FROM expenses')).toEqual([{ amount: 820, category_id: CAT.Hiburan }]);
    // Every size shows the receipt area that fills the free space.
    expect(screen.getByText('No receipt yet. Snap a photo or attach a file (PDF, Word, Excel) so it is ready at tax time.')).toBeTruthy();
  });
});
