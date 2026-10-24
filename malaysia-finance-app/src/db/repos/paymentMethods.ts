import type { PaymentKind, PaymentMethod } from '@/domain/types';
import type { Db } from '../types';

/** Cash is the fallback: it cannot be deleted, and spending of a deleted method moves to it. */
export const FALLBACK_PAYMENT_METHOD = 'Cash';

export function listPaymentMethods(db: Db): Promise<PaymentMethod[]> {
  return db.all<PaymentMethod>(
    'SELECT id, name, kind, sort_order AS sortOrder FROM payment_methods ORDER BY sort_order, id',
  );
}

export async function addPaymentMethod(db: Db, input: { name: string; kind: PaymentKind }): Promise<PaymentMethod> {
  const next = await db.get<{ n: number }>('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM payment_methods');
  const sortOrder = next?.n ?? 1;
  const r = await db.run('INSERT INTO payment_methods (name, kind, sort_order) VALUES (?, ?, ?)', [
    input.name, input.kind, sortOrder,
  ]);
  return { id: r.lastInsertRowId, sortOrder, ...input };
}

export async function renamePaymentMethod(db: Db, id: number, name: string): Promise<void> {
  await db.run('UPDATE payment_methods SET name = ? WHERE id = ?', [name, id]);
}

/** Spending and bills that used the method move to Cash, so nothing is lost. */
export async function deletePaymentMethod(db: Db, id: number): Promise<void> {
  const target = await db.get<{ name: string }>('SELECT name FROM payment_methods WHERE id = ?', [id]);
  if (!target) return;
  if (target.name === FALLBACK_PAYMENT_METHOD) throw new Error(`"${FALLBACK_PAYMENT_METHOD}" cannot be deleted`);
  const cash = await db.get<{ id: number }>('SELECT id FROM payment_methods WHERE name = ?', [FALLBACK_PAYMENT_METHOD]);
  if (!cash) throw new Error(`"${FALLBACK_PAYMENT_METHOD}" payment method is missing`);
  await db.transaction(async () => {
    await db.run('UPDATE expenses SET payment_method_id = ? WHERE payment_method_id = ?', [cash.id, id]);
    await db.run('UPDATE commitments SET payment_method_id = ? WHERE payment_method_id = ?', [cash.id, id]);
    await db.run('DELETE FROM payment_methods WHERE id = ?', [id]);
  });
}
