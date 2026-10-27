import { useState } from 'react';
import { View } from 'react-native';
import { clampPaymentDate } from '@/domain/bills';
import { periodKey, periodLabel } from '@/domain/budgetPeriod';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import type { Commitment } from '@/domain/types';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { DateField } from '@/ui/DateField';
import { Sheet } from '@/ui/Sheet';

type Props = {
  visible: boolean;
  bill: Commitment | null;
  /** What was paid for this bill last time, if ever. */
  lastPaid?: number | null;
  /** Amount to start with when it is not the bill's usual one (the last payment of a loan is smaller). */
  suggested?: number | null;
  today: string;
  startDay: number;
  onClose: () => void;
  /** Called with the amount actually paid and the day it was paid (never after today). */
  onConfirm: (amount: number, date: string) => Promise<void>;
};

/** Confirms a payment; the amount starts as the bill's usual amount and can be changed. Mount with a fresh `key` per bill. */
export function MarkPaidSheet({ visible, bill, lastPaid = null, suggested = null, today, startDay, onClose, onConfirm }: Props) {
  const [date, setDate] = useState(today);
  // A bill that changes monthly starts empty: the amount has to come from this month's bill.
  const [amountText, setAmountText] = useState(bill && !bill.variable ? senToInput(suggested ?? bill.amount) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = parseRM(amountText);
  const valid = amount !== null && amount > 0;

  async function confirm() {
    if (!valid || amount === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(amount, clampPaymentDate(date, today));
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title={t('commitments.markPaid')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        {bill ? (
          <AppText variant="body" tone="muted">
            {bill.variable
              ? [
                  t('commitments.markPaidVariable', { name: bill.name }),
                  lastPaid !== null ? t('commitments.lastPaid', { amount: formatRM(lastPaid) }) : null,
                ].filter(Boolean).join(' ')
              : t('commitments.markPaidFor', { name: bill.name, amount: formatRM(suggested ?? bill.amount) })}
          </AppText>
        ) : null}
        <AmountInput label={t('common.amount')} value={amountText} onChange={(text) => setAmountText(text)} autoFocus />
        {(
          <View style={{ gap: 6 }}>
            <AppText variant="smallStrong">{t('commitments.payDate')}</AppText>
            <View style={{ flexDirection: 'row' }}>
              <DateField label={t('commitments.payDate')} value={date} onChange={(d) => setDate(clampPaymentDate(d, today))} />
            </View>
            {periodKey(date, startDay) !== periodKey(today, startDay) ? (
              <AppText variant="small" tone="muted">
                {t('commitments.payDateHint', { period: periodLabel(periodKey(date, startDay), startDay) })}
              </AppText>
            ) : null}
          </View>
        )}
        {error ? (
          <AppText variant="small" tone="negative">
            {error}
          </AppText>
        ) : null}
        <Button title={t('commitments.confirmPaid')} disabled={!valid || busy} onPress={confirm} />
      </View>
    </Sheet>
  );
}
