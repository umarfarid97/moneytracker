import { freshDb } from '../screens/helpers';
import { createTestDb } from '../../test-support/sqljsDb';
import { migrate, MIGRATIONS } from '@/db/migrations';
import { addCommitment, listCommitments, updateCommitment } from '@/db/repos/commitments';
import { getProfile, saveProfile } from '@/db/repos/profile';
import { mergeSnapshots } from '@/sync/merge';
import { createBackup, parseBackup, restoreBackup } from '@/sync/backup';
import { applySnapshot, canonical, exportSnapshot } from '@/sync/snapshot';

const loan = {
  name: 'PTPTN', amount: 20000, dayOfMonth: 28, kind: 'loan' as const, active: true,
  loanType: 'ptptn' as const, loanBalance: 1000000, loanBalanceDate: '2026-10-24', loanOriginal: 2000000, loanRatePct: 1,
};

describe('loans and the budget start day in backup and sync', () => {
  it('upgrades an older database and keeps its loans and profile', async () => {
    const db = await createTestDb();
    await migrate(db, MIGRATIONS.slice(0, 5));
    await db.run(`INSERT INTO commitments (name, amount, day_of_month, kind) VALUES ('Car', 80000, 1, 'loan')`);
    await migrate(db);
    const [c] = await listCommitments(db);
    expect(c).toMatchObject({ name: 'Car', kind: 'loan', loanType: null, loanBalance: null, loanRatePct: null });
    expect((await getProfile(db)).budgetStartDay).toBe(1);
  });

  it('the start day only accepts 1 to 31', async () => {
    const db = await freshDb();
    await expect(db.run('UPDATE profile SET budget_start_day = 32')).rejects.toBeTruthy();
    await expect(db.run('UPDATE profile SET budget_start_day = 0')).rejects.toBeTruthy();
  });

  it('a backup file round trips loan details and the start day', async () => {
    const a = await freshDb();
    await addCommitment(a, loan);
    await saveProfile(a, { ...(await getProfile(a)), budgetStartDay: 28 });
    const text = await createBackup(a);

    const b = await freshDb();
    await restoreBackup(b, await parseBackup(b, text));
    expect(await listCommitments(b)).toEqual([expect.objectContaining(loan)]);
    expect((await getProfile(b)).budgetStartDay).toBe(28);
  });

  it('restoring a backup from before this version leaves the loan fields empty and the start day alone', async () => {
    const old = await createTestDb();
    await migrate(old, MIGRATIONS.slice(0, 5));
    await old.run(`INSERT INTO commitments (name, amount, day_of_month, kind) VALUES ('Car', 80000, 1, 'loan')`);
    const text = JSON.stringify(await exportSnapshot(old));

    const db = await freshDb();
    await restoreBackup(db, await parseBackup(db, text));
    expect(await listCommitments(db)).toEqual([expect.objectContaining({ name: 'Car', loanType: null, loanBalance: null })]);
    expect((await getProfile(db)).budgetStartDay).toBe(1);
  });

  it('the newer edit of a loan wins when two phones sync, and the start day follows the profile', async () => {
    const a = await freshDb();
    const added = await addCommitment(a, loan);
    const b = await freshDb();
    await applySnapshot(b, await exportSnapshot(a));
    expect(canonical(await exportSnapshot(b))).toBe(canonical(await exportSnapshot(a)));

    await new Promise((r) => setTimeout(r, 5));
    const [onB] = await listCommitments(b);
    await updateCommitment(b, { ...onB, loanBalance: 800000, loanBalanceDate: '2026-11-01' });
    await saveProfile(b, { ...(await getProfile(b)), budgetStartDay: 25 });

    await applySnapshot(a, mergeSnapshots(await exportSnapshot(a), await exportSnapshot(b)));
    expect(await listCommitments(a)).toEqual([
      expect.objectContaining({ id: added.id, loanBalance: 800000, loanBalanceDate: '2026-11-01', loanType: 'ptptn' }),
    ]);
    expect((await getProfile(a)).budgetStartDay).toBe(25);
  });
});
