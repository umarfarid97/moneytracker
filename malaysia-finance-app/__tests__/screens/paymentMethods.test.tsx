import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import PaymentMethods from '@/app/payment-methods';
import { addExpenseRow, CAT, freshDb, renderWithData } from './helpers';

beforeEach(() => jest.clearAllMocks());

const methods = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ name: string; kind: string }>('SELECT name, kind FROM payment_methods ORDER BY sort_order, id');

describe('Payment methods screen', () => {
  test('lists the defaults with their kind; Cash can be neither renamed nor deleted', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethods />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename Credit card' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Rename E-wallet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename Debit card' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rename Cash' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Cash' })).toBeNull();
  });

  test('adds a method of a chosen kind', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethods />);
    await waitFor(() => expect(screen.getByLabelText('New payment method name')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Add payment method' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('New payment method name'), ' Maybank Visa ');
    await fireEvent.press(screen.getByRole('button', { name: 'Kind Credit card' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add payment method' }));
    await waitFor(() => expect(screen.getByText('Maybank Visa')).toBeTruthy());
    expect((await methods(db)).find((m) => m.name === 'Maybank Visa')).toEqual({ name: 'Maybank Visa', kind: 'credit' });
    expect(screen.getByLabelText('New payment method name').props.value).toBe('');
  });

  test('a bank preset fills the name and kind, then shows its badge once added', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethods />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Maybank' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Use Maybank' }));
    expect(screen.getByLabelText('New payment method name').props.value).toBe('Maybank');
    await fireEvent.press(screen.getByRole('button', { name: 'Add payment method' }));
    await waitFor(() => expect(screen.getByTestId('brand-maybank')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Use Maybank' })).toBeNull();
    expect((await methods(db)).find((m) => m.name === 'Maybank')).toEqual({ name: 'Maybank', kind: 'debit' });
  });

  test('refuses a name already used, ignoring case', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethods />);
    await waitFor(() => expect(screen.getByLabelText('New payment method name')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('New payment method name'), 'cash');
    expect(screen.getByText('That name is already used')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add payment method' })).toBeDisabled();
  });

  test('renames a method', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethods />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename E-wallet' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Rename E-wallet' }));
    await fireEvent.changeText(screen.getByLabelText('Payment method name'), 'Touch n Go');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Touch n Go')).toBeTruthy());
    expect((await methods(db)).map((m) => m.name)).toContain('Touch n Go');
  });

  test('deleting asks first, then moves its spending to Cash', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 500, '2026-10-20', 'teh');
    await db.run('UPDATE expenses SET payment_method_id = 3');
    await renderWithData(db, <PaymentMethods />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Credit card' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Credit card' }));
    expect(screen.getByText('Spending paid with Credit card moves to Cash.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm delete Credit card' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rename Credit card' })).toBeNull());
    expect(await db.get('SELECT payment_method_id AS id FROM expenses')).toEqual({ id: 1 });
  });
});
