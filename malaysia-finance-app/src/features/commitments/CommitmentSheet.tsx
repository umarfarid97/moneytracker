import { useMemo, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { resolveTaxData } from '@/data/tax';
import { BILLER_GROUPS, billersIn, type BillerGroup } from '@/domain/billers';
import { SUBSCRIPTION_GROUPS, subscriptionsIn, type SubscriptionGroup } from '@/domain/subscriptions';
import { BNPL_PROVIDERS, bnplFor, instalmentNumber, LOAN_TYPES, startFromCycle } from '@/domain/loanTracker';
import { isValidDate } from '@/domain/dates';
import { parsePercent, parseRM, senToInput, type Sen } from '@/domain/money';
import type { Commitment, CommitmentKind, LoanType, NewCommitment } from '@/domain/types';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { brandForBill } from '@/domain/brandLookup';
import { BrandBadge } from '@/ui/BrandBadge';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { MethodBadge } from '@/ui/MethodBadge';
import { ReliefPicker } from '@/ui/ReliefPicker';
import { PressableScale } from '@/ui/PressableScale';
import { Sheet } from '@/ui/Sheet';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { sanitizeNumber } from '@/ui/numeric';

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

type Flow = 'bill' | 'loan' | 'other';
const FLOWS: Flow[] = ['bill', 'loan', 'other'];
const FLOW_KIND: Record<Flow, CommitmentKind> = { bill: 'bill', loan: 'loan', other: 'subscription' };
const FLOW_ICON: Record<Flow, keyof typeof Ionicons.glyphMap> = {
  bill: 'document-text-outline',
  loan: 'home-outline',
  other: 'calendar-outline',
};

/** A titled white card that groups related fields. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 14, padding: 14, borderRadius: radius.control, borderWidth: 1, borderColor: c.control, backgroundColor: c.surface }}>
      <AppText variant="bodyStrong">{title}</AppText>
      {children}
    </View>
  );
}

/** A field label, with a red asterisk when the field is required. */
function Label({ text, required = false }: { text: string; required?: boolean }) {
  const { c } = useTheme();
  return (
    <AppText variant="smallStrong">
      {text}
      {required ? <AppText variant="smallStrong" color={c.negative}> *</AppText> : null}
    </AppText>
  );
}

/** A round icon on a tinted disc: `tone` is the icon colour and the disc is a soft wash of it. */
function TintDisc({ icon, tone, size = 48 }: { icon: keyof typeof Ionicons.glyphMap; tone: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${tone}26`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tone} />
    </View>
  );
}

/** A dropdown-looking row: icon, value and a chevron. Tapping it toggles `open`; a fixed row has no `onPress`. */
function SelectRow({ icon, value, open, onPress, accessibilityLabel }: {
  icon: keyof typeof Ionicons.glyphMap; value: string; open?: boolean; onPress?: () => void; accessibilityLabel: string;
}) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      disabled={!onPress}
      onPress={onPress}
      style={{
        height: controlHeight, borderRadius: radius.control, borderWidth: 1, borderColor: open ? c.accent : c.control,
        backgroundColor: c.surface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10,
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{value}</AppText>
      {onPress ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} /> : null}
    </PressableScale>
  );
}

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
  const [schedule, setSchedule] = useState<'none' | 'start' | 'cycle'>(existing?.loanStart ? 'start' : 'none');
  const [loanStart, setLoanStart] = useState(existing?.loanStart ?? today);
  const [cycleText, setCycleText] = useState('');
  const [hasStart, setHasStart] = useState(existing?.startsOn != null);
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? today);
  const [hasEnd, setHasEnd] = useState(existing?.endsOn != null);
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? today);
  const [group, setGroup] = useState<BillerGroup>('utilities');
  const [subGroup, setSubGroup] = useState<SubscriptionGroup>('streaming');
  const [step, setStep] = useState<'choose' | 'form'>(existing ? 'form' : 'choose');
  const [moreOpen, setMoreOpen] = useState(existing !== null);
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLoan = kind === 'loan';
  /** Loans are always a fixed payment, so the fixed / changes-monthly choice only applies to the rest. */
  const isVariable = variable && !isLoan;
  const optionalRM = (text: string) => (text.trim() === '' ? null : parseRM(text));
  const balance = optionalRM(balanceText);
  const original = optionalRM(originalText);
  const rate = rateText.trim() === '' ? null : parsePercent(rateText, 100);
  const cycle = /^\d{1,3}$/.test(cycleText.trim()) ? Number(cycleText) : NaN;
  const scheduleOk =
    schedule === 'none' || (schedule === 'start' ? isValidDate(loanStart) : cycle >= 1);
  const loanValid =
    !isLoan ||
    (scheduleOk &&
      (balanceText.trim() === '' || balance !== null) &&
      (originalText.trim() === '' || original !== null) &&
      (rateText.trim() === '' || rate !== null));

  const amount = parseRM(amountText);
  const day = /^\d{1,2}$/.test(dayText.trim()) ? Number(dayText) : NaN;
  const datesOk =
    (!hasStart || isValidDate(startsOn)) && (!hasEnd || isValidDate(endsOn)) && (!hasStart || !hasEnd || endsOn >= startsOn);
  const valid = name.trim() !== '' && amount !== null && amount > 0 && day >= 1 && day <= 31 && loanValid && datesOk;

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
  function loanFields(): Pick<Commitment, 'loanType' | 'loanBalance' | 'loanBalanceDate' | 'loanOriginal' | 'loanRatePct' | 'loanStart'> {
    if (!isLoan) return { loanType: null, loanBalance: null, loanBalanceDate: null, loanOriginal: null, loanRatePct: null, loanStart: null };
    const unchanged =
      existing?.loanBalance != null && balance === startBalance && rate === existing.loanRatePct;
    return {
      loanType,
      loanBalance: unchanged ? existing!.loanBalance : balance,
      loanBalanceDate: balance === null ? null : unchanged ? existing!.loanBalanceDate : today,
      loanOriginal: original,
      loanRatePct: rate,
      loanStart: schedule === 'none' ? null : schedule === 'start' ? loanStart : startFromCycle(cycle, day, today),
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

  const nameField = (
    <View style={{ gap: 8 }}>
      <Label text={t('commitments.name')} required />
      <TextInput accessibilityLabel={t('commitments.name')} value={name} onChangeText={setName} placeholderTextColor={c.muted} style={field} />
    </View>
  );
  const dayField = (
    <View style={{ gap: 8 }}>
      <Label text={t('addflow.dueDay')} required />
      <TextInput
        accessibilityLabel={t('commitments.day')}
        value={dayText}
        onChangeText={(text) => setDayText(sanitizeNumber(text, 0))}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="1 - 31"
        placeholderTextColor={c.muted}
        style={field}
      />
    </View>
  );
  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const categoryBlock = (
    <View style={{ gap: 8 }}>
      <Label text={t('addflow.category')} required />
      <SelectRow
        accessibilityLabel={t('addflow.category')}
        icon={(selectedCategory?.icon ?? 'pricetag-outline') as keyof typeof Ionicons.glyphMap}
        value={selectedCategory?.name ?? '-'}
        open={catOpen}
        onPress={() => setCatOpen((v) => !v)}
      />
      {catOpen ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              accessibilityLabel={`Bill category ${cat.name}`}
              selected={cat.id === categoryId}
              onPress={() => {
                setCategoryId(cat.id);
                setCatOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}
      <AppText variant="small" tone="muted">{t('commitments.recordsAs')}</AppText>
    </View>
  );
  const methodBlock = (
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
  );
  const reliefBlock = (
    <View style={{ gap: 8 }}>
      <AppText variant="smallStrong">{t('relief.field')}</AppText>
      <ReliefPicker reliefs={reliefs} value={reliefId} onChange={setReliefId} />
    </View>
  );
  // A loan runs on its own schedule, so the bill start/end dates only show for one that already has them.
  const datesBlock = isLoan && !hasStart && !hasEnd ? null : (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={t('bill.hasStart')} selected={hasStart} onPress={() => setHasStart((v) => !v)} />
        <Chip label={t('bill.hasEnd')} selected={hasEnd} onPress={() => setHasEnd((v) => !v)} />
      </View>
      {hasStart ? <DateField label={t('bill.startDate')} value={startsOn} onChange={setStartsOn} /> : null}
      {hasEnd ? <DateField label={t('bill.endDate')} value={endsOn} onChange={setEndsOn} /> : null}
      {hasStart && hasEnd && !datesOk ? <AppText variant="small" tone="negative">{t('bill.endBeforeStart')}</AppText> : null}
      <AppText variant="small" tone="muted">{t('bill.datesHint')}</AppText>
    </View>
  );
  // A bill that changes every month can't be recorded for you: its amount is only known when paid.
  const autoRow = isVariable ? null : (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{t('commitments.auto')}</AppText>
        <AppText variant="small" tone="muted">{t('commitments.autoHint')}</AppText>
      </View>
      <Switch accessibilityLabel={t('commitments.auto')} value={auto} onValueChange={setAuto} />
    </View>
  );

  const flow: Flow = isLoan ? 'loan' : kind === 'subscription' ? 'other' : 'bill';
  const flowTone = flow === 'bill' ? c.accent : flow === 'loan' ? c.positive : c.negative;
  const choosing = step === 'choose';
  const chooseFlow = (f: Flow) => {
    setKind(FLOW_KIND[f]);
    setVariable(false);
    setStep('form');
  };

  const moreOptions = (
    <View style={{ borderRadius: radius.control, borderWidth: 1, borderColor: c.control, backgroundColor: c.surface }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('addflow.more')}
        accessibilityState={{ expanded: moreOpen }}
        onPress={() => setMoreOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{t('addflow.more')}</AppText>
          <AppText variant="small" tone="muted">{t('addflow.moreHint')}</AppText>
        </View>
        <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
      </Pressable>
      {moreOpen ? (
        <View style={{ gap: 16, padding: 14, paddingTop: 2 }}>
          {methodBlock}
          {reliefBlock}
          {datesBlock}
          {autoRow}
        </View>
      ) : null}
    </View>
  );

  const quickPicks = existing ? null : kind === 'subscription' ? (
    <View style={{ gap: 8 }}>
      <Label text={t('subscriptions.pick')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SUBSCRIPTION_GROUPS.map((g) => (
          <Chip key={g} compact label={t(`subscriptions.group.${g}`)} selected={subGroup === g} onPress={() => setSubGroup(g)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {subscriptionsIn(subGroup).map((b) => (
          <Chip
            key={b.id}
            label={b.name}
            accessibilityLabel={`Subscription ${b.name}`}
            leading={<BrandBadge id={b.id} initials={b.initials} color={b.color} ink={b.ink} size={22} />}
            selected={name === b.name}
            onPress={() => {
              setName(b.name);
              setVariable(false);
              const cat = categories.find((x) => x.name === b.category);
              if (cat) setCategoryId(cat.id);
            }}
          />
        ))}
      </ScrollView>
      <AppText variant="small" tone="muted">{t('subscriptions.hint')}</AppText>
    </View>
  ) : (
    <View style={{ gap: 8 }}>
      <Label text={t('billers.pick')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {BILLER_GROUPS.map((g) => (
          <Chip key={g} compact label={t(`billers.group.${g}`)} selected={group === g} onPress={() => setGroup(g)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {billersIn(group).map((b) => (
          <Chip
            key={b.id}
            label={b.name}
            accessibilityLabel={`Biller ${b.name}`}
            leading={<BrandBadge id={b.id} initials={b.initials} color={b.color} ink={b.ink} icon={b.icon} size={22} />}
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
      </ScrollView>
      <AppText variant="small" tone="muted">{t('billers.hint')}</AppText>
    </View>
  );

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <TintDisc icon={FLOW_ICON[flow]} tone={flowTone} size={56} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="section">{t(`addflow.${flow}.title`)}</AppText>
        <AppText variant="small" tone="muted">{t(`addflow.${flow}.sub`)}</AppText>
      </View>
    </View>
  );

  const chooser = (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, backgroundColor: c.accentSoft }}>
        <TintDisc icon="document-text-outline" tone={c.accent} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{t('addflow.choose.title')}</AppText>
          <AppText variant="small" tone="muted">{t('addflow.choose.sub')}</AppText>
        </View>
      </View>
      {FLOWS.map((f) => {
        const tone = f === 'bill' ? c.accent : f === 'loan' ? c.positive : c.negative;
        return (
          <PressableScale
            key={f}
            accessibilityRole="button"
            accessibilityLabel={`${t(`addflow.${f}.title`)}. ${t(`addflow.${f}.desc`)}`}
            onPress={() => chooseFlow(f)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, backgroundColor: `${tone}14`, borderWidth: 1, borderColor: `${tone}33` }}
          >
            <TintDisc icon={FLOW_ICON[f]} tone={tone} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong">{t(`addflow.${f}.title`)}</AppText>
              <AppText variant="small" tone="muted">{t(`addflow.${f}.desc`)}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </PressableScale>
        );
      })}
    </View>
  );

  const footer = choosing ? undefined : (
    <View style={{ gap: 8 }}>
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      {!valid && loanValid ? (
        <AppText variant="small" tone="muted">
          {name.trim() === '' ? t('commitments.need.name') : amount === null || amount <= 0 ? t('commitments.need.amount') : t('commitments.need.day')}
        </AppText>
      ) : null}
      <Button
        title={existing ? t('common.save') : t(`addflow.save.${flow}`)}
        disabled={!valid || busy}
        onPress={() =>
          run(() =>
            onSave({
              name: name.trim(), amount: amount ?? 0, dayOfMonth: day, kind, active,
              categoryId, paymentMethodId: methodId, reliefId, autoRecord: auto && !isVariable, variable: isVariable,
              startDate: existing?.startDate ?? today,
              startsOn: hasStart ? startsOn : null, endsOn: hasEnd ? endsOn : null,
              ...loanFields(),
            }),
          )
        }
      />
      {existing && onDelete ? (
        <Button title={t('common.delete')} variant="secondary" disabled={busy} onPress={() => run(onDelete)} />
      ) : null}
    </View>
  );

  return (
    <Sheet
      tall
      visible={visible}
      title={existing ? t('commitments.edit') : t(choosing ? 'commitments.add' : `addflow.screen.${flow}`)}
      onClose={onClose}
      onBack={!existing && !choosing ? () => setStep('choose') : undefined}
      footer={footer}
    >
      {choosing ? chooser : (
        <View style={{ gap: 18 }}>
          {header}
          {isLoan ? (
            <>
            <Section title={t('loans.sec.about')}>
              <View style={{ gap: 8 }}>
                <AppText variant="smallStrong">{t('loans.type')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {LOAN_TYPES.map((lt) => (
                    <Chip
                      key={lt}
                      label={t(`loans.type.${lt}`)}
                      leading={<BrandBadge {...brandForBill('', 'loan', lt)!} size={22} />}
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
                        leading={<BrandBadge id={p.id} initials={p.initials} color={p.color} ink={p.ink} size={22} />}
                        selected={bnplFor(name)?.id === p.id}
                        onPress={() => setName(p.name)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              {nameField}
            </Section>
            <Section title={t('loans.sec.amounts')}>
              <AmountInput required label={t('loans.payment')} value={amountText} onChange={(text) => setAmountText(text)} />
              <AmountInput label={t('loans.balance')} value={balanceText} onChange={(text) => setBalanceText(text)} />
              <AmountInput label={t('loans.original')} value={originalText} onChange={(text) => setOriginalText(text)} />
              <View style={{ gap: 8 }}>
                <AppText variant="smallStrong">{t('loans.rate')}</AppText>
                <TextInput
                  accessibilityLabel={t('loans.rate')}
                  value={rateText}
                  onChangeText={(text) => setRateText(sanitizeNumber(text, 2))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={c.muted}
                  style={field}
                />
              </View>
            </Section>
            <Section title={t('loans.sec.schedule')}>
              {dayField}
              <View style={{ gap: 8 }}>
                <AppText variant="smallStrong">{t('loans.schedule')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(['none', 'start', 'cycle'] as const).map((m) => (
                    <Chip key={m} label={t(`loans.schedule.${m}`)} selected={schedule === m} onPress={() => setSchedule(m)} />
                  ))}
                </View>
                {schedule === 'start' ? (
                  <>
                    <DateField label={t('loans.startDate')} value={loanStart} onChange={setLoanStart} />
                    {isValidDate(loanStart) && instalmentNumber({ loanStart }, today) !== null ? (
                      <AppText variant="small" tone="muted">{t('loans.instalmentNo', { n: instalmentNumber({ loanStart }, today)! })}</AppText>
                    ) : null}
                  </>
                ) : null}
                {schedule === 'cycle' ? (
                  <>
                    <AppText variant="smallStrong">{t('loans.cycleNo')}</AppText>
                    <TextInput
                      accessibilityLabel={t('loans.cycleNo')}
                      value={cycleText}
                      onChangeText={(text) => setCycleText(sanitizeNumber(text, 0))}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder="1"
                      placeholderTextColor={c.muted}
                      style={field}
                    />
                    <AppText variant="small" tone="muted">{t('loans.cycleHint')}</AppText>
                  </>
                ) : null}
              </View>
            </Section>
              {categoryBlock}
              {moreOptions}
            </>
          ) : (
            <>
              {nameField}
              {quickPicks}
              {categoryBlock}
              <View style={{ gap: 8 }}>
                <Label text={t('commitments.type')} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip icon="lock-closed-outline" label={t('commitments.type.fixed')} selected={!variable} onPress={() => setVariable(false)} />
                  <Chip icon="pulse-outline" label={t('commitments.type.variable')} selected={variable} onPress={() => setVariable(true)} />
                </View>
                <AppText variant="small" tone="muted">
                  {t(variable ? 'commitments.type.variableHint' : 'commitments.type.fixedHint')}
                </AppText>
              </View>
              <AmountInput required label={t(variable ? 'commitments.estimate' : 'common.amount')} value={amountText} onChange={(text) => setAmountText(text)} />
              {dayField}
              <View style={{ gap: 8 }}>
                <Label text={t('addflow.repeat')} />
                <SelectRow accessibilityLabel={t('addflow.repeat')} icon="repeat-outline" value={t('addflow.monthly')} />
              </View>
              {moreOptions}
            </>
          )}
          {existing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="bodyStrong">{t('commitments.active')}</AppText>
              <Switch accessibilityLabel={t('commitments.active')} value={active} onValueChange={setActive} />
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}
