import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Demo from '@/app/demo';
import { DemoBanner } from '@/features/demo/DemoBanner';
import { addExpense, listAllExpenses } from '@/db/repos/expenses';
import { CAT, freshDb, renderWithData } from './helpers';

const { confirmDelete } = jest.requireMock('@/ui/confirm');

beforeEach(() => confirmDelete.mockClear());

test('asks before loading, shows the banner, and clears only the demo data after asking', async () => {
  const db = await freshDb();
  await addExpense(db, { amount: 1234, categoryId: CAT.Makan, date: '2026-10-05', note: 'my own nasi', receiptUri: null });
  await renderWithData(db, <><DemoBanner /><Demo /></>);
  expect(screen.queryByText(/Demo data loaded\. Tap/)).toBeNull();

  await fireEvent.press(screen.getByText('Load demo data'));
  await waitFor(() => expect(screen.getByText('Demo data loaded.')).toBeTruthy());
  expect(confirmDelete).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText(/Demo data loaded\. Tap/).length).toBeGreaterThan(0);
  expect((await listAllExpenses(db)).length).toBeGreaterThan(1);

  await fireEvent.press(screen.getByText('Clear demo data'));
  await waitFor(() => expect(screen.getByText('Demo data cleared.')).toBeTruthy());
  expect(confirmDelete).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Demo data loaded\. Tap/)).toBeNull();
  expect((await listAllExpenses(db)).map((e) => e.note)).toEqual(['my own nasi']);
});

test('declining the confirmation changes nothing', async () => {
  const db = await freshDb();
  confirmDelete.mockResolvedValueOnce(false);
  await renderWithData(db, <Demo />);
  await fireEvent.press(screen.getByText('Load demo data'));
  await waitFor(() => expect(confirmDelete).toHaveBeenCalled());
  expect(await listAllExpenses(db)).toHaveLength(0);
});
