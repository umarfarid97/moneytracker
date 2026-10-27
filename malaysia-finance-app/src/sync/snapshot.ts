import { DEFAULT_PROJECT_UID } from '@/db/migrations';
import type { Db, SqlParam } from '@/db/types';
import { FALLBACK_CATEGORY } from '@/db/repos/categories';
import { demoUids, realProfile } from '@/db/repos/demo';

/**
 * A copy of all the user's data that does not depend on this phone's row ids, so it can be merged with
 * another phone's copy (Google Drive sync) or saved to a file (backup).
 *
 * Rows keep their SQL column names, minus `id`. Every row of an entity table has a `uid` and an
 * `updated_at` (ms). Columns that point at another row (`category_id`, ...) hold that row's uid instead
 * of its id. Budgets are keyed by category uid and month, and the profile is a single row.
 */
export type Row = Record<string, SqlParam>;

export const ENTITY_TABLES = [
  'categories', 'payment_methods', 'commitments', 'expenses', 'relief_claims',
  'retirement_entries', 'giving_records', 'savings_accounts', 'owed_projects', 'owed_entries', 'income_rules', 'income_entries',
] as const;
export type EntityTable = (typeof ENTITY_TABLES)[number];
type Parent = 'categories' | 'payment_methods' | 'commitments' | 'owed_projects';

/** Columns that point at another table's row. Parents come before their children in ENTITY_TABLES. */
export const REFS: Record<EntityTable, Partial<Record<string, Parent>>> = {
  categories: {},
  payment_methods: {},
  commitments: { category_id: 'categories', payment_method_id: 'payment_methods' },
  expenses: { category_id: 'categories', payment_method_id: 'payment_methods', commitment_id: 'commitments' },
  relief_claims: {},
  retirement_entries: {},
  giving_records: {},
  savings_accounts: {},
  owed_projects: {},
  owed_entries: { project_id: 'owed_projects' },
  income_rules: {},
  income_entries: {},
};

/** A deleted row. `mergedInto` is set when a duplicate was folded into another row (see merge.ts). */
export type Tombstone = { tbl: string; uid: string; deletedAt: number; mergedInto: string | null };

export type Snapshot = {
  app: 'duit';
  format: 1;
  /** Database version (PRAGMA user_version) of the app that wrote it. */
  schema: number;
  exportedAt: number;
  tables: Record<EntityTable, Row[]> & { budgets: Row[] };
  profile: Row | null;
  deleted: Tombstone[];
};

export const budgetKey = (r: Row) => `${r.category_id}|${r.month}`;
export const num = (v: SqlParam | undefined) => (typeof v === 'number' ? v : Number(v ?? 0));

export async function schemaVersion(db: Db): Promise<number> {
  return (await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

/** Reads everything into a snapshot. Demo data (More > Demo data) is left out, and the profile is as it was before it. */
export async function exportSnapshot(db: Db, now: number = Date.now()): Promise<Snapshot> {
  const raw = {} as Record<EntityTable, Row[]>;
  const uidOf = {} as Record<EntityTable, Map<number, string>>;
  const demo = await demoUids(db);
  for (const t of ENTITY_TABLES) {
    const all = await db.all<Row>(`SELECT * FROM ${t} ORDER BY id`);
    uidOf[t] = new Map(all.map((r) => [r.id as number, r.uid as string]));
    raw[t] = demo.has(t) ? all.filter((r) => !demo.get(t)!.has(r.uid as string)) : all;
  }
  const toUid = (parent: Parent, id: SqlParam) => (id == null ? null : uidOf[parent].get(id as number) ?? null);

  const tables = { budgets: [] as Row[] } as Snapshot['tables'];
  for (const t of ENTITY_TABLES) {
    tables[t] = raw[t].map(({ id: _id, ...row }) => {
      for (const [col, parent] of Object.entries(REFS[t])) row[col] = toUid(parent!, row[col]);
      return row;
    });
  }
  for (const b of await db.all<Row>('SELECT * FROM budgets')) {
    const category = toUid('categories', b.category_id);
    if (category && !demo.get('budgets')?.has(`${category}|${b.month}`)) tables.budgets.push({ ...b, category_id: category });
  }
  const currentProfile = await db.get<Row>('SELECT * FROM profile WHERE id = 1');
  const profileRow = currentProfile ? await realProfile(db, currentProfile) : null;
  const { id: _id, ...profile } = profileRow ?? {};
  const deleted = await db.all<Tombstone>(
    'SELECT tbl, uid, deleted_at AS deletedAt, merged_into AS mergedInto FROM sync_deleted',
  );
  return { app: 'duit', format: 1, schema: await schemaVersion(db), exportedAt: now, tables, profile: profileRow ? profile : null, deleted };
}

/** Same data in a fixed order and without the export time, for "did anything change?" checks. */
export function canonical(s: Snapshot): string {
  const byUid = (a: Row, b: Row) => String(a.uid).localeCompare(String(b.uid));
  const tables: Record<string, Row[]> = {};
  for (const t of ENTITY_TABLES) tables[t] = [...s.tables[t]].sort(byUid);
  tables.budgets = [...s.tables.budgets].sort((a, b) => budgetKey(a).localeCompare(budgetKey(b)));
  const deleted = [...s.deleted].sort((a, b) => `${a.tbl}|${a.uid}`.localeCompare(`${b.tbl}|${b.uid}`));
  const sortKeys = (r: Row | null) => (r ? Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b))) : null);
  return JSON.stringify({
    schema: s.schema,
    tables: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.map(sortKeys)])),
    profile: sortKeys(s.profile),
    deleted,
  });
}

/** Tables every snapshot has had since the first version; later ones may be missing from older files. */
const ORIGINAL_TABLES = ['categories', 'payment_methods', 'commitments', 'expenses', 'relief_claims', 'budgets'] as const;

/** Checks that parsed JSON is a snapshot (a backup file or the Drive copy). Run `withAllTables` on it before use. */
export function isSnapshot(value: unknown): value is Snapshot {
  const s = value as Snapshot | null;
  return (
    !!s && s.app === 'duit' && s.format === 1 && typeof s.schema === 'number' && !!s.tables &&
    ORIGINAL_TABLES.every((t) => Array.isArray(s.tables[t])) && Array.isArray(s.deleted)
  );
}

/** A snapshot written by an older version has no rows for tables added since; they count as empty. */
export function withAllTables(s: Snapshot): Snapshot {
  const tables = { ...s.tables };
  for (const t of ENTITY_TABLES) if (!Array.isArray(tables[t])) tables[t] = [];
  return { ...s, tables: withProjects(tables) };
}

/**
 * Before projects, lent and borrowed entries carried an event name instead. Turns those into projects named
 * the same way the database upgrade does, and makes sure the default project exists, so old backups and old
 * phones' Drive copies line up with the current data.
 */
function withProjects(tables: Snapshot['tables']): Snapshot['tables'] {
  const projects = [...tables.owed_projects];
  const has = (uid: string) => projects.some((p) => p.uid === uid);
  if (!has(DEFAULT_PROJECT_UID)) {
    projects.push({ uid: DEFAULT_PROJECT_UID, name: 'General', start_date: null, end_date: null, members: '', owner: '', updated_at: 0 });
  }
  const entries = tables.owed_entries.map((e) => {
    if ('project_id' in e) return e;
    const name = String(e.event ?? '').trim();
    const uid = name === '' ? DEFAULT_PROJECT_UID : `proj-${name.toLowerCase()}`;
    if (!has(uid)) projects.push({ uid, name, start_date: null, end_date: null, members: '', owner: '', updated_at: 0 });
    return { ...e, project_id: uid };
  });
  return { ...tables, owed_projects: projects, owed_entries: entries };
}

/**
 * Makes the database hold exactly the snapshot's data. Existing rows keep their ids (matched by uid), so
 * screens that hold an id stay valid. Runs in one transaction with the change-tracking triggers paused.
 */
export async function applySnapshot(db: Db, snap: Snapshot): Promise<void> {
  await db.transaction(async () => {
    // A category can be removed before the spending that used it is moved; checked again at commit.
    await db.exec('PRAGMA defer_foreign_keys = ON');
    await db.run(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('applying', '1')`);

    const idOf = {} as Record<Parent, Map<string, number>>;
    for (const t of ENTITY_TABLES) {
      const columns = (await db.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name).filter((c) => c !== 'id');
      const local = await db.all<Row>(`SELECT * FROM ${t}`);
      const byUid = new Map(local.map((r) => [r.uid as string, r]));
      const wanted = snap.tables[t];
      const keep = new Set(wanted.map((r) => r.uid as string));

      // Deletions first, so a unique name or bill due date is free before another row takes it.
      for (const r of local) if (!keep.has(r.uid as string)) await db.run(`DELETE FROM ${t} WHERE id = ?`, [r.id]);

      const fallbackCategory = t === 'commitments' || t === 'expenses' ? await fallbackCategoryId(db) : null;
      for (const row of wanted) {
        const cols = columns.filter((c) => c in row);
        const values = cols.map((c): SqlParam => {
          const parent = REFS[t][c];
          if (!parent || row[c] == null) return row[c] ?? null;
          const id = idOf[parent].get(row[c] as string) ?? null;
          return id === null && c === 'category_id' ? fallbackCategory : id;
        });
        const existing = byUid.get(row.uid as string);
        if (existing) {
          if (cols.some((c, i) => existing[c] !== values[i])) {
            await db.run(`UPDATE ${t} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...values, existing.id]);
          }
        } else {
          await db.run(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, values);
        }
      }
      if (t === 'categories' || t === 'payment_methods' || t === 'commitments' || t === 'owed_projects') {
        const ids = await db.all<{ id: number; uid: string }>(`SELECT id, uid FROM ${t}`);
        idOf[t as Parent] = new Map(ids.map((r) => [r.uid, r.id]));
      }
    }

    await db.run('DELETE FROM budgets');
    for (const b of snap.tables.budgets) {
      const categoryId = idOf.categories.get(b.category_id as string);
      if (categoryId === undefined) continue;
      await db.run('INSERT OR REPLACE INTO budgets (category_id, month, limit_sen, updated_at) VALUES (?, ?, ?, ?)', [
        categoryId, b.month, b.limit_sen, num(b.updated_at),
      ]);
    }

    if (snap.profile) {
      const columns = (await db.all<{ name: string }>('PRAGMA table_info(profile)')).map((c) => c.name);
      const cols = columns.filter((c) => c !== 'id' && c in snap.profile!);
      if (cols.length > 0) {
        await db.run(`UPDATE profile SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`, cols.map((c) => snap.profile![c] ?? null));
      }
    }

    await db.run('DELETE FROM sync_deleted');
    for (const d of snap.deleted) {
      await db.run('INSERT OR REPLACE INTO sync_deleted (tbl, uid, deleted_at, merged_into) VALUES (?, ?, ?, ?)', [
        d.tbl, d.uid, d.deletedAt, d.mergedInto ?? null,
      ]);
    }
    await db.run(`DELETE FROM sync_state WHERE key = 'applying'`);
  });
}

async function fallbackCategoryId(db: Db): Promise<number | null> {
  const row =
    (await db.get<{ id: number }>('SELECT id FROM categories WHERE name = ?', [FALLBACK_CATEGORY])) ??
    (await db.get<{ id: number }>('SELECT id FROM categories ORDER BY sort_order, id LIMIT 1'));
  return row?.id ?? null;
}

/**
 * Restoring a backup: the device ends up with exactly the backup's data. Everything restored counts as
 * just edited, and everything else on the device as just deleted, so a later Drive sync spreads the
 * restore to other phones instead of undoing it.
 */
export async function restoreSnapshot(db: Db, backup: Snapshot, now: number = Date.now()): Promise<void> {
  const current = await exportSnapshot(db, now);
  const touch = (r: Row): Row => ({ ...r, updated_at: now });
  const tables = { budgets: backup.tables.budgets.map(touch) } as Snapshot['tables'];
  const deleted: Tombstone[] = [];
  for (const t of ENTITY_TABLES) {
    tables[t] = backup.tables[t].map(touch);
    const restored = new Set(tables[t].map((r) => r.uid));
    for (const r of current.tables[t]) {
      if (!restored.has(r.uid)) deleted.push({ tbl: t, uid: r.uid as string, deletedAt: now, mergedInto: null });
    }
    for (const d of current.deleted) if (d.tbl === t && !restored.has(d.uid)) deleted.push(d);
  }
  const restoredBudgets = new Set(tables.budgets.map(budgetKey));
  for (const b of current.tables.budgets) {
    if (!restoredBudgets.has(budgetKey(b))) deleted.push({ tbl: 'budgets', uid: budgetKey(b), deletedAt: now, mergedInto: null });
  }
  await applySnapshot(db, {
    ...backup,
    tables,
    profile: backup.profile ? { ...backup.profile, updated_at: now } : current.profile,
    deleted,
  });
}
