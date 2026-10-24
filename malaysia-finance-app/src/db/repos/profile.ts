import type { Profile } from '@/domain/types';
import type { Db } from '../types';

export async function getProfile(db: Db): Promise<Profile> {
  const row = await db.get<Profile>(
    `SELECT gross_monthly AS grossMonthly, net_monthly_override AS netMonthlyOverride,
            epf_rate AS epfRate, socso_monthly AS socsoMonthly, eis_monthly AS eisMonthly
     FROM profile WHERE id = 1`,
  );
  if (!row) throw new Error('profile row missing: run migrations first');
  return row;
}

export async function saveProfile(db: Db, p: Profile): Promise<void> {
  await db.run(
    `UPDATE profile SET gross_monthly = ?, net_monthly_override = ?, epf_rate = ?,
            socso_monthly = ?, eis_monthly = ? WHERE id = 1`,
    [p.grossMonthly, p.netMonthlyOverride, p.epfRate, p.socsoMonthly, p.eisMonthly],
  );
}
