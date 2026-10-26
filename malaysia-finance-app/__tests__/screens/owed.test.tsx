import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Owed from '@/app/owed';
import Project from '@/app/project';
import { buildShare } from '@/domain/projectShare';
import { freshDb, renderWithData } from './helpers';

jest.mock('@/hooks/useToday', () => ({ useToday: () => '2026-10-26' }));
jest.mock('@/ui/confirm', () => ({ confirmDelete: jest.fn(() => Promise.resolve(true)) }));
const { router, useLocalSearchParams } = jest.requireMock('expo-router');

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({});
});

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
/** The sheet opens on top of the screen, so a name shown in both is pressed in the sheet (the last one). */
const pressTop = (name: string) => fireEvent.press(screen.getAllByRole('button', { name }).at(-1)!);

/** A project with Aina and Ben in it; returns its id. */
async function trip(db: Awaited<ReturnType<typeof freshDb>>, members = 'Aina\nBen') {
  await db.run(`INSERT INTO owed_projects (name, members) VALUES ('Penang trip', ?)`, [members]);
  const row = await db.get<{ id: number }>(`SELECT id FROM owed_projects WHERE name = 'Penang trip'`);
  useLocalSearchParams.mockReturnValue({ id: String(row!.id) });
  return row!.id;
}

describe('Others', () => {
  test('lists projects, starting with the General one, and creating a project opens it', async () => {
    const db = await freshDb();
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'General' })).toBeTruthy());
    expect(screen.getByText('Others')).toBeTruthy();

    await press('New project');
    await type('Project name', 'Penang trip');
    await type('Add a person', 'Aina');
    await press('Add');
    await press('Create project');
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const row = await db.get<{ id: number; members: string }>(`SELECT id, members FROM owed_projects WHERE name = 'Penang trip'`);
    expect(row!.members).toBe('Aina');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/project', params: { id: String(row!.id) } });
  });

  test('a project row shows its people and balance, and the total adds up across projects', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES
      ('Aina', 'lent', 3000, '2026-10-10', ?), ('Ben', 'lent', 2000, '2026-10-11', ?)`, [id, id]);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 500, '2026-10-20', (SELECT id FROM owed_projects WHERE uid = 'proj-general'))`);
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Penang trip' })).toBeTruthy());
    expect(screen.getByTestId('owed-total').props.children).toBe('RM 55.00');
    expect(screen.getByText('2 people · you are owed RM 50.00')).toBeTruthy();

    await press('By person');
    expect(screen.getByText('owes you RM 35.00')).toBeTruthy();
  });

  test('settling a person from the overall view settles them in every project', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 3000, '2026-10-10', ?)`, [id]);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 500, '2026-10-20', (SELECT id FROM owed_projects WHERE uid = 'proj-general'))`);
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'By person' })).toBeTruthy());
    await press('By person');
    await press('Aina');
    await press('Settle up with Aina');
    await waitFor(() => expect(screen.getByTestId('owed-total').props.children).toBe('RM 0.00'));
    expect(await db.all(`SELECT amount, project_id FROM owed_entries WHERE kind = 'repaid' ORDER BY amount`)).toHaveLength(2);
  });

  test('importing a project a friend shared adds it from my point of view', async () => {
    const db = await freshDb();
    const shared = buildShare(
      { id: 2, uid: 'x', name: 'Langkawi', startDate: null, endDate: null, members: ['Aina', 'Ben'], owner: '' },
      [{ id: 1, person: 'Aina', kind: 'lent', amount: 4000, date: '2026-10-11', note: 'Hotel', projectId: 2 }],
      'Umar',
    );
    await renderWithData(db, <Owed />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import shared project' })).toBeTruthy());
    await press('Import shared project');
    await fireEvent.changeText(screen.getByLabelText('Shared text'), shared);
    await press('Who are you in this project? Aina');
    await press('Import');
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(await db.get(`SELECT e.person AS person, e.kind AS kind, e.amount AS amount, p.name AS project, p.owner AS owner
      FROM owed_entries e JOIN owed_projects p ON p.id = e.project_id WHERE p.name = 'Langkawi'`)).toEqual({
      person: 'Umar', kind: 'borrowed', amount: 4000, project: 'Langkawi', owner: 'Umar',
    });
  });
});

describe('A project', () => {
  test('lending inside a project records it under the project and adds a new person to it', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lend or borrow' })).toBeTruthy());
    await press('Lend or borrow');
    await type('Person', 'Chen');
    await type('Amount', '20');
    await press('Save');
    await waitFor(() => expect(screen.getByTestId('project-owed').props.children).toBe('RM 20.00'));
    expect(await db.get('SELECT person, amount, project_id AS p FROM owed_entries')).toEqual({ person: 'Chen', amount: 2000, p: id });
    expect(await db.get('SELECT members FROM owed_projects WHERE id = ?', [id])).toEqual({ members: 'Aina\nBen\nChen' });
  });

  test('settle per person inside the project', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 3000, '2026-10-10', ?), ('Ben', 'lent', 2000, '2026-10-11', ?)`, [id, id]);
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByTestId('project-owed').props.children).toBe('RM 50.00'));
    await press('Settle Ben');
    await waitFor(() => expect(screen.getByTestId('project-owed').props.children).toBe('RM 30.00'));
  });

  test('splitting a bill I paid with a different amount per person', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await press('Split a bill');
    await type('Total bill (you paid)', '100');
    await pressTop('Aina');
    await pressTop('Ben');
    await press('Amounts');
    await type('Amount for Aina', '25');
    await type('Amount for Ben', '40');
    expect(screen.getByTestId('split-mine').props.children).toBe('Left for you: RM 35.00');
    await type('Amount for Ben', '90');
    expect(screen.getByTestId('split-mine').props.children).toBe('Over by RM 15.00. Lower someone\'s part.');
    expect(screen.getByRole('button', { name: 'Save split' })).toBeDisabled();
    await type('Amount for Ben', '40');
    await press('Save split');
    await waitFor(() => expect(screen.getByTestId('project-owed').props.children).toBe('RM 65.00'));
    expect(await db.all('SELECT person, amount, project_id AS p FROM owed_entries ORDER BY id')).toEqual([
      { person: 'Aina', amount: 2500, p: id }, { person: 'Ben', amount: 4000, p: id },
    ]);
  });

  test('a bill someone else paid is recorded as money I owe them, and my share can be spending', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await press('Split a bill');
    await type('Total bill (you paid)', '90');
    await type('What was it for?', 'Hotel');
    await press('Paid by Aina');
    await pressTop('Ben');
    // Equal between me, Aina (who paid) and Ben.
    expect(screen.getByTestId('split-mine').props.children).toBe('Your share is RM 30.00');
    await press('Also record my share as spending');
    await press('Save split');
    await waitFor(() => expect(screen.getByTestId('project-iowe').props.children).toEqual(['You owe', ': ', 'RM 30.00']));
    expect(await db.all('SELECT person, kind, amount, project_id AS p FROM owed_entries')).toEqual([
      { person: 'Aina', kind: 'borrowed', amount: 3000, p: id },
    ]);
    expect(await db.all('SELECT amount, note FROM expenses')).toEqual([{ amount: 3000, note: 'Hotel' }]);
  });

  test('percent and shares split the bill by the numbers typed', async () => {
    const db = await freshDb();
    await trip(db, 'Aina');
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Split a bill' })).toBeTruthy());
    await press('Split a bill');
    await type('Total bill (you paid)', '100');
    await pressTop('Aina');
    await press('Percent');
    await type('Percent for Aina', '30');
    expect(screen.getByText('Aina owes you RM 30.00')).toBeTruthy();
    expect(screen.getByText('Your part is 70%')).toBeTruthy();
    await press('Shares');
    await type('Shares for Aina', '3');
    expect(screen.getByText('Aina owes you RM 75.00')).toBeTruthy();
  });

  test('editing the project changes its name and people; deleting removes its entries', async () => {
    const db = await freshDb();
    const id = await trip(db);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 3000, '2026-10-10', ?)`, [id]);
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit project' })).toBeTruthy());
    await press('Edit project');
    await type('Project name', 'Penang holiday');
    await press('Remove Ben');
    await press('Save');
    await waitFor(() => expect(screen.getByText('Penang holiday')).toBeTruthy());
    expect(await db.get('SELECT name, members FROM owed_projects WHERE id = ?', [id])).toEqual({ name: 'Penang holiday', members: 'Aina' });

    await press('Edit project');
    await press('Delete');
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await db.all('SELECT 1 FROM owed_entries')).toEqual([]);
    expect(await db.all('SELECT 1 FROM owed_projects WHERE id = ?', [id])).toEqual([]);
  });

  test('sharing builds the readable summary with who pays whom', async () => {
    const { Share } = require('react-native');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const db = await freshDb();
    const id = await trip(db);
    await db.run(`INSERT INTO owed_entries (person, kind, amount, date, project_id) VALUES ('Aina', 'lent', 3000, '2026-10-10', ?)`, [id]);
    await renderWithData(db, <Project />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share summary' })).toBeTruthy());
    await press('Share summary');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await type('Your name in the share', 'Umar');
    await press('Send');
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect((share.mock.calls[0][0] as { message: string }).message).toContain('Aina pays Umar RM 30.00');
    expect(await db.get(`SELECT value FROM sync_state WHERE key = 'share_name'`)).toEqual({ value: 'Umar' });
  });
});
