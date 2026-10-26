import { formatRM } from '@/domain/money';
import type { Transfer } from '@/domain/owed';
import { t } from '@/i18n/t';

/** A name for display: '' is you. */
export const whoName = (name: string): string => (name === '' ? t('owed.you') : name);

/** What an entry means, in a sentence that says who owes whom: "Danish owes you RM 20", "You paid Ali back RM 5". */
export function transferText(tr: Transfer): string {
  const amount = formatRM(tr.amount);
  if (tr.type === 'lend') {
    if (tr.to === '') return t('owed.s.youOwe', { name: tr.from, amount });
    if (tr.from === '') return t('owed.s.owesYou', { name: tr.to, amount });
    return t('owed.s.owes', { debtor: tr.to, creditor: tr.from, amount });
  }
  if (tr.to === '') return t('owed.s.paidYouBack', { name: tr.from, amount });
  if (tr.from === '') return t('owed.s.youPaidBack', { name: tr.to, amount });
  return t('owed.s.paidBack', { from: tr.from, to: tr.to, amount });
}

/** A payment that settles the book: "Ali pays you RM 20", "You pay Danish RM 5". */
export function payText(tr: Transfer): string {
  const amount = formatRM(tr.amount);
  if (tr.from === '') return t('owed.pay.you', { to: tr.to, amount });
  if (tr.to === '') return t('owed.pay.toYou', { from: tr.from, amount });
  return t('owed.pay.other', { from: tr.from, to: tr.to, amount });
}
