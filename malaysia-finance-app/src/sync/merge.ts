import { DEFAULT_PROJECT_UID } from '@/db/migrations';
import { FALLBACK_CATEGORY } from '@/db/repos/categories';
import { FALLBACK_PAYMENT_METHOD } from '@/db/repos/paymentMethods';
import {
  budgetKey, ENTITY_TABLES, num, REFS, type EntityTable, type Row, type Snapshot, type Tombstone,
} from './snapshot';

const key = (tbl: string, uid: string) => `${tbl}\u0000${uid}`;

/**
 * Combines this phone's data with the copy from Drive, row by row:
 * - the most recently edited version of each row wins (a tie goes to `remote`);
 * - a deletion wins over edits made before it, and loses to edits made after it;
 * - two categories (or payment methods) with the same name become one, and two spendings recorded for
 *   the same bill due date become one, because the database allows only one of each;
 * - anything pointing at a deleted category moves to Lain-lain, and a deleted payment method to Cash,
 *   as deleting them on the phone does.
 * Every phone that merges the same two copies gets the same result, so phones settle on one version.
 */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const tombs = new Map<string, Tombstone>();
  for (const d of [...local.deleted, ...remote.deleted]) {
    const k = key(d.tbl, d.uid);
    const cur = tombs.get(k);
    if (!cur || d.deletedAt > cur.deletedAt || (d.deletedAt === cur.deletedAt && d.mergedInto && !cur.mergedInto)) {
      tombs.set(k, { ...d, mergedInto: d.mergedInto ?? null });
    }
  }
  const newest = (rows: Row[], remoteRows: Row[], keyOf: (r: Row) => string) => {
    const out = new Map<string, Row>();
    for (const r of rows) out.set(keyOf(r), r);
    for (const r of remoteRows) {
      const cur = out.get(keyOf(r));
      if (!cur || num(r.updated_at) >= num(cur.updated_at)) out.set(keyOf(r), r);
    }
    return out;
  };
  /** Drops rows deleted after their last edit, and deletions undone by a later edit. */
  const applyTombs = (tbl: string, rows: Map<string, Row>) => {
    for (const [uid, r] of rows) {
      const tomb = tombs.get(key(tbl, uid));
      if (!tomb) continue;
      if (tomb.deletedAt >= num(r.updated_at)) rows.delete(uid);
      else tombs.delete(key(tbl, uid));
    }
  };
  const fold = (tbl: string, rows: Map<string, Row>, groupOf: (r: Row) => string | null, pick: (a: Row, b: Row) => Row, mergeInto: boolean) => {
    const winners = new Map<string, Row>();
    for (const r of rows.values()) {
      const g = groupOf(r);
      if (g === null) continue;
      const cur = winners.get(g);
      winners.set(g, cur ? pick(cur, r) : r);
    }
    for (const r of [...rows.values()]) {
      const g = groupOf(r);
      const winner = g === null ? r : winners.get(g)!;
      if (winner === r) continue;
      rows.delete(r.uid as string);
      tombs.set(key(tbl, r.uid as string), {
        tbl, uid: r.uid as string, deletedAt: num(r.updated_at), mergedInto: mergeInto ? (winner.uid as string) : null,
      });
    }
  };
  const lowerUid = (a: Row, b: Row) => (String(a.uid) <= String(b.uid) ? a : b);
  const newerThenLowerUid = (a: Row, b: Row) =>
    num(a.updated_at) !== num(b.updated_at) ? (num(a.updated_at) > num(b.updated_at) ? a : b) : lowerUid(a, b);

  const rows = {} as Record<EntityTable, Map<string, Row>>;
  for (const t of ENTITY_TABLES) {
    rows[t] = newest(local.tables[t], remote.tables[t], (r) => r.uid as string);
    applyTombs(t, rows[t]);
  }
  fold('categories', rows.categories, (r) => String(r.name), lowerUid, true);
  fold('payment_methods', rows.payment_methods, (r) => String(r.name), lowerUid, true);

  /** Where a reference ends up: the row itself, the row it was folded into, or null if it is gone. */
  const resolve = (parent: 'categories' | 'payment_methods' | 'commitments' | 'owed_projects', uid: string): string | null => {
    let cur: string | null = uid;
    for (let hops = 0; cur !== null && hops < 10; hops++) {
      if (rows[parent].has(cur)) return cur;
      cur = tombs.get(key(parent, cur))?.mergedInto ?? null;
    }
    return null;
  };
  const byName = (t: 'categories' | 'payment_methods', name: string) =>
    [...rows[t].values()].find((r) => r.name === name)?.uid as string | undefined;
  const fallback = {
    categories:
      byName('categories', FALLBACK_CATEGORY) ??
      ([...rows.categories.values()].sort((a, b) => num(a.sort_order) - num(b.sort_order))[0]?.uid as string | undefined) ??
      null,
    payment_methods: byName('payment_methods', FALLBACK_PAYMENT_METHOD) ?? null,
    commitments: null,
    owed_projects: rows.owed_projects.has(DEFAULT_PROJECT_UID) ? DEFAULT_PROJECT_UID : null,
  };
  for (const t of ['commitments', 'expenses', 'owed_entries'] as const) {
    for (const [uid, r] of rows[t]) {
      let changed: Row | null = null;
      for (const [col, parent] of Object.entries(REFS[t])) {
        if (r[col] == null) continue;
        const target = resolve(parent!, r[col] as string) ?? fallback[parent!];
        if (target !== r[col]) (changed ??= { ...r })[col] = target;
      }
      if (changed) rows[t].set(uid, changed);
    }
  }
  fold('expenses', rows.expenses, (r) => (r.commitment_id == null ? null : `${r.commitment_id}|${r.due_date}`), newerThenLowerUid, false);

  const budgets = newest(local.tables.budgets, remote.tables.budgets, budgetKey);
  applyTombs('budgets', budgets);
  const finalBudgets = new Map<string, Row>();
  for (const b of budgets.values()) {
    const category = resolve('categories', b.category_id as string);
    if (!category) continue;
    const moved = category === b.category_id ? b : { ...b, category_id: category };
    const cur = finalBudgets.get(budgetKey(moved));
    if (!cur || num(moved.updated_at) > num(cur.updated_at)) finalBudgets.set(budgetKey(moved), moved);
  }

  const profile =
    !local.profile || (remote.profile && num(remote.profile.updated_at) >= num(local.profile.updated_at))
      ? remote.profile
      : local.profile;

  const tables = { budgets: [...finalBudgets.values()] } as Snapshot['tables'];
  for (const t of ENTITY_TABLES) tables[t] = [...rows[t].values()];
  return {
    app: 'duit',
    format: 1,
    schema: Math.max(local.schema, remote.schema),
    exportedAt: Math.max(local.exportedAt, remote.exportedAt),
    tables,
    profile,
    deleted: [...tombs.values()],
  };
}
