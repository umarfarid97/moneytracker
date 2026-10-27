import { buildDemoPlan, DEMO_CATEGORY_NAMES, DEMO_PROFILE, type CategoryKey } from '@/domain/demoData';
import { runUid } from '@/domain/income';
import type { Db, SqlParam } from '../types';
import { deleteSetting, getSetting, setSetting } from './appSettings';
import { FALLBACK_CATEGORY } from './categories';

/**
 * Demo data (More > Demo data). Every row it adds is listed in `demo_records` (table + the row's uid, or
 * "category uid|month" for a budget), and that list is the only thing "Clear demo data" deletes by. It also
 * deletes what was added inside a demo bill, project or recurring income, which has no meaning without it.
 * The list and the saved profile values stay on this phone: backups and Drive sync never contain demo data.
 */
const PROFILE_KEY = 'demo.profile';

type DemoTable =
  | 'commitments' | 'expenses' | 'budgets' | 'relief_claims' | 'retirement_entries' | 'giving_records'
  | 'savings_accounts' | 'owed_projects' | 'owed_entries' | 'income_rules' | 'income_entries';

/** Deleted in this order, so a row goes before the row it points at. */
const CLEAR_ORDER: DemoTable[] = [
  'expenses', 'owed_entries', 'income_entries', 'budgets', 'commitments', 'owed_projects', 'income_rules',
  'relief_claims', 'retirement_entries', 'giving_records', 'savings_accounts',
];

export async function isDemoLoaded(db: Db): Promise<boolean> {
  return (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM demo_records'))!.n > 0;
}

/** What loading changed on the profile: the old and the demo value of each field it filled in. */
type SavedProfile = { prev: Record<string, SqlParam>; demo: Record<string, SqlParam> };

async function savedProfile(db: Db): Promise<SavedProfile | null> {
  const raw = await getSetting(db, PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedProfile;
  } catch {
    return null;
  }
}

/**
 * Every demo row's uid per table, including rows added inside demo containers: payments of a demo bill,
 * entries of a demo project, and income added by the demo's recurring rule.
 */
export async function demoUids(db: Db): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const r of await db.all<{ tbl: string; ref: string }>('SELECT tbl, ref FROM demo_records')) {
    if (!out.has(r.tbl)) out.set(r.tbl, new Set());
    out.get(r.tbl)!.add(r.ref);
  }
  const add = (tbl: string, uids: string[]) => {
    if (!out.has(tbl)) out.set(tbl, new Set());
    for (const u of uids) out.get(tbl)!.add(u);
  };
  if (out.has('commitments')) {
    const rows = await db.all<{ uid: string; cuid: string }>(
      'SELECT e.uid AS uid, c.uid AS cuid FROM expenses e JOIN commitments c ON c.id = e.commitment_id',
    );
    add('expenses', rows.filter((r) => out.get('commitments')!.has(r.cuid)).map((r) => r.uid));
  }
  if (out.has('owed_projects')) {
    const rows = await db.all<{ uid: string; puid: string }>(
      'SELECT e.uid AS uid, p.uid AS puid FROM owed_entries e JOIN owed_projects p ON p.id = e.project_id',
    );
    add('owed_entries', rows.filter((r) => out.get('owed_projects')!.has(r.puid)).map((r) => r.uid));
  }
  if (out.has('income_rules')) {
    const prefixes = [...out.get('income_rules')!].map((u) => `inc-${u}-`);
    const rows = await db.all<{ uid: string }>('SELECT uid FROM income_entries');
    add('income_entries', rows.filter((r) => prefixes.some((p) => r.uid.startsWith(p))).map((r) => r.uid));
  }
  return out;
}

/** Profile values as they were before the demo filled them in, for backups taken while demo data is loaded. */
export async function realProfile<T extends Record<string, SqlParam>>(db: Db, profile: T): Promise<T> {
  const saved = await savedProfile(db);
  if (!saved) return profile;
  const out: Record<string, SqlParam> = { ...profile };
  for (const [col, demo] of Object.entries(saved.demo)) if (out[col] === demo) out[col] = saved.prev[col];
  return out as T;
}

async function categoryId(db: Db, key: CategoryKey): Promise<number> {
  const row =
    (await db.get<{ id: number }>('SELECT id FROM categories WHERE name = ?', [DEMO_CATEGORY_NAMES[key]])) ??
    (await db.get<{ id: number }>('SELECT id FROM categories WHERE name = ?', [FALLBACK_CATEGORY])) ??
    (await db.get<{ id: number }>('SELECT id FROM categories ORDER BY sort_order, id LIMIT 1'));
  return row!.id;
}

/** Adds the demo data. Returns false (and adds nothing) if it is already there. */
export async function loadDemoData(db: Db, today: string, now: number = Date.now()): Promise<boolean> {
  if (await isDemoLoaded(db)) return false;
  const plan = buildDemoPlan(today);
  await db.transaction(async () => {
    // Keeps the change-tracking triggers quiet: demo rows never count as edits to sync.
    await db.run(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('applying', '1')`);

    const put = async (tbl: DemoTable, uid: string, row: Record<string, SqlParam>): Promise<number> => {
      const all = { ...row, uid, updated_at: now };
      const cols = Object.keys(all);
      const r = await db.run(`INSERT INTO ${tbl} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, Object.values(all));
      await db.run('INSERT OR IGNORE INTO demo_records (tbl, ref) VALUES (?, ?)', [tbl, uid]);
      return r.lastInsertRowId;
    };

    const catIds = new Map<CategoryKey, number>();
    for (const key of Object.keys(DEMO_CATEGORY_NAMES) as CategoryKey[]) catIds.set(key, await categoryId(db, key));
    const payId = async (kind: string | null): Promise<number | null> =>
      kind === null ? null : (await db.get<{ id: number }>('SELECT id FROM payment_methods WHERE kind = ? ORDER BY sort_order, id LIMIT 1', [kind]))?.id ?? null;

    const billIds = new Map<string, number>();
    for (const b of plan.bills) {
      billIds.set(b.key, await put('commitments', `demo-bill-${b.key}`, {
        name: b.name, amount: b.amount, day_of_month: b.dayOfMonth, kind: b.kind, active: 1,
        category_id: catIds.get(b.category)!, payment_method_id: await payId(b.pay), relief_id: b.reliefId,
        auto_record: 0, start_date: b.startDate, last_auto_due: null, variable: b.variable ? 1 : 0,
        loan_type: b.loan?.type ?? null, loan_balance: b.loan?.balance ?? null, loan_balance_date: b.loan?.balanceDate ?? null,
        loan_original: b.loan?.original ?? null, loan_rate_pct: b.loan?.ratePct ?? null,
      }));
    }

    for (const e of plan.expenses) {
      await put('expenses', `demo-exp-${e.key}`, {
        amount: e.amount, category_id: catIds.get(e.category)!, date: e.date, note: e.note, receipt_uri: null,
        payment_method_id: await payId(e.pay), relief_id: e.reliefId ?? null, relief_amount: e.reliefAmount ?? null, sst: null,
        commitment_id: e.bill ? billIds.get(e.bill.key)! : null, due_date: e.bill?.dueDate ?? null,
        currency: e.currency ?? 'MYR', foreign_amount: e.foreignAmount ?? null, fx_rate: e.fxRate ?? null,
      });
    }

    // A budget the person already set for that category and period stays as it is.
    for (const b of plan.budgets) {
      const id = catIds.get(b.category)!;
      const r = await db.run('INSERT OR IGNORE INTO budgets (category_id, month, limit_sen, updated_at) VALUES (?, ?, ?, ?)', [id, b.month, b.limit, now]);
      if (r.changes > 0) {
        const uid = (await db.get<{ uid: string }>('SELECT uid FROM categories WHERE id = ?', [id]))!.uid;
        await db.run('INSERT OR IGNORE INTO demo_records (tbl, ref) VALUES (?, ?)', ['budgets', `${uid}|${b.month}`]);
      }
    }

    for (const c of plan.reliefClaims) {
      await put('relief_claims', `demo-relief-${c.key}`, { relief_id: c.reliefId, year: c.year, amount: c.amount, receipt_uri: null, note: c.note });
    }
    for (const r of plan.retirement) {
      await put('retirement_entries', `demo-ret-${r.key}`, {
        scheme: r.scheme, kind: r.kind, date: r.date, amount: r.amount, employer_share: r.employerShare, note: r.note,
      });
    }
    for (const g of plan.giving) {
      await put('giving_records', `demo-give-${g.key}`, {
        kind: g.kind, date: g.date, amount: g.amount, recipient: g.recipient, note: g.note, counts_for_tax: g.countsForTax ? 1 : 0,
      });
    }
    for (const s of plan.savings) {
      await put('savings_accounts', `demo-sav-${s.key}`, {
        name: s.name, kind: s.kind, balance: s.balance, invested: s.invested, target: s.target, monthly: s.monthly, note: s.note,
      });
    }
    for (const p of plan.projects) {
      const projectId = await put('owed_projects', `demo-proj-${p.key}`, {
        name: p.name, start_date: p.startDate, end_date: p.endDate, members: p.members.join('\n'), owner: '',
      });
      for (const e of p.entries) {
        await put('owed_entries', `demo-owed-${p.key}-${e.key}`, {
          person: e.person, kind: e.kind, amount: e.amount, date: e.date, note: e.note, project_id: projectId, counter: '', bill: e.bill,
        });
      }
    }

    const ruleUid = `demo-income-${plan.incomeRule.key}`;
    await put('income_rules', ruleUid, {
      name: plan.incomeRule.name, amount: plan.incomeRule.amount, day_of_month: plan.incomeRule.dayOfMonth, active: 1,
      start_date: plan.incomeRule.startDate, last_run: plan.incomeRule.lastRun,
    });
    for (const e of plan.incomeEntries) {
      const uid = e.key.startsWith('run-') ? runUid(ruleUid, e.date) : `demo-income-entry-${e.key}`;
      await put('income_entries', uid, { name: e.name, amount: e.amount, date: e.date });
    }

    // The profile is the person's own: only an empty one is filled in, and the old values are kept to put back.
    const profile = (await db.get<Record<string, SqlParam>>('SELECT * FROM profile WHERE id = 1'))!;
    if (profile.gross_monthly === 0 && profile.net_monthly_override === null) {
      const saved: SavedProfile = { prev: {}, demo: {} };
      for (const [col, value] of Object.entries(DEMO_PROFILE)) {
        saved.prev[col] = profile[col];
        saved.demo[col] = value;
      }
      const cols = Object.keys(saved.demo);
      await db.run(`UPDATE profile SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`, cols.map((c) => saved.demo[c]));
      await setSetting(db, PROFILE_KEY, JSON.stringify(saved));
    }
    await db.run(`DELETE FROM sync_state WHERE key = 'applying'`);
  });
  return true;
}

/** Removes only what the demo added, and puts back the profile values it filled in (unless they were edited since). */
export async function clearDemoData(db: Db): Promise<void> {
  await db.transaction(async () => {
    const uids = await demoUids(db);
    // Nothing deleted here is a real deletion, so no deletion notes are left for sync to spread.
    await db.run(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('applying', '1')`);
    for (const tbl of CLEAR_ORDER) {
      for (const uid of uids.get(tbl) ?? []) {
        if (tbl === 'budgets') {
          const cut = uid.lastIndexOf('|');
          const [categoryUid, month] = [uid.slice(0, cut), uid.slice(cut + 1)];
          await db.run('DELETE FROM budgets WHERE month = ? AND category_id = (SELECT id FROM categories WHERE uid = ?)', [month, categoryUid]);
        } else {
          await db.run(`DELETE FROM ${tbl} WHERE uid = ?`, [uid]);
        }
      }
    }
    const saved = await savedProfile(db);
    if (saved) {
      const profile = (await db.get<Record<string, SqlParam>>('SELECT * FROM profile WHERE id = 1'))!;
      const cols = Object.keys(saved.demo).filter((c) => profile[c] === saved.demo[c]);
      if (cols.length > 0) await db.run(`UPDATE profile SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`, cols.map((c) => saved.prev[c]));
    }
    await db.run('DELETE FROM demo_records');
    await deleteSetting(db, PROFILE_KEY);
    await db.run(`DELETE FROM sync_state WHERE key = 'applying'`);
  });
}

/** Stops tracking demo data without deleting anything, for when a restore has already replaced everything. */
export async function forgetDemoData(db: Db): Promise<void> {
  await db.run('DELETE FROM demo_records');
  await deleteSetting(db, PROFILE_KEY);
}
