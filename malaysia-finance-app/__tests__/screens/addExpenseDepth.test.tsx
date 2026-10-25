import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddExpense from '@/app/add-expense';
import { addExpenseRow, CAT, freshDb, renderWithData, setBudgetRow } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/notifications', () => ({ notifyBudgetAlert: jest.fn(async () => undefined) }));
jest.mock('@/receipts', () => ({ pickReceipt: jest.fn(), resolveReceiptUri: (u: string) => u }));
const { notifyBudgetAlert } = jest.requireMock('@/notifications');
const { router, useLocalSearchParams } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
});

const LIFESTYLE = 'Lifestyle: books, computer/phone/tablet, internet, skill courses';
const MEDICAL = 'Medical: serious diseases and fertility treatment';
type TestDb = Awaited<ReturnType<typeof freshDb>>;
const saved = (db: TestDb) =>
  db.get<{ payment_method_id: number | null; relief_id: string | null; relief_amount: number | null; amount: number }>(
    'SELECT payment_method_id, relief_id, relief_amount, amount FROM expenses ORDER BY id DESC LIMIT 1',
  );
async function ready(db: TestDb) {
  await renderWithData(db, <AddExpense />);
  await waitFor(() => expect(screen.getByLabelText('Amount')).toBeTruthy());
}
async function pickRelief(search: string, name: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Tax relief' }));
  await fireEvent.changeText(screen.getByLabelText('Search reliefs'), search);
  await fireEvent.press(screen.getByText(name));
}

describe('AddExpense (payment method)', () => {
  test('defaults to Cash and saves the chosen method', async () => {
    const db = await freshDb();
    await ready(db);
    expect(screen.getByRole('button', { name: 'Cash' })).toBeSelected();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Credit card' }));
    expect(screen.getByRole('button', { name: 'Credit card' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await saved(db))!.payment_method_id).toBe(3);
  });
});

describe('AddExpense (tax relief tag)', () => {
  test('picks a relief from the searchable list and saves the tag', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '200');
    await pickRelief('lifestyle', LIFESTYLE);
    expect(screen.getAllByText(LIFESTYLE).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await saved(db)).toMatchObject({ relief_id: 'lifestyle', relief_amount: null, amount: 20000 });
  });

  test('the search narrows the list and None clears the tag', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.press(screen.getByRole('button', { name: 'Tax relief' }));
    await fireEvent.changeText(screen.getByLabelText('Search reliefs'), 'zakat nonsense');
    expect(screen.queryByText(LIFESTYLE)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search reliefs'), 'books');
    expect(screen.getByText(LIFESTYLE)).toBeTruthy();
    await fireEvent.press(screen.getByText(LIFESTYLE));
    expect(screen.getByLabelText('Claimable amount (optional)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tax relief' }));
    await fireEvent.press(screen.getByText('No tax relief'));
    expect(screen.queryByLabelText('Claimable amount (optional)')).toBeNull();
  });

  test('a health category suggests the medical relief, which one tap applies', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '50');
    await fireEvent.press(screen.getByRole('button', { name: 'Kesihatan' }));
    await fireEvent.press(screen.getByRole('button', { name: `Count toward ${MEDICAL}?` }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await saved(db))!.relief_id).toBe('medical-serious');
  });

  test('no suggestion for ordinary categories', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.press(screen.getByRole('button', { name: 'Makan' }));
    expect(screen.queryByText(/^Count toward/)).toBeNull();
  });

  test('a claimable part can be entered, never more than the amount', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '200');
    await pickRelief('lifestyle', LIFESTYLE);
    await fireEvent.changeText(screen.getByLabelText('Claimable amount (optional)'), '250');
    expect(screen.getByText('Cannot be more than the amount spent')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Claimable amount (optional)'), '40');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await saved(db)).toMatchObject({ relief_id: 'lifestyle', relief_amount: 4000 });
  });

  test('says when the relief needs a receipt and none is attached', async () => {
    const db = await freshDb();
    await ready(db);
    await pickRelief('lifestyle', LIFESTYLE);
    expect(screen.getByText('This relief needs a receipt. Add a photo above.')).toBeTruthy();
    await pickRelief('EPF', 'EPF / approved pension scheme contributions');
    expect(screen.queryByText('This relief needs a receipt. Add a photo above.')).toBeNull();
  });

  test('editing shows the saved method, relief and claimable amount', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO expenses (amount, category_id, date, note, payment_method_id, relief_id, relief_amount) VALUES (20000, 1, '2026-10-20', 'Phone case', 3, 'lifestyle', 4000)");
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount').props.value).toBe('200.00'));
    expect(screen.getByRole('button', { name: 'Credit card' })).toBeSelected();
    expect(screen.getByLabelText('Claimable amount (optional)').props.value).toBe('40.00');
    expect(screen.getAllByText(LIFESTYLE).length).toBeGreaterThan(0);
  });
});

describe('AddExpense (recent)', () => {
  test('recent entries re-fill the form in one tap', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO expenses (amount, category_id, date, note, payment_method_id, relief_id) VALUES (350, 2, '2026-10-20', 'Teh tarik', 4, 'lifestyle')");
    await ready(db);
    await fireEvent.press(screen.getByRole('button', { name: 'Recent: Teh tarik' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('3.50');
    expect(screen.getByLabelText('Note').props.value).toBe('Teh tarik');
    expect(screen.getByRole('button', { name: 'Transport' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'E-wallet' })).toBeSelected();
    expect(screen.getAllByText(LIFESTYLE).length).toBeGreaterThan(0);
  });

  test('not shown when editing', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Makan, 350, '2026-10-20', 'Teh tarik');
    useLocalSearchParams.mockReturnValue({ id: '1' });
    await renderWithData(db, <AddExpense />);
    await waitFor(() => expect(screen.getByLabelText('Amount').props.value).toBe('3.50'));
    expect(screen.queryByRole('button', { name: 'Recent: Teh tarik' })).toBeNull();
  });
});

describe('AddExpense (note suggestions)', () => {
  test('typing offers a default note that also picks its category', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Note'), 'pet');
    await fireEvent.press(screen.getByRole('button', { name: 'Suggestion: Petrol' }));
    expect(screen.getByLabelText('Note').props.value).toBe('Petrol');
    expect(screen.getByRole('button', { name: 'Transport' })).toBeSelected();
  });

  test('typing offers recent spending, which keeps an amount already typed', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO expenses (amount, category_id, date, note, payment_method_id) VALUES (350, 2, '2026-10-20', 'Teh tarik', 4)");
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '4.20');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'teh');
    expect(screen.queryByRole('button', { name: 'Suggestion: Teh tarik' })).toBeNull(); // the recent one wins
    await fireEvent.press(screen.getByRole('button', { name: 'Recent: Teh tarik' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('4.20');
    expect(screen.getByRole('button', { name: 'Transport' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'E-wallet' })).toBeSelected();
    expect(screen.queryByRole('button', { name: 'Recent: Teh tarik' })).toBeNull(); // chosen, so no longer offered
  });
});

describe('AddExpense (budget warning)', () => {
  test('warns once when a save takes a category to 80% or over its budget', async () => {
    const db = await freshDb();
    await setBudgetRow(db, CAT.Makan, '2026-10', 10000);
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '20');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(notifyBudgetAlert).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '65');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(2));
    expect(notifyBudgetAlert).toHaveBeenCalledTimes(1);
    expect(notifyBudgetAlert).toHaveBeenCalledWith('Makan', { status: 'tight', spent: 8500, limit: 10000 });
  });
});

describe('AddExpense (claimable part after clearing the relief)', () => {
  test('a leftover claimable amount cannot silently block saving', async () => {
    const db = await freshDb();
    await ready(db);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '200');
    await pickRelief('lifestyle', LIFESTYLE);
    await fireEvent.changeText(screen.getByLabelText('Claimable amount (optional)'), '50');
    await fireEvent.press(screen.getByRole('button', { name: 'Tax relief' }));
    await fireEvent.press(screen.getByText('No tax relief'));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '30');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await saved(db)).toMatchObject({ relief_id: null, relief_amount: null, amount: 3000 });
  });
});
