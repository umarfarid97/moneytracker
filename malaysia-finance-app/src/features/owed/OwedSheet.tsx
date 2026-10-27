import { useState } from 'react';
import { View } from 'react-native';
import { isValidDate } from '@/domain/dates';
import { parseRM, senToInput } from '@/domain/money';
import { entryOf, normalizeName, sameName, transferOf, type NewOwedEntry, type OwedEntry, type Transfer } from '@/domain/owed';
import { PartyPicker } from './PartyPicker';
import { transferText } from './sentences';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { Sheet } from '@/ui/Sheet';

type Props = {
  existing: OwedEntry | null;
  /** People in the project, offered as chips. */
  people: string[];
  projectId: number;
  today: string;
  onClose: () => void;
  onSave: (input: NewOwedEntry) => Promise<void>;
  onDelete?: () => Promise<boolean | void>;
};

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function OwedSheet({ existing, people, projectId, today, onClose, onSave, onDelete }: Props) {
  const start = existing ? transferOf(existing) : null;
  // '' is you; null until someone is chosen.
  const [from, setFrom] = useState<string | null>(start ? start.from : '');
  const [to, setTo] = useState<string | null>(start ? start.to : null);
  const [type, setType] = useState<Transfer['type']>(start?.type ?? 'lend');
  const [amount, setAmount] = useState(existing ? senToInput(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sen = parseRM(amount);
  const [a, b] = [from === null ? null : normalizeName(from), to === null ? null : normalizeName(to)];
  const valid = a !== null && b !== null && !sameName(a, b) && sen !== null && sen > 0 && isValidDate(date);
  const transfer: Transfer | null = valid ? { from: a, to: b, type, amount: sen } : null;

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
    <Sheet visible title={t(existing ? 'owed.edit' : 'owed.add')} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <Button
            title={t('common.save')}
            disabled={!valid || busy}
            onPress={() => run(async () => {
              if (transfer) await onSave({ ...entryOf(transfer), date, note: note.trim(), projectId: existing?.projectId ?? projectId });
            })}
          />
          {existing && onDelete ? (
            <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
          ) : null}
        </View>
      )}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('owed.type')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip compact label={t('owed.type.lend')} selected={type === 'lend'} onPress={() => setType('lend')} />
            <Chip compact label={t('owed.type.payback')} selected={type === 'payback'} onPress={() => setType('payback')} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PartyPicker label={t('owed.from')} value={from} people={people} onChange={setFrom} />
          <PartyPicker label={t('owed.to')} value={to} people={people} onChange={setTo} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <AmountInput label={t('common.amount')} value={amount} onChange={setAmount} compact autoFocus={!existing} />
          </View>
          <View style={{ gap: 8 }}>
            <AppText variant="eyebrow" tone="muted">{t('common.date')}</AppText>
            <DateField label={t('common.date')} value={date} onChange={setDate} />
          </View>
        </View>
        <TextField label={t('common.note')} value={note} onChange={setNote} maxLength={80} />
        {transfer ? (
          <AppText testID="owed-preview" variant="bodyStrong">{transferText(transfer)}</AppText>
        ) : (
          <AppText variant="small" tone="muted">{t(a !== null && b !== null && sameName(a, b) ? 'owed.sameParty' : 'owed.previewHint')}</AppText>
        )}
      </View>
    </Sheet>
  );
}
