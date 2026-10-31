import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Preparation from '@/app/tax-preparation';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-12-01' }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }), { virtual: true });
jest.mock('@/exportFile', () => ({ shareTextFile: jest.fn(async () => {}), shareBinaryFile: jest.fn(async () => {}) }));
jest.mock('@/sync/receiptFiles', () => ({ prepareReceipts: jest.fn(async () => {}), readReceiptBase64: jest.fn(async () => null) }));
const clipboard = jest.requireMock('expo-clipboard');

test('shows readiness and personal guide without creating claims', async () => {
  const db = await freshDb();
  await renderWithData(db, <Preparation />);
  await waitFor(() => expect(screen.getByRole('button', { name: '2025' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '2025' }));
  await waitFor(() => expect(screen.getByText('Tax preparation')).toBeTruthy());
  expect(screen.getByText('Answers and confirmations are temporary and are not saved or synced. Changing claims requires a fresh review.')).toBeTruthy();
  expect(screen.getByText('0 claims recorded')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Children' }));
  expect(screen.getByText('SSPN net deposit')).toBeTruthy();
  expect(await db.all('SELECT * FROM relief_claims')).toEqual([]);
});
test('only reviewed figures can be copied and editing invalidates review', async () => {
  const db = await freshDb();
  await db.run("INSERT INTO relief_claims (year, relief_id, amount, note, receipt_uri) VALUES (2025, 'lifestyle', 100000, 'Phone', 'receipts/a.jpg')");
  await renderWithData(db, <Preparation />);
  await waitFor(() => expect(screen.getByRole('button', { name: '2025' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '2025' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm eligibility: Lifestyle: books, computer/phone/tablet, internet, skill courses' })).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Copy amount: Lifestyle: books, computer/phone/tablet, internet, skill courses' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm eligibility: Lifestyle: books, computer/phone/tablet, internet, skill courses' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Copy amount: Lifestyle: books, computer/phone/tablet, internet, skill courses' }));
  expect(clipboard.setStringAsync).toHaveBeenCalledWith('1000.00');
  await fireEvent.press(screen.getByRole('button', { name: '2026' }));
  expect(screen.queryByRole('button', { name: 'Copy amount: Lifestyle: books, computer/phone/tablet, internet, skill courses' })).toBeNull();
  expect(screen.getByText('Planning only: confirmed filing figures are unavailable for this year.')).toBeTruthy();
});
test('missing evidence prevents confirmation and links to the claim', async () => {
  const db = await freshDb();
  await db.run("INSERT INTO relief_claims (year, relief_id, amount, note) VALUES (2025, 'lifestyle', 100000, 'Phone')");
  await renderWithData(db, <Preparation />);
  await waitFor(() => expect(screen.getByRole('button', { name: '2025' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '2025' }));
  await waitFor(() => expect(screen.getByText('1 receipt(s) missing')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Confirm eligibility: Lifestyle: books, computer/phone/tablet, internet, skill courses' })).toBeDisabled();
});
