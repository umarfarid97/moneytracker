import { useState } from 'react';
import { View } from 'react-native';
import { isValidDate } from '@/domain/dates';
import type { IncomeEntry, IncomeRule, NewIncomeEntry, NewIncomeRule } from '@/domain/income';
import { parseRM, senToInput } from '@/domain/money';
import { TextField } from '@/features/wealth/TextField';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { Sheet } from '@/ui/Sheet';

type Common = { today: string; onClose: () => void; onDelete?: () => Promise<boolean | void> };

function useRun(onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
  return { error, busy, run };
}

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function RuleSheet({ existing, today, onClose, onSave, onDelete }: Common & {
  existing: IncomeRule | null;
  onSave: (input: NewIncomeRule) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? senToInput(existing.amount) : '');
  const [dayText, setDayText] = useState(existing ? String(existing.dayOfMonth) : '');
  const [active, setActive] = useState(existing?.active ?? true);
  const { error, busy, run } = useRun(onClose);

  const sen = parseRM(amount);
  const day = Number(dayText);
  const dayOk = dayText !== '' && Number.isInteger(day) && day >= 1 && day <= 31;
  const valid = name.trim() !== '' && sen !== null && sen > 0 && dayOk;

  return (
    <Sheet visible title={t(existing ? 'income.ruleEdit' : 'income.addRule')} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <Button
            title={t('common.save')}
            disabled={!valid || busy}
            onPress={() => run(() => onSave({
              name: name.trim(), amount: sen ?? 0, dayOfMonth: day, active,
              // A rule only fills in days from the day it was added, so earlier days are never invented.
              startDate: existing?.startDate ?? today,
            }))}
          />
          {existing && onDelete ? (
            <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
          ) : null}
        </View>
      )}
    >
      <View style={{ gap: 16 }}>
        <TextField label={t('income.name')} value={name} onChange={setName} placeholder={t('income.namePlaceholder')} maxLength={40} />
        <AmountInput label={t('common.amount')} value={amount} onChange={setAmount} compact />
        <TextField label={t('income.day')} value={dayText} onChange={setDayText} numeric decimals={0} maxLength={2} />
        {dayText !== '' && !dayOk ? <AppText variant="small" tone="negative">{t('income.dayInvalid')}</AppText> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('income.active')} selected={active} onPress={() => setActive(true)} />
          <Chip label={t('income.paused')} selected={!active} onPress={() => setActive(false)} />
        </View>
      </View>
    </Sheet>
  );
}

export function EntrySheet({ existing, today, onClose, onSave, onDelete }: Common & {
  existing: IncomeEntry | null;
  onSave: (input: NewIncomeEntry) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? senToInput(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? today);
  const { error, busy, run } = useRun(onClose);

  const sen = parseRM(amount);
  const valid = name.trim() !== '' && sen !== null && sen > 0 && isValidDate(date);

  return (
    <Sheet visible title={t(existing ? 'income.entryEdit' : 'income.addOnce')} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <Button
            title={t('common.save')}
            disabled={!valid || busy}
            onPress={() => run(() => onSave({ name: name.trim(), amount: sen ?? 0, date }))}
          />
          {existing && onDelete ? (
            <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
          ) : null}
        </View>
      )}
    >
      <View style={{ gap: 16 }}>
        <TextField label={t('income.name')} value={name} onChange={setName} placeholder={t('income.namePlaceholder')} maxLength={40} />
        <AmountInput label={t('common.amount')} value={amount} onChange={setAmount} compact />
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t('common.date')}</AppText>
          <View style={{ flexDirection: 'row' }}>
            <DateField label={t('common.date')} value={date} onChange={setDate} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}
