import { DEFAULT_PROJECT_UID } from '@/db/migrations';
import type { NewOwedEntry, NewOwedProject, OwedEntry, OwedProject } from '@/domain/owed';
import type { Db } from '../types';

const ENTRIES = `SELECT id, person, kind, amount, date, note, counter,
  COALESCE(project_id, (SELECT id FROM owed_projects WHERE uid = '${DEFAULT_PROJECT_UID}')) AS projectId FROM owed_entries`;

export function listOwedEntries(db: Db): Promise<OwedEntry[]> {
  return db.all<OwedEntry>(`${ENTRIES} ORDER BY date DESC, id DESC`);
}

export async function addOwedEntry(db: Db, input: NewOwedEntry): Promise<OwedEntry> {
  const r = await db.run('INSERT INTO owed_entries (person, kind, amount, date, note, project_id, counter) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    input.person, input.kind, input.amount, input.date, input.note, input.projectId, input.counter,
  ]);
  return { id: r.lastInsertRowId, ...input };
}

export async function updateOwedEntry(db: Db, e: OwedEntry): Promise<void> {
  await db.run('UPDATE owed_entries SET person = ?, kind = ?, amount = ?, date = ?, note = ?, project_id = ?, counter = ? WHERE id = ?', [
    e.person, e.kind, e.amount, e.date, e.note, e.projectId, e.counter, e.id,
  ]);
}

export async function deleteOwedEntry(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM owed_entries WHERE id = ?', [id]);
}

type ProjectRow = Omit<OwedProject, 'members'> & { members: string };
const toProject = (r: ProjectRow): OwedProject => ({ ...r, members: r.members === '' ? [] : r.members.split('\n') });
const PROJECTS = `SELECT id, uid, name, start_date AS startDate, end_date AS endDate, members, owner FROM owed_projects`;

export async function listOwedProjects(db: Db): Promise<OwedProject[]> {
  return (await db.all<ProjectRow>(`${PROJECTS} ORDER BY id`)).map(toProject);
}

export async function addOwedProject(db: Db, input: NewOwedProject): Promise<OwedProject> {
  const r = await db.run('INSERT INTO owed_projects (name, start_date, end_date, members, owner) VALUES (?, ?, ?, ?, ?)', [
    input.name, input.startDate, input.endDate, input.members.join('\n'), input.owner,
  ]);
  // The row's own id is made by a trigger right after the insert.
  const row = await db.get<ProjectRow>(`${PROJECTS} WHERE id = ?`, [r.lastInsertRowId]);
  return toProject(row!);
}

export async function updateOwedProject(db: Db, p: OwedProject): Promise<void> {
  await db.run('UPDATE owed_projects SET name = ?, start_date = ?, end_date = ?, members = ?, owner = ? WHERE id = ?', [
    p.name, p.startDate, p.endDate, p.members.join('\n'), p.owner, p.id,
  ]);
}

/** Deletes a project and everything in it. The default project cannot be deleted. */
export async function deleteOwedProject(db: Db, id: number): Promise<void> {
  const row = await db.get<{ uid: string }>('SELECT uid FROM owed_projects WHERE id = ?', [id]);
  if (!row || row.uid === DEFAULT_PROJECT_UID) return;
  await db.transaction(async () => {
    await db.run('DELETE FROM owed_entries WHERE project_id = ?', [id]);
    await db.run('DELETE FROM owed_projects WHERE id = ?', [id]);
  });
}
