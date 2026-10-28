import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Categories from '@/app/categories';
import { addExpenseRow, CAT, freshDb, renderWithData, setBudgetRow } from './helpers';

beforeEach(() => jest.clearAllMocks());

const names = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ name: string }>('SELECT name FROM categories ORDER BY sort_order, id').then((rows) => rows.map((r) => r.name));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

describe('Categories screen', () => {
  test('shows only the list and an Add new button, which opens the add page', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByText('Makan')).toBeTruthy());
    expect(screen.queryByLabelText('New category name')).toBeNull();
    expect(screen.queryByText('Suggestions')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add new' }));
    expect(mockPush).toHaveBeenCalledWith('/category-new');
  });

  test('lists every category; Lain-lain, the fallback, can be neither renamed nor deleted', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByText('Makan')).toBeTruthy());
    expect(screen.getByText('Lain-lain')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename Makan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rename Lain-lain' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Lain-lain' })).toBeNull();
  });

  test('changes the icon of an existing category', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change icon for Makan' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Change icon for Makan' }));
    expect(screen.getByRole('button', { name: 'fast food icon' }).props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByRole('button', { name: 'pizza icon' }));
    await waitFor(async () => {
      const row = await db.get<{ icon: string }>("SELECT icon FROM categories WHERE name = 'Makan'");
      expect(row?.icon).toBe('pizza-outline');
    });
    expect(screen.queryByRole('button', { name: 'pizza icon' })).toBeNull();
  });

  test('renames a category', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename Hiburan' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Rename Hiburan' }));
    await fireEvent.changeText(screen.getByLabelText('Category name'), 'Santai');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Santai')).toBeTruthy());
    expect(screen.queryByText('Hiburan')).toBeNull();
    expect((await names(db))).toContain('Santai');
  });

  test('deleting asks first, then moves its expenses to Lain-lain and removes its budgets', async () => {
    const db = await freshDb();
    await addExpenseRow(db, CAT.Hiburan, 5000, '2026-10-20', 'wayang');
    await setBudgetRow(db, CAT.Hiburan, '2026-10', 20000);
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Hiburan' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Hiburan' }));
    expect(screen.getByText('Expenses in Hiburan move to Lain-lain. Its budgets are removed.')).toBeTruthy();
    expect((await names(db))).toContain('Hiburan');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm delete Hiburan' }));
    await waitFor(() => expect(screen.queryByText('Hiburan')).toBeNull());
    expect(await names(db)).not.toContain('Hiburan');
    expect(await db.get('SELECT category_id FROM expenses WHERE note = ?', ['wayang'])).toEqual({ category_id: CAT.Lain });
    expect(await db.all('SELECT 1 FROM budgets')).toEqual([]);
  });

  test('cancel leaves the category alone', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Bil' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Bil' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/move to Lain-lain/)).toBeNull();
    expect(await names(db)).toContain('Bil');
  });
});
