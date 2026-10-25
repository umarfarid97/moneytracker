import { useMemo, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { resolveTaxData } from '@/data/tax';
import { parseRM, senToInput } from '@/domain/money';
import type { Commitment, CommitmentKind, NewCommitment } from '@/domain/types';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ReliefPicker } from '@/ui/ReliefPicker';
import { Sheet } from '@/ui/Sheet';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export type CommitmentInput = NewCommitment;

type Props = {
  visible: boolean;
  /** The commitment being edited, or null to add a new one. */
  existing: Commitment | null;
  onClose: () => void;
  onSave: (input: CommitmentInput) => Promise<void>;
  /** Resolves false when the person backs out of deleting, which keeps the sheet open. */
  onDelete?: () => Promise<boolean | void>;
};

const KINDS: CommitmentKind[] = ['bill', 'loan', 'subscription'];

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function CommitmentSheet({ visible, existing, onClose, onSave, onDelete }: Props) {
  const { c } = useTheme();
  const today = useToday();
  const { data: categories } = useCategories();
  const { data: methods } = usePaymentMethods();
  const reliefs = useMemo(() => resolveTaxData(Number(today.slice(0, 4))).data.reliefs, [today]);

  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? senToInput(existing.amount) : '');
  const [dayText, setDayText] = useState(existing ? String(existing.dayOfMonth) : '');
  const [kind, setKind] = useState<CommitmentKind>(existing?.kind ?? 'bill');
  const [active, setActive] = useState(existing?.active ?? true);
  const [categoryId, setCategoryId] = useState<number | null>(
    existing ? existing.categoryId : (categories.find((cat) => cat.name === 'Bil')?.id ?? null),
  );
  const [methodId, setMethodId] = useState<number | null>(existing ? existing.paymentMethodId : (methods[0]?.id ?? null));
  const [reliefId, setReliefId] = useState<string | null>(existing?.reliefId ?? null);
  const [auto, setAuto] = useState(existing?.autoRecord ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseRM(amountText);
  const day = /^\d{1,2}$/.test(dayText.trim()) ? Number(dayText) : NaN;
  const valid = name.trim() !== '' && amount !== null && amount > 0 && day >= 1 && day <= 31;

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

        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('commitments.recordsAs')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                accessibilityLabel={`Bill category ${cat.name}`}
                selected={cat.id === categoryId}
                onPress={() => setCategoryId(cat.id)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('method.field')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {methods.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                accessibilityLabel={`Bill method ${m.name}`}
                selected={m.id === methodId}
                onPress={() => setMethodId(m.id)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('relief.field')}</AppText>
          <ReliefPicker reliefs={reliefs} value={reliefId} onChange={setReliefId} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{t('commitments.auto')}</AppText>
            <AppText variant="small" tone="muted">
              {t('commitments.autoHint')}
            </AppText>
          </View>
          <Switch accessibilityLabel={t('commitments.auto')} value={auto} onValueChange={setAuto} />
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
            run(() =>
              onSave({
                name: name.trim(), amount: amount ?? 0, dayOfMonth: day, kind, active,
                categoryId, paymentMethodId: methodId, reliefId, autoRecord: auto,
                startDate: existing?.startDate ?? today,
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
