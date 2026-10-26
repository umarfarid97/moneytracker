import { useState } from 'react';
import { View } from 'react-native';
import { isValidDate } from '@/domain/dates';
import { parseRM, senToInput } from '@/domain/money';
import { normalizeName, OWED_KINDS, type NewOwedEntry, type OwedEntry, type OwedKind } from '@/domain/owed';
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
  /** Name to start with (from a person's page). */
  person?: string;
  kind?: OwedKind;
  projectId: number;
  today: string;
  onClose: () => void;
  onSave: (input: NewOwedEntry) => Promise<void>;
  onDelete?: () => Promise<boolean | void>;
};

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function OwedSheet({ existing, people, person: startPerson, kind: startKind, projectId, today, onClose, onSave, onDelete }: Props) {
  const [person, setPerson] = useState(existing?.person ?? startPerson ?? '');
  const [kind, setKind] = useState<OwedKind>(existing?.kind ?? startKind ?? 'lent');
  const [amount, setAmount] = useState(existing ? senToInput(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sen = parseRM(amount);
  const valid = normalizeName(person) !== '' && sen !== null && sen > 0 && isValidDate(date);

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
    <Sheet visible title={t(existing ? 'owed.edit' : 'owed.add')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OWED_KINDS.map((k) => (
            <Chip key={k} label={t(`owed.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <TextField label={t('owed.person')} value={person} onChange={setPerson} maxLength={40} />
        {people.length > 0 ? (
          <View style={{ gap: 6 }}>
            <AppText variant="small" tone="muted">{t('owed.personHint')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {people.map((p) => (
                <Chip key={p} compact label={p} selected={normalizeName(person).toLowerCase() === p.toLowerCase()} onPress={() => setPerson(p)} />
              ))}
            </View>
          </View>
        ) : null}
        <AmountInput label={t('common.amount')} value={amount} onChange={setAmount} compact autoFocus={!existing} />
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('common.date')}</AppText>
          <View style={{ flexDirection: 'row' }}>
            <DateField label={t('common.date')} value={date} onChange={setDate} />
          </View>
        </View>
        <TextField label={t('common.note')} value={note} onChange={setNote} maxLength={80} />
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button
          title={t('common.save')}
          disabled={!valid || busy}
          onPress={() => run(() => onSave({ person: normalizeName(person), kind, amount: sen ?? 0, date, note: note.trim(), projectId: existing?.projectId ?? projectId }))}
        />
        {existing && onDelete ? (
          <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
        ) : null}
      </View>
    </Sheet>
  );
}
