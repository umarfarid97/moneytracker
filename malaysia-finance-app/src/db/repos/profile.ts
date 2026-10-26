import type { Profile } from '@/domain/types';
import type { Db } from '../types';

export async function getProfile(db: Db): Promise<Profile> {
  const row = await db.get<Profile>(
    `SELECT gross_monthly AS grossMonthly, net_monthly_override AS netMonthlyOverride,
            epf_rate AS epfRate, socso_monthly AS socsoMonthly, eis_monthly AS eisMonthly,
            budget_start_day AS budgetStartDay, reminder_days AS reminderDays
     FROM profile WHERE id = 1`,
  );
  if (!row) throw new Error('profile row missing: run migrations first');
  return row;
}

export async function saveProfile(db: Db, p: Profile): Promise<void> {
  await db.run(
    `UPDATE profile SET gross_monthly = ?, net_monthly_override = ?, epf_rate = ?,
            socso_monthly = ?, eis_monthly = ?, budget_start_day = ?, reminder_days = ? WHERE id = 1`,
    [p.grossMonthly, p.netMonthlyOverride, p.epfRate, p.socsoMonthly, p.eisMonthly, p.budgetStartDay, p.reminderDays],
  );
}
