import { useState } from 'react';
import { View } from 'react-native';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import type { Commitment } from '@/domain/types';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

type Props = {
  visible: boolean;
  bill: Commitment | null;
  onClose: () => void;
  /** Called with the amount actually paid. */
  onConfirm: (amount: number) => Promise<void>;
};

/** Confirms a payment; the amount starts as the bill's usual amount and can be changed. Mount with a fresh `key` per bill. */
export function MarkPaidSheet({ visible, bill, onClose, onConfirm }: Props) {
  const [amountText, setAmountText] = useState(bill ? senToInput(bill.amount) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = parseRM(amountText);
  const valid = amount !== null && amount > 0;

  async function confirm() {
    if (!valid || amount === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(amount);
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
            {t('commitments.markPaidFor', { name: bill.name, amount: formatRM(bill.amount) })}
          </AppText>
        ) : null}
        <AmountInput label={t('common.amount')} value={amountText} onChange={(text) => setAmountText(text)} autoFocus />
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
