import { useMemo, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { resolveTaxData } from '@/data/tax';
import { BILLER_GROUPS, billersIn, type BillerGroup } from '@/domain/billers';
import { BNPL_PROVIDERS, bnplFor, LOAN_TYPES } from '@/domain/loanTracker';
import { parsePercent, parseRM, senToInput, type Sen } from '@/domain/money';
import type { Commitment, CommitmentKind, LoanType, NewCommitment } from '@/domain/types';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BrandBadge } from '@/ui/BrandBadge';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { MethodBadge } from '@/ui/MethodBadge';
import { ReliefPicker } from '@/ui/ReliefPicker';
import { Sheet } from '@/ui/Sheet';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export type CommitmentInput = NewCommitment;

type Props = {
  visible: boolean;
  /** The commitment being edited, or null to add a new one. */
  existing: Commitment | null;
  /** What is still owed on `existing` after the payments recorded so far (loans only). */
  currentBalance?: Sen | null;
  onClose: () => void;
  onSave: (input: CommitmentInput) => Promise<void>;
  /** Resolves false when the person backs out of deleting, which keeps the sheet open. */
  onDelete?: () => Promise<boolean | void>;
};

const KINDS: CommitmentKind[] = ['bill', 'loan', 'subscription'];

/** Mount with a fresh `key` each time it opens so the fields start from `existing`. */
export function CommitmentSheet({ visible, existing, currentBalance = null, onClose, onSave, onDelete }: Props) {
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
  const [variable, setVariable] = useState(existing?.variable ?? false);
  const [loanType, setLoanType] = useState<LoanType>(existing?.loanType ?? 'personal');
  const startBalance = currentBalance ?? existing?.loanBalance ?? null;
  const [balanceText, setBalanceText] = useState(startBalance !== null ? senToInput(startBalance) : '');
  const [originalText, setOriginalText] = useState(existing?.loanOriginal != null ? senToInput(existing.loanOriginal) : '');
  const [rateText, setRateText] = useState(existing?.loanRatePct != null ? String(existing.loanRatePct) : '');
  const [group, setGroup] = useState<BillerGroup>('utilities');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLoan = kind === 'loan';
  const optionalRM = (text: string) => (text.trim() === '' ? null : parseRM(text));
  const balance = optionalRM(balanceText);
  const original = optionalRM(originalText);
  const rate = rateText.trim() === '' ? null : parsePercent(rateText, 100);
  const loanValid =
    !isLoan ||
    ((balanceText.trim() === '' || balance !== null) &&
      (originalText.trim() === '' || original !== null) &&
      (rateText.trim() === '' || rate !== null));

  const amount = parseRM(amountText);
  const day = /^\d{1,2}$/.test(dayText.trim()) ? Number(dayText) : NaN;
  const valid = name.trim() !== '' && amount !== null && amount > 0 && day >= 1 && day <= 31 && loanValid;

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

  /**
   * The loan columns to save. A balance typed in (or a changed rate) starts counting payments from today;
   * leaving both alone keeps the saved balance and its date, so earlier payments keep counting.
   */
  function loanFields(): Pick<Commitment, 'loanType' | 'loanBalance' | 'loanBalanceDate' | 'loanOriginal' | 'loanRatePct'> {
    if (!isLoan) return { loanType: null, loanBalance: null, loanBalanceDate: null, loanOriginal: null, loanRatePct: null };
    const unchanged =
      existing?.loanBalance != null && balance === startBalance && rate === existing.loanRatePct;
    return {
      loanType,
      loanBalance: unchanged ? existing!.loanBalance : balance,
      loanBalanceDate: balance === null ? null : unchanged ? existing!.loanBalanceDate : today,
      loanOriginal: original,
      loanRatePct: rate,
    };
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {KINDS.map((k) => (
            <Chip key={k} label={t(`commitments.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        {isLoan ? (
          <View style={{ gap: 8 }}>
            <AppText variant="smallStrong">{t('loans.type')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LOAN_TYPES.map((lt) => (
                <Chip
                  key={lt}
                  label={t(`loans.type.${lt}`)}
                  selected={loanType === lt}
                  onPress={() => {
                    setLoanType(lt);
                    if (!existing && name.trim() === '' && lt !== 'bnpl') setName(t(`loans.type.${lt}`));
                  }}
                />
              ))}
            </View>
            {loanType === 'bnpl' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {BNPL_PROVIDERS.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    accessibilityLabel={`Pay later ${p.name}`}
                    leading={<BrandBadge initials={p.initials} color={p.color} ink={p.ink} size={22} />}
                    selected={bnplFor(name)?.id === p.id}
                    onPress={() => setName(p.name)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : existing ? null : (
          <View style={{ gap: 8 }}>
            <AppText variant="smallStrong">{t('billers.pick')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BILLER_GROUPS.map((g) => (
                <Chip key={g} compact label={t(`billers.group.${g}`)} selected={group === g} onPress={() => setGroup(g)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {billersIn(group).map((b) => (
                <Chip
                  key={b.id}
                  label={b.name}
                  accessibilityLabel={`Biller ${b.name}`}
                  leading={<BrandBadge initials={b.initials} color={b.color} ink={b.ink} size={22} />}
                  selected={name === b.name}
                  onPress={() => {
                    setName(b.name);
                    setKind(b.kind);
                    setVariable(b.variable);
                    const cat = categories.find((x) => x.name === b.category);
                    if (cat) setCategoryId(cat.id);
                  }}
                />
              ))}
            </View>
            <AppText variant="small" tone="muted">{t('billers.hint')}</AppText>
          </View>
        )}
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
        <View style={{ gap: 8 }}>
          <AppText variant="smallStrong">{t('commitments.type')}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip
              icon="lock-closed-outline"
              label={t('commitments.type.fixed')}
              selected={!variable}
              onPress={() => setVariable(false)}
            />
            <Chip
              icon="pulse-outline"
              label={t('commitments.type.variable')}
              selected={variable}
              onPress={() => setVariable(true)}
            />
          </View>
          <AppText variant="small" tone="muted">
            {t(variable ? 'commitments.type.variableHint' : 'commitments.type.fixedHint')}
          </AppText>
        </View>
        <AmountInput
          label={t(variable ? 'commitments.estimate' : 'common.amount')}
          value={amountText}
          onChange={(text) => setAmountText(text)}
        />
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

        {isLoan ? (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <AmountInput label={t('loans.balance')} value={balanceText} onChange={(text) => setBalanceText(text)} />
              <AppText variant="small" tone="muted">{t('loans.balanceHint')}</AppText>
            </View>
            <AmountInput label={t('loans.original')} value={originalText} onChange={(text) => setOriginalText(text)} />
            <View style={{ gap: 8 }}>
              <AppText variant="smallStrong">{t('loans.rate')}</AppText>
              <TextInput
                accessibilityLabel={t('loans.rate')}
                value={rateText}
                onChangeText={setRateText}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.muted}
                style={field}
              />
              <AppText variant="small" tone="muted">{t('loans.rateHint')}</AppText>
            </View>
          </View>
        ) : null}
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
                leading={<MethodBadge name={m.name} kind={m.kind} size={20} color={m.id === methodId ? c.onAccent : c.text} />}
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
        {/* A bill that changes every month can't be recorded for you: its amount is only known when paid. */}
        {variable ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{t('commitments.auto')}</AppText>
              <AppText variant="small" tone="muted">
                {t('commitments.autoHint')}
              </AppText>
            </View>
            <Switch accessibilityLabel={t('commitments.auto')} value={auto} onValueChange={setAuto} />
          </View>
        )}
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
                categoryId, paymentMethodId: methodId, reliefId, autoRecord: auto && !variable, variable,
                startDate: existing?.startDate ?? today,
                ...loanFields(),
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
