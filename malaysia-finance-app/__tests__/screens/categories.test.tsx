import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Categories from '@/app/categories';
import { addExpenseRow, CAT, freshDb, renderWithData, setBudgetRow } from './helpers';

beforeEach(() => jest.clearAllMocks());

const names = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ name: string }>('SELECT name FROM categories ORDER BY sort_order, id').then((rows) => rows.map((r) => r.name));

describe('Categories screen', () => {
  test('lists every category; Lain-lain, the fallback, can be neither renamed nor deleted', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByText('Makan')).toBeTruthy());
    expect(screen.getByText('Lain-lain')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename Makan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rename Lain-lain' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Lain-lain' })).toBeNull();
  });

  test('adds a category', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByLabelText('New category name')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('New category name'), '  Kucing ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => expect(screen.getByText('Kucing')).toBeTruthy());
    expect((await names(db)).includes('Kucing')).toBe(true);
    expect(screen.getByLabelText('New category name').props.value).toBe('');
  });

  test('adds a suggested Malaysian category with one tap and stops suggesting it', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Petrol' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Add Petrol' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add Petrol' })).toBeNull());
    expect((await names(db)).includes('Petrol')).toBe(true);
  });

  test('adds a category with a chosen icon', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByLabelText('New category name')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Choose an icon' }));
    await fireEvent.press(screen.getByRole('button', { name: 'paw icon' }));
    await fireEvent.changeText(screen.getByLabelText('New category name'), 'Kucing');
    await fireEvent.press(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => expect(screen.getByText('Kucing')).toBeTruthy());
    const row = await db.get<{ icon: string }>("SELECT icon FROM categories WHERE name = 'Kucing'");
    expect(row?.icon).toBe('paw-outline');
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

  test('refuses a name that is already used, ignoring case', async () => {
    const db = await freshDb();
    await renderWithData(db, <Categories />);
    await waitFor(() => expect(screen.getByLabelText('New category name')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('New category name'), 'makan');
    expect(screen.getByText('That name is already used')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
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
