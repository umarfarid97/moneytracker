import type { NewSavingsAccount, SavingsAccount } from '@/domain/savings';
import type { Db } from '../types';

const SELECT = 'SELECT id, name, kind, balance, invested, target, monthly, note FROM savings_accounts';

export function listSavingsAccounts(db: Db): Promise<SavingsAccount[]> {
  return db.all<SavingsAccount>(`${SELECT} ORDER BY id`);
}

export async function addSavingsAccount(db: Db, input: NewSavingsAccount): Promise<SavingsAccount> {
  const r = await db.run(
    'INSERT INTO savings_accounts (name, kind, balance, invested, target, monthly, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [input.name, input.kind, input.balance, input.invested, input.target, input.monthly, input.note],
  );
  return { id: r.lastInsertRowId, ...input };
}

export async function updateSavingsAccount(db: Db, a: SavingsAccount): Promise<void> {
  await db.run(
    'UPDATE savings_accounts SET name = ?, kind = ?, balance = ?, invested = ?, target = ?, monthly = ?, note = ? WHERE id = ?',
    [a.name, a.kind, a.balance, a.invested, a.target, a.monthly, a.note, a.id],
  );
}

export async function deleteSavingsAccount(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM savings_accounts WHERE id = ?', [id]);
}
