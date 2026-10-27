import { useState } from 'react';
import { View } from 'react-native';
import { isValidDate } from '@/domain/dates';
import { parseRM, senToInput } from '@/domain/money';
import {
  suggestedEpf, type NewRetirementEntry, type RetirementEntry, type RetirementKind, type RetirementScheme,
} from '@/domain/retirement';
import { useProfile } from '@/hooks/useProfile';
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
  /** Which screen opened it: EPF offers all kinds of record, SOCSO only contributions. */
  group: 'epf' | 'socso';
  existing: RetirementEntry | null;
  onClose: () => void;
  onSave: (input: NewRetirementEntry) => Promise<void>;
  onDelete?: () => Promise<boolean | void>;
};

const EPF_KINDS: RetirementKind[] = ['contribution', 'dividend', 'withdrawal', 'opening'];

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function RetirementSheet({ visible, group, existing, onClose, onSave, onDelete }: Props) {
  const today = useToday();
  const { data: profile } = useProfile();
  const [scheme, setScheme] = useState<RetirementScheme>(existing?.scheme ?? (group === 'epf' ? 'epf' : 'socso'));
  const [kind, setKind] = useState<RetirementKind>(existing?.kind ?? 'contribution');
  const [date, setDate] = useState(existing?.date ?? today);
  const [employee, setEmployee] = useState(existing && existing.kind === 'contribution' ? senToInput(existing.amount - existing.employerShare) : '');
  const [employer, setEmployer] = useState(existing && existing.kind === 'contribution' ? senToInput(existing.employerShare) : '');
  const [amount, setAmount] = useState(existing && existing.kind !== 'contribution' ? senToInput(existing.amount) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const contribution = kind === 'contribution';
  const employeeSen = employee.trim() === '' ? 0 : parseRM(employee);
  const employerSen = employer.trim() === '' ? 0 : parseRM(employer);
  const amountSen = parseRM(amount);
  const total = contribution ? (employeeSen ?? 0) + (employerSen ?? 0) : (amountSen ?? 0);
  const valid = isValidDate(date) && total > 0 && (contribution ? employeeSen !== null && employerSen !== null : amountSen !== null);

  function fill() {
    if (scheme === 'epf') {
      const s = suggestedEpf(profile.grossMonthly, profile.epfRate);
      setEmployee(senToInput(s.employee));
      setEmployer(senToInput(s.employer));
    } else {
      setEmployee(senToInput(scheme === 'eis' ? profile.eisMonthly : profile.socsoMonthly));
    }
  }
  const canFill = contribution && (scheme === 'epf' ? profile.grossMonthly > 0 : (scheme === 'eis' ? profile.eisMonthly : profile.socsoMonthly) > 0);

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

  const save = () =>
    run(() =>
      onSave({
        scheme,
        kind,
        date,
        amount: total,
        employerShare: contribution ? (employerSen ?? 0) : 0,
        note: note.trim(),
      }),
    );

  return (
    <Sheet visible={visible} title={t(existing ? 'retirement.edit' : 'retirement.add')} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <Button title={t('common.save')} onPress={save} disabled={!valid || busy} />
          {existing && onDelete ? (
            <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
          ) : null}
        </View>
      )}
    >
      <View style={{ gap: 16 }}>
        {group === 'socso' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['socso', 'eis'] as const).map((s) => (
              <Chip key={s} label={t(`retirement.scheme.${s}`)} selected={scheme === s} onPress={() => setScheme(s)} />
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EPF_KINDS.map((k) => (
              <Chip key={k} label={t(`retirement.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
        )}
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t(contribution ? 'retirement.forMonth' : 'common.date')}</AppText>
          <View style={{ flexDirection: 'row' }}>
            <DateField value={date} onChange={setDate} label={t('common.date')} />
          </View>
        </View>
        {contribution ? (
          <>
            {canFill ? <Button title={t('retirement.fill')} variant="secondary" compact onPress={fill} /> : null}
            <AmountInput label={t('retirement.employee')} value={employee} onChange={setEmployee} compact />
            <AmountInput label={t('retirement.employer')} value={employer} onChange={setEmployer} compact />
          </>
        ) : (
          <AmountInput label={t('common.amount')} value={amount} onChange={setAmount} compact />
        )}
        <TextField label={t('common.note')} value={note} onChange={setNote} maxLength={80} />
      </View>
    </Sheet>
  );
}
