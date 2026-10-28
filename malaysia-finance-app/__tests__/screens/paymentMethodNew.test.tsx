import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import PaymentMethodNew from '@/app/payment-method-new';
import { freshDb, renderWithData } from './helpers';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: jest.fn(), back: mockBack }) }));

beforeEach(() => jest.clearAllMocks());

const methods = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ name: string; kind: string }>('SELECT name, kind FROM payment_methods ORDER BY sort_order, id');

describe('Add payment method screen', () => {
  test('saves a typed name with a chosen kind and goes back', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethodNew />);
    await waitFor(() => expect(screen.getByLabelText('New payment method name')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('New payment method name'), ' Kad Setia ');
    await fireEvent.press(screen.getByRole('button', { name: 'Kind Credit card' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await methods(db)).find((m) => m.name === 'Kad Setia')).toEqual({ name: 'Kad Setia', kind: 'credit' });
  });

  test('a bank suggestion fills the name and kind, and is saved with Save', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethodNew />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Maybank' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Use Maybank' }));
    expect(screen.getByLabelText('New payment method name').props.value).toBe('Maybank');
    expect((await methods(db)).map((m) => m.name)).not.toContain('Maybank');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await methods(db)).find((m) => m.name === 'Maybank')).toEqual({ name: 'Maybank', kind: 'debit' });
  });

  test('refuses a name already used, ignoring case', async () => {
    const db = await freshDb();
    await renderWithData(db, <PaymentMethodNew />);
    await waitFor(() => expect(screen.getByLabelText('New payment method name')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('New payment method name'), 'cash');
    expect(screen.getByText('That name is already used')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
