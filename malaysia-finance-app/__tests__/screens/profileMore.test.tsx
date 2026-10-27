import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import More from '@/app/(tabs)/more';
import Settings from '@/app/settings';
import Profile from '@/app/profile';
import { freshDb, renderWithData } from './helpers';

const { router } = jest.requireMock('expo-router');

beforeEach(() => jest.clearAllMocks());

describe('More tab', () => {
  test('keeps screens that are reached from elsewhere out of the list', async () => {
    const db = await freshDb();
    await renderWithData(db, <More />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy());
    for (const gone of ['Tax calculator', 'Net worth', 'Extra income']) expect(screen.queryByText(gone)).toBeNull();
  });

  test('is grouped and links to income, budget, reports, wealth, tax, loans and settings', async () => {
    const db = await freshDb();
    await renderWithData(db, <More />);
    await waitFor(() => expect(screen.getByText('Income & profile')).toBeTruthy());
    for (const title of ['Money', 'Wealth', 'Tax & loans', 'Tools']) expect(screen.getByText(title)).toBeTruthy();
    for (const [label, path] of [
      ['Income & profile', '/profile'],
      ['Budget', '/budget'],
      ['Reports', '/reports'],
      ['Savings, EPF & giving', '/wealth'],
      ['Tax reliefs', '/tax'],
      ['Loan calculator', '/loan-calculator'],
      ['Settings', '/settings'],
    ] as const) {
      await fireEvent.press(screen.getByText(label));
      expect(router.push).toHaveBeenLastCalledWith(path);
    }
  });

  test('the appearance and language options are not loose in More any more', async () => {
    const db = await freshDb();
    await renderWithData(db, <More />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy());
    expect(screen.queryByText('Appearance')).toBeNull();
    expect(screen.queryByText('Language')).toBeNull();
  });

  test('Settings has no currency choice: the app is ringgit only', async () => {
    const db = await freshDb();
    await renderWithData(db, <Settings />);
    await waitFor(() => expect(screen.getByText('App lock')).toBeTruthy());
    expect(screen.queryByText('Default currency')).toBeNull();
    expect(screen.queryByRole('button', { name: 'USD' })).toBeNull();
  });

  test('Settings links to app lock, reminders, categories, payment methods and backup', async () => {
    const db = await freshDb();
    await renderWithData(db, <Settings />);
    await waitFor(() => expect(screen.getByText('App lock')).toBeTruthy());
    for (const [label, path] of [
      ['App lock', '/security'],
      ['Reminders & quick add', '/notifications-settings'],
      ['Categories', '/categories'],
      ['Payment methods', '/payment-methods'],
      ['Backup & sync', '/backup'],
    ] as const) {
      await fireEvent.press(screen.getByText(label));
      expect(router.push).toHaveBeenLastCalledWith(path);
    }
  });

  test('Settings shows appearance and language as rows with the current value, and picks from a sheet', async () => {
    const db = await freshDb();
    await renderWithData(db, <Settings />);
    await waitFor(() => expect(screen.getByText('Appearance')).toBeTruthy());
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    await fireEvent.press(screen.getByText('Appearance'));
    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByText('Dark')).toBeTruthy();
    await fireEvent.press(screen.getByText('Appearance'));
    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    await fireEvent.press(screen.getByText('Language'));
    await fireEvent.press(screen.getByRole('button', { name: 'Bahasa Malaysia' }));
    expect(screen.getByText('Tetapan')).toBeTruthy();
    await fireEvent.press(screen.getByText('Bahasa'));
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  });
});

describe('Income profile', () => {
  const profileRow = (db: Awaited<ReturnType<typeof freshDb>>) =>
    db.get<{ gross_monthly: number; net_monthly_override: number | null; epf_rate: number; socso_monthly: number; eis_monthly: number }>(
      'SELECT * FROM profile WHERE id = 1',
    );

  test('shows the saved profile and the estimated take-home pay', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET gross_monthly = 500000, socso_monthly = 1000, eis_monthly = 400 WHERE id = 1');
    await renderWithData(db, <Profile />);
    await waitFor(() => expect(screen.getByLabelText('Monthly salary before deductions').props.value).toBe('5000.00'));
    expect(screen.getByLabelText('EPF rate you pay (%)').props.value).toBe('11');
    // 5000 - 550 EPF - 10 SOCSO - 4 EIS; PCB for this salary is below the tax-free bands' first charge, so it is estimated at 0 or more
    expect(screen.getByText(/^Estimated take-home RM [\d,.]+, after EPF, SOCSO, EIS and income tax \(PCB\)$/)).toBeTruthy();
    expect(screen.getByText('SOCSO: - RM 10.00 (entered)')).toBeTruthy();
    expect(screen.getByText(/^Income tax \(PCB\): - RM [\d,.]+ \(estimated\)$/)).toBeTruthy();
  });

  test('an entered payslip PCB is saved and taken off the take-home pay', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET gross_monthly = 500000, socso_monthly = 1000, eis_monthly = 400 WHERE id = 1');
    await renderWithData(db, <Profile />);
    await waitFor(() => expect(screen.getByLabelText('Income tax (PCB) per month')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Income tax (PCB) per month'), '250.50');
    // 5000 - 550 EPF - 10 SOCSO - 4 EIS - 250.50 PCB
    expect(screen.getByText('Estimated take-home RM 4,185.50, after EPF, SOCSO, EIS and income tax (PCB)')).toBeTruthy();
    expect(screen.getByText('Income tax (PCB): - RM 250.50 (entered)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await db.get<{ pcb_monthly: number }>('SELECT pcb_monthly FROM profile'))!.pcb_monthly).toBe(25050);
  });

  test('saves salary, deductions and an optional take-home override in sen', async () => {
    const db = await freshDb();
    await renderWithData(db, <Profile />);
    await waitFor(() => expect(screen.getByLabelText('Monthly salary before deductions')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Monthly salary before deductions'), '6000');
    await fireEvent.changeText(screen.getByLabelText('Monthly take-home pay (optional)'), '5100');
    await fireEvent.changeText(screen.getByLabelText('EPF rate you pay (%)'), '9');
    await fireEvent.changeText(screen.getByLabelText('SOCSO per month'), '14.75');
    await fireEvent.changeText(screen.getByLabelText('EIS per month'), '11.80');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await profileRow(db)).toMatchObject({
      gross_monthly: 600000, net_monthly_override: 510000, epf_rate: 0.09, socso_monthly: 1475, eis_monthly: 1180,
    });
  });

  test('an empty take-home field clears the override', async () => {
    const db = await freshDb();
    await db.run('UPDATE profile SET gross_monthly = 500000, net_monthly_override = 420000 WHERE id = 1');
    await renderWithData(db, <Profile />);
    await waitFor(() => expect(screen.getByLabelText('Monthly take-home pay (optional)').props.value).toBe('4200.00'));
    await fireEvent.changeText(screen.getByLabelText('Monthly take-home pay (optional)'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await profileRow(db))!.net_monthly_override).toBeNull();
  });

  test('an invalid amount or EPF rate blocks saving', async () => {
    const db = await freshDb();
    await renderWithData(db, <Profile />);
    await waitFor(() => expect(screen.getByLabelText('Monthly salary before deductions')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Monthly salary before deductions'), '12.999');
    expect(screen.getByLabelText('Monthly salary before deductions').props.value).toBe('12.99');
    await fireEvent.changeText(screen.getByLabelText('Monthly salary before deductions'), '5000');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText('EPF rate you pay (%)'), '101');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
