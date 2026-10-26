import { useState } from 'react';
import { View } from 'react-native';
import { parseRM, senToInput } from '@/domain/money';
import { SAVINGS_KINDS, type NewSavingsAccount, type SavingsAccount, type SavingsKind } from '@/domain/savings';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Sheet } from '@/ui/Sheet';
import { TextField } from './TextField';

type Props = {
  visible: boolean;
  existing: SavingsAccount | null;
  onClose: () => void;
  onSave: (input: NewSavingsAccount) => Promise<void>;
  onDelete?: () => Promise<boolean | void>;
};

const optional = (text: string) => (text.trim() === '' ? null : parseRM(text));

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function SavingsSheet({ visible, existing, onClose, onSave, onDelete }: Props) {
  const [kind, setKind] = useState<SavingsKind>(existing?.kind ?? 'tabung_haji');
  const [name, setName] = useState(existing?.name ?? SAVINGS_KINDS[0].defaultName);
  const [balance, setBalance] = useState(existing ? senToInput(existing.balance) : '');
  const [invested, setInvested] = useState(existing ? senToInput(existing.invested) : '');
  const [target, setTarget] = useState(existing?.target ? senToInput(existing.target) : '');
  const [monthly, setMonthly] = useState(existing?.monthly ? senToInput(existing.monthly) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const balanceSen = balance.trim() === '' ? 0 : parseRM(balance);
  const investedSen = invested.trim() === '' ? balanceSen : parseRM(invested);
  const targetSen = optional(target);
  const monthlySen = optional(monthly);
  const valid =
    name.trim() !== '' && balanceSen !== null && investedSen !== null &&
    (target.trim() === '' || (targetSen !== null && targetSen > 0)) && (monthly.trim() === '' || monthlySen !== null);

  function pickKind(next: SavingsKind) {
    // A name left as the previous type's default follows the new type.
    const previous = SAVINGS_KINDS.find((k) => k.kind === kind)?.defaultName ?? '';
    if (name.trim() === '' || name === previous) setName(SAVINGS_KINDS.find((k) => k.kind === next)?.defaultName ?? '');
    setKind(next);
  }

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
    <Sheet visible={visible} title={t(existing ? 'savings.edit' : 'savings.add')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SAVINGS_KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => pickKind(k.kind)} />
          ))}
        </View>
        <TextField label={t('savings.name')} value={name} onChange={setName} maxLength={40} />
        <AmountInput label={t('savings.balance')} value={balance} onChange={setBalance} compact />
        <AmountInput label={t('savings.invested')} value={invested} onChange={setInvested} compact />
        <AppText variant="small" tone="muted">{t('savings.investedHint')}</AppText>
        <AmountInput label={t('savings.target')} value={target} onChange={setTarget} compact />
        <AmountInput label={t('savings.monthly')} value={monthly} onChange={setMonthly} compact />
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button
          title={t('common.save')}
          disabled={!valid || busy}
          onPress={() =>
            run(() =>
              onSave({
                name: name.trim(),
                kind,
                balance: balanceSen ?? 0,
                invested: investedSen ?? 0,
                target: targetSen,
                monthly: monthlySen && monthlySen > 0 ? monthlySen : null,
                note: existing?.note ?? '',
              }),
            )
          }
        />
        {existing && onDelete ? (
          <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
        ) : null}
      </View>
    </Sheet>
  );
}
