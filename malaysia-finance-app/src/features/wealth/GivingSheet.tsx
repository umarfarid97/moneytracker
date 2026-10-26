import { useState } from 'react';
import { Switch, View } from 'react-native';
import { isValidDate } from '@/domain/dates';
import { GIVING_KINDS, isZakat, type GivingKind, type GivingRecord, type NewGivingRecord } from '@/domain/giving';
import { parseRM, senToInput } from '@/domain/money';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { Sheet } from '@/ui/Sheet';
import { TextField } from './TextField';

type Props = {
  visible: boolean;
  existing: GivingRecord | null;
  /** Suggested kind and amount, e.g. from the zakat calculator. */
  preset?: { kind: GivingKind; amount: string };
  onClose: () => void;
  onSave: (input: NewGivingRecord) => Promise<void>;
  onDelete?: () => Promise<boolean | void>;
};

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function GivingSheet({ visible, existing, preset, onClose, onSave, onDelete }: Props) {
  const today = useToday();
  const [kind, setKind] = useState<GivingKind>(existing?.kind ?? preset?.kind ?? 'zakat');
  const [date, setDate] = useState(existing?.date ?? today);
  const [amountText, setAmountText] = useState(existing ? senToInput(existing.amount) : (preset?.amount ?? ''));
  const [recipient, setRecipient] = useState(existing?.recipient ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [counts, setCounts] = useState(existing?.countsForTax ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseRM(amountText);
  const valid = isValidDate(date) && amount !== null && amount > 0;

  async function run(action: () => Promise<boolean | void>) {
    setBusy(true);
    setError(null);
    try {
      if ((await action()) !== false) onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title={t(existing ? 'giving.edit' : 'giving.add')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GIVING_KINDS.map((k) => (
            <Chip key={k} label={t(`giving.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <AmountInput label={t('common.amount')} value={amountText} onChange={setAmountText} compact />
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('common.date')}</AppText>
          <View style={{ flexDirection: 'row' }}>
            <DateField value={date} onChange={setDate} label={t('common.date')} />
          </View>
        </View>
        <TextField label={t('giving.recipient')} value={recipient} onChange={setRecipient} maxLength={60} placeholder={t('giving.recipientHint')} />
        <TextField label={t('common.note')} value={note} onChange={setNote} maxLength={80} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{t('giving.counts')}</AppText>
            <AppText variant="small" tone="muted">{t(isZakat(kind) ? 'giving.countsZakat' : 'giving.countsDonation')}</AppText>
          </View>
          <Switch accessibilityLabel={t('giving.counts')} value={counts} onValueChange={setCounts} />
        </View>
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button
          title={t('common.save')}
          disabled={!valid || busy}
          onPress={() =>
            run(() => onSave({ kind, date, amount: amount ?? 0, recipient: recipient.trim(), note: note.trim(), countsForTax: counts }))
          }
        />
        {existing && onDelete ? (
          <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
        ) : null}
      </View>
    </Sheet>
  );
}
