import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Commitments from '@/app/(tabs)/commitments';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-24' }));
jest.mock('@/notifications', () => ({ scheduleReminders: jest.fn(async () => 0), configureNotifications: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const rows = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<Record<string, unknown>>(
    `SELECT name, kind, amount, day_of_month, variable, category_id, loan_type, loan_balance, loan_balance_date,
            loan_original, loan_rate_pct FROM commitments ORDER BY id`,
  );

async function openAdd(db: Awaited<ReturnType<typeof freshDb>>, card: 'Bills' | 'Loan / Instalment' | 'Subscription' = 'Bills') {
  await renderWithData(db, <Commitments />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add commitment' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Add commitment' }));
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${card.replace('/', '\\/')}\\.`) }));
}

describe('biller presets', () => {
  test('picking TNB fills the name and makes the amount change monthly', async () => {
    const db = await freshDb();
    await openAdd(db);
    await fireEvent.press(screen.getByRole('button', { name: 'Biller TNB electricity' }));
    expect(screen.getByLabelText('Name').props.value).toBe('TNB electricity');
    expect(screen.getByLabelText('Estimated amount')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Estimated amount'), '150');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '28');
    await fireEvent.press(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(screen.getByText('TNB electricity')).toBeTruthy());
    expect(await rows(db)).toEqual([
      expect.objectContaining({ name: 'TNB electricity', kind: 'bill', amount: 15000, day_of_month: 28, variable: 1, category_id: 3 }),
    ]);
  });

  test('the Subscription type has its own quick picks, which set the kind and category', async () => {
    const db = await freshDb();
    await openAdd(db, 'Subscription');
    await fireEvent.press(screen.getByRole('button', { name: 'Subscription Netflix' }));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '55');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '12');
    await fireEvent.press(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(screen.getByText('Netflix')).toBeTruthy());
    expect(await rows(db)).toEqual([
      expect.objectContaining({ name: 'Netflix', kind: 'subscription', variable: 0, category_id: 5 }),
    ]);
  });

  test('Subscription suggestions appear together without type filters', async () => {
    const db = await freshDb();
    await openAdd(db, 'Subscription');
    expect(screen.getByRole('button', { name: 'Subscription Netflix' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Biller TNB electricity' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cloud storage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Streaming' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Subscription Google One' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'AI' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Subscription Claude' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Subscription ChatGPT' })).toBeTruthy();
  });

  test('bill suggestions include all types immediately without type filters', async () => {
    const db = await freshDb();
    await openAdd(db);
    expect(screen.queryByRole('button', { name: 'Utilities' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Internet' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Biller TNB electricity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Biller Unifi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Biller House rent' })).toBeTruthy();
  });

  test('a bill named after a biller gets its badge in the list', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO commitments (name, amount, day_of_month, kind, start_date) VALUES ('Unifi Home', 12900, 5, 'bill', '2026-10-01')");
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Unifi Home')).toBeTruthy());
    expect(screen.getByTestId('brand-unifi', { includeHiddenElements: true })).toBeTruthy();
  });

  test('presets are only offered when adding', async () => {
    const db = await freshDb();
    await db.run("INSERT INTO commitments (name, amount, day_of_month, kind, start_date) VALUES ('Water', 3000, 5, 'bill', '2026-10-01')");
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Water')).toBeTruthy());
    await fireEvent.press(screen.getByText('Water'));
    expect(screen.queryByRole('button', { name: 'Biller TNB electricity' })).toBeNull();
  });
});

describe('loans', () => {
  async function addPtptn(db: Awaited<ReturnType<typeof freshDb>>) {
    await openAdd(db, 'Loan / Instalment');
    await fireEvent.press(screen.getByRole('button', { name: 'PTPTN' }));
    expect(screen.getByLabelText('Name').props.value).toBe('PTPTN');
    await fireEvent.changeText(screen.getByLabelText('Monthly payment'), '200');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '28');
    await fireEvent.changeText(screen.getByLabelText('Still owed (optional)'), '10000');
    await fireEvent.changeText(screen.getByLabelText('Amount borrowed (optional)'), '20000');
    await fireEvent.press(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(screen.getByTestId('loan-line')).toBeTruthy());
  }

  test('a loan shows what is left, payments left and when it finishes', async () => {
    const db = await freshDb();
    await addPtptn(db);
    expect(await rows(db)).toEqual([
      expect.objectContaining({
        name: 'PTPTN', kind: 'loan', amount: 20000, loan_type: 'ptptn', loan_balance: 1000000,
        loan_balance_date: '2026-10-24', loan_original: 2000000, loan_rate_pct: null,
      }),
    ]);
    expect(screen.getByTestId('loan-line').props.children).toBe('RM 10,000.00 left · 50 payments left · done November 2030');
    expect(screen.getByText('Due in 4 days · Wed 28 Oct')).toBeTruthy();
    expect(screen.getByTestId('loans-owed').props.children).toBe('Still owed on loans RM 10,000.00');
  });

  test('marking a payment paid brings the balance down', async () => {
    const db = await freshDb();
    await addPtptn(db);
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid PTPTN' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('200.00');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm paid' }));
    await waitFor(() => expect(screen.getByTestId('loan-line').props.children).toMatch(/^RM 9,800.00 left · 49 payments left/));
    expect(screen.getByTestId('loans-owed').props.children).toBe('Still owed on loans RM 9,800.00');
  });

  test('the last payment is only what is left, then the loan is paid off', async () => {
    const db = await freshDb();
    await db.run(
      `INSERT INTO commitments (name, amount, day_of_month, kind, start_date, loan_type, loan_balance, loan_balance_date)
       VALUES ('Atome', 10000, 28, 'loan', '2026-10-01', 'bnpl', 4000, '2026-10-01')`,
    );
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark paid Atome' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Mark paid Atome' }));
    expect(screen.getByLabelText('Amount').props.value).toBe('40.00');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm paid' }));
    await waitFor(() => expect(screen.getByText('Paid off')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Mark paid Atome' })).toBeNull();
    expect(screen.queryByTestId('loans-owed')).toBeNull();
    expect(screen.getByTestId('commitments-total').props.children).toBe('RM 0.00');
  });

  test('pay later providers fill in the name', async () => {
    const db = await freshDb();
    await openAdd(db, 'Loan / Instalment');
    expect(screen.getByText('Suggestions')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pay later Atome' }));
    expect(screen.getByLabelText('Name').props.value).toBe('Atome');
    await fireEvent.press(screen.getByRole('button', { name: 'Pay later ShopeePayLater' }));
    expect(screen.getByLabelText('Name').props.value).toBe('ShopeePayLater');
  });

  test('every loan suggestion replaces the current name and only the chosen suggestion is selected', async () => {
    const db = await freshDb();
    await openAdd(db, 'Loan / Instalment');
    await fireEvent.press(screen.getByRole('button', { name: 'Pay later Grab PayLater' }));
    expect(screen.getByLabelText('Name').props.value).toBe('Grab PayLater');
    for (const label of ['Home loan', 'Car loan', 'PTPTN', 'Personal loan', 'Pay later', 'Installment']) {
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(screen.getByLabelText('Name').props.value).toBe(label);
      expect(screen.getByRole('button', { name: label }).props.accessibilityState.selected).toBe(true);
      expect(screen.getByRole('button', { name: 'Pay later Grab PayLater' }).props.accessibilityState.selected).toBe(false);
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Pay later Atome' }));
    expect(screen.getByLabelText('Name').props.value).toBe('Atome');
    expect(screen.getByRole('button', { name: 'Pay later' }).props.accessibilityState.selected).toBe(false);
  });

  test('a loan with no balance entered still works like before', async () => {
    const db = await freshDb();
    await openAdd(db, 'Loan / Instalment');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Car');
    await fireEvent.changeText(screen.getByLabelText('Monthly payment'), '800');
    await fireEvent.changeText(screen.getByLabelText('Day of month'), '1');
    await fireEvent.press(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(screen.getByText('Car')).toBeTruthy());
    expect(screen.queryByTestId('loan-line')).toBeNull();
    expect((await rows(db))[0]).toMatchObject({ kind: 'loan', loan_balance: null, loan_balance_date: null });
  });

  test('editing keeps the balance and its date unless the balance or rate is changed', async () => {
    const db = await freshDb();
    await db.run(
      `INSERT INTO commitments (name, amount, day_of_month, kind, start_date, loan_type, loan_balance, loan_balance_date)
       VALUES ('Home loan', 100000, 28, 'loan', '2026-09-01', 'home', 20000000, '2026-09-01')`,
    );
    await db.run(
      `INSERT INTO expenses (amount, category_id, date, note, commitment_id, due_date)
       VALUES (100000, 3, '2026-09-28', 'Home loan', 1, '2026-09-28')`,
    );
    await renderWithData(db, <Commitments />);
    await waitFor(() => expect(screen.getByText('Home loan')).toBeTruthy());
    await fireEvent.press(screen.getByText('Home loan'));
    // The field shows what is owed now, after the payment.
    expect(screen.getByLabelText('Still owed (optional)').props.value).toBe('199000.00');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Home loan CIMB');
    await fireEvent.press(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(screen.getByText('Home loan CIMB')).toBeTruthy());
    expect((await rows(db))[0]).toMatchObject({ loan_balance: 20000000, loan_balance_date: '2026-09-01' });

    await fireEvent.press(screen.getByText('Home loan CIMB'));
    await fireEvent.changeText(screen.getByLabelText('Still owed (optional)'), '1950000');
    await fireEvent.press(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(screen.getByTestId('loan-line').props.children).toMatch(/^RM 1,950,000.00 left/));
    expect((await rows(db))[0]).toMatchObject({ loan_balance: 195000000, loan_balance_date: '2026-10-24' });
  });
});
