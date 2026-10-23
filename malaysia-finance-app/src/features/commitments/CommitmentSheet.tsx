import { useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { parseRM, senToInput } from '@/domain/money';
import type { Commitment, CommitmentKind } from '@/domain/types';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Sheet } from '@/ui/Sheet';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export type CommitmentInput = Omit<Commitment, 'id'>;

type Props = {
  visible: boolean;
  /** The commitment being edited, or null to add a new one. */
  existing: Commitment | null;
  onClose: () => void;
  onSave: (input: CommitmentInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

const KINDS: CommitmentKind[] = ['bill', 'loan', 'subscription'];

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function CommitmentSheet({ visible, existing, onClose, onSave, onDelete }: Props) {
  const { c } = useTheme();
  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? senToInput(existing.amount) : '');
  const [dayText, setDayText] = useState(existing ? String(existing.dayOfMonth) : '');
  const [kind, setKind] = useState<CommitmentKind>(existing?.kind ?? 'bill');
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseRM(amountText);
  const day = /^\d{1,2}$/.test(dayText.trim()) ? Number(dayText) : NaN;
  const valid = name.trim() !== '' && amount !== null && amount > 0 && day >= 1 && day <= 31;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const field = {
    height: controlHeight,
    borderRadius: radius.control,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.control,
    paddingHorizontal: 14,
    color: c.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  } as const;

  return (
    <Sheet visible={visible} title={t(existing ? 'commitments.edit' : 'commitments.add')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('commitments.name')}</AppText>
          <TextInput
            accessibilityLabel={t('commitments.name')}
            value={name}
            onChangeText={setName}
            placeholderTextColor={c.muted}
            style={field}
          />
        </View>
        <AmountInput label={t('common.amount')} value={amountText} onChange={(text) => setAmountText(text)} />
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('commitments.day')}</AppText>
          <TextInput
            accessibilityLabel={t('commitments.day')}
            value={dayText}
            onChangeText={setDayText}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="1 - 31"
            placeholderTextColor={c.muted}
            style={field}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {KINDS.map((k) => (
            <Chip key={k} label={t(`commitments.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        {existing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong">{t('commitments.active')}</AppText>
            <Switch accessibilityLabel={t('commitments.active')} value={active} onValueChange={setActive} />
          </View>
        ) : null}
        {error ? (
          <AppText variant="small" tone="negative">
            {error}
          </AppText>
        ) : null}
        <Button
          title={t('common.save')}
          disabled={!valid || busy}
          onPress={() =>
            run(() => onSave({ name: name.trim(), amount: amount ?? 0, dayOfMonth: day, kind, active }))
          }
        />
        {existing && onDelete ? (
          <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
        ) : null}
      </View>
    </Sheet>
  );
}
