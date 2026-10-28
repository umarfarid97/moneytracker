import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import CategoryNew from '@/app/category-new';
import { freshDb, renderWithData } from './helpers';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: jest.fn(), back: mockBack }) }));

beforeEach(() => jest.clearAllMocks());

const names = (db: Awaited<ReturnType<typeof freshDb>>) =>
  db.all<{ name: string }>('SELECT name FROM categories ORDER BY sort_order, id').then((rows) => rows.map((r) => r.name));

describe('Add category screen', () => {
  test('saves a typed name and goes back', async () => {
    const db = await freshDb();
    await renderWithData(db, <CategoryNew />);
    await waitFor(() => expect(screen.getByLabelText('New category name')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('New category name'), '  Kucing ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await names(db)).toContain('Kucing');
  });

  test('saves with a chosen icon', async () => {
    const db = await freshDb();
    await renderWithData(db, <CategoryNew />);
    await waitFor(() => expect(screen.getByLabelText('New category name')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Choose an icon' }));
    await fireEvent.press(screen.getByRole('button', { name: 'paw icon' }));
    await fireEvent.changeText(screen.getByLabelText('New category name'), 'Kucing');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const row = await db.get<{ icon: string }>("SELECT icon FROM categories WHERE name = 'Kucing'");
    expect(row?.icon).toBe('paw-outline');
  });

  test('a suggestion fills in the name and icon, and is saved with Save', async () => {
    const db = await freshDb();
    await renderWithData(db, <CategoryNew />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Petrol' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Use Petrol' }));
    expect(screen.getByLabelText('New category name').props.value).toBe('Petrol');
    expect(await names(db)).not.toContain('Petrol');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(await names(db)).toContain('Petrol');
  });

  test('refuses a name that is already used, ignoring case', async () => {
    const db = await freshDb();
    await renderWithData(db, <CategoryNew />);
    await waitFor(() => expect(screen.getByLabelText('New category name')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('New category name'), 'makan');
    expect(screen.getByText('That name is already used')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
