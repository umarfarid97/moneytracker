import type { IncomeEntry, IncomeRule, NewIncomeEntry, NewIncomeRule } from '@/domain/income';
import { runUid, withRuleDefaults } from '@/domain/income';
import type { Db } from '../types';

type RuleRow = Omit<IncomeRule, 'active'> & { active: number };
const toRule = (r: RuleRow): IncomeRule => ({ ...r, active: r.active === 1 });

const RULES = 'SELECT id, name, amount, day_of_month AS dayOfMonth, active, start_date AS startDate, last_run AS lastRun FROM income_rules';

export async function listIncomeRules(db: Db): Promise<IncomeRule[]> {
  return (await db.all<RuleRow>(`${RULES} ORDER BY day_of_month, id`)).map(toRule);
}

export async function addIncomeRule(db: Db, input: NewIncomeRule): Promise<IncomeRule> {
  const full = withRuleDefaults(input);
  const r = await db.run(
    'INSERT INTO income_rules (name, amount, day_of_month, active, start_date, last_run) VALUES (?, ?, ?, ?, ?, ?)',
    [full.name, full.amount, full.dayOfMonth, full.active ? 1 : 0, full.startDate, full.lastRun],
  );
  return { id: r.lastInsertRowId, ...full };
}

export async function updateIncomeRule(db: Db, x: IncomeRule): Promise<void> {
  await db.run(
    'UPDATE income_rules SET name = ?, amount = ?, day_of_month = ?, active = ?, start_date = ?, last_run = ? WHERE id = ?',
    [x.name, x.amount, x.dayOfMonth, x.active ? 1 : 0, x.startDate, x.lastRun, x.id],
  );
}

export async function deleteIncomeRule(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM income_rules WHERE id = ?', [id]);
}

export function listIncomeEntries(db: Db): Promise<IncomeEntry[]> {
  return db.all<IncomeEntry>('SELECT id, name, amount, date FROM income_entries ORDER BY date DESC, id DESC');
}

export async function addIncomeEntry(db: Db, input: NewIncomeEntry): Promise<IncomeEntry> {
  const r = await db.run('INSERT INTO income_entries (name, amount, date) VALUES (?, ?, ?)', [input.name, input.amount, input.date]);
  return { id: r.lastInsertRowId, ...input };
}

/**
 * Adds the entry a rule makes for one day. It gets an id made from the rule and the day, so a second
 * phone adding the same day ends up with the same entry after a sync. Returns null if it already exists.
 */
export async function addRuleEntry(db: Db, rule: IncomeRule, date: string, now: number = Date.now()): Promise<IncomeEntry | null> {
  const row = await db.get<{ uid: string }>('SELECT uid FROM income_rules WHERE id = ?', [rule.id]);
  if (!row) return null;
  const r = await db.run(
    'INSERT OR IGNORE INTO income_entries (name, amount, date, uid, updated_at) VALUES (?, ?, ?, ?, ?)',
    [rule.name, rule.amount, date, runUid(row.uid, date), now],
  );
  return r.changes === 0 ? null : { id: r.lastInsertRowId, name: rule.name, amount: rule.amount, date };
}

export async function updateIncomeEntry(db: Db, e: IncomeEntry): Promise<void> {
  await db.run('UPDATE income_entries SET name = ?, amount = ?, date = ? WHERE id = ?', [e.name, e.amount, e.date, e.id]);
}

export async function deleteIncomeEntry(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM income_entries WHERE id = ?', [id]);
}
