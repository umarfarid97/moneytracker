import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatRM, parsePercent, parseRM, senToInput } from '@/domain/money';
import { estimateEis, estimateSocso, takeHomeBreakdown, type Deduction } from '@/domain/netpay';
import { useEstimatedPcb } from '@/hooks/useEstimatedPcb';
import { useIncome } from '@/hooks/useIncome';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PaydayPicker } from '@/ui/PaydayPicker';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { sanitizeNumber } from '@/ui/numeric';

/** 0.11 -> "11", 0.0925 -> "9.25" (avoids floating point noise like 11.000000000000002). */
const rateToText = (rate: number) => String(Math.round(rate * 10000) / 100);

function DeductionRow({ label, amount, deduction }: { label: string; amount: number; deduction?: Deduction }) {
  const kind = deduction ? ` (${t(deduction.estimated ? 'profile.estimated' : 'profile.entered')})` : '';
  return (
    <AppText variant="small" tone="muted">
      {`${label}: - ${formatRM(amount)}${kind}`}
    </AppText>
  );
}

export default function Profile() {
  const { c } = useTheme();
  const { data: profile, save } = useProfile();
  const { received } = useIncome(useToday().slice(0, 7));

  const [gross, setGross] = useState(profile.grossMonthly > 0 ? senToInput(profile.grossMonthly) : '');
  const [net, setNet] = useState(profile.netMonthlyOverride !== null ? senToInput(profile.netMonthlyOverride) : '');
  const [epf, setEpf] = useState(rateToText(profile.epfRate));
  const [socso, setSocso] = useState(profile.socsoMonthly > 0 ? senToInput(profile.socsoMonthly) : '');
  const [eis, setEis] = useState(profile.eisMonthly > 0 ? senToInput(profile.eisMonthly) : '');
  const [pcb, setPcb] = useState(profile.pcbMonthly > 0 ? senToInput(profile.pcbMonthly) : '');
  const [startDay, setStartDay] = useState(profile.budgetStartDay);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const optional = (text: string) => (text.trim() === '' ? 0 : parseRM(text));
  const grossSen = optional(gross);
  const netSen = net.trim() === '' ? null : parseRM(net);
  const epfPct = parsePercent(epf, 100);
  const socsoSen = optional(socso);
  const eisSen = optional(eis);
  const pcbSen = optional(pcb);
  const valid =
    grossSen !== null && epfPct !== null && socsoSen !== null && eisSen !== null && pcbSen !== null && (net.trim() === '' || netSen !== null);

  const estimatedPcb = useEstimatedPcb(grossSen ?? undefined);
  const draft = valid
    ? {
        ...profile,
        grossMonthly: grossSen,
        netMonthlyOverride: netSen,
        epfRate: epfPct / 100,
        socsoMonthly: socsoSen,
        eisMonthly: eisSen,
        pcbMonthly: pcbSen,
        budgetStartDay: startDay,
      }
    : null;

  const breakdown = draft ? takeHomeBreakdown(draft, estimatedPcb) : null;

  async function onSave() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      await save(draft);
      setSaved(true);
      setTimeout(() => router.back(), 700);
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
    borderColor: epfPct === null ? c.negative : c.control,
    paddingHorizontal: 14,
    color: c.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  } as const;

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('profile.title')}</AppText>
      {draft ? (
        <Card style={{ gap: 6 }}>
          <AppText variant="bodyStrong">{t(breakdown!.overridden ? 'profile.estimateOverride' : 'profile.estimate', { amount: formatRM(breakdown!.net) })}</AppText>
          {breakdown!.overridden ? null : (
            <View style={{ gap: 2 }}>
              <DeductionRow label={t('profile.line.epf')} amount={breakdown!.epf} />
              <DeductionRow label={t('profile.line.socso')} amount={breakdown!.socso.amount} deduction={breakdown!.socso} />
              <DeductionRow label={t('profile.line.eis')} amount={breakdown!.eis.amount} deduction={breakdown!.eis} />
              <DeductionRow label={t('profile.line.pcb')} amount={breakdown!.pcb.amount} deduction={breakdown!.pcb} />
            </View>
          )}
        </Card>
      ) : null}
      <PressableScale accessibilityRole="button" accessibilityLabel={t('profile.extra')} onPress={() => router.push('/income')}>
        <Card style={{ gap: 4 }}>
          <AppText variant="bodyStrong">{t('profile.extra')}</AppText>
          <AppText variant="small" tone="muted">{t('profile.extraHint', { amount: formatRM(received) })}</AppText>
        </Card>
      </PressableScale>
      <AmountInput label={t('profile.gross')} value={gross} onChange={(text) => setGross(text)} />
      <View style={{ gap: 4 }}>
        <AmountInput label={t('profile.net')} value={net} onChange={(text) => setNet(text)} />
        <AppText variant="small" tone="muted">
          {t('profile.netHint')}
        </AppText>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('profile.epf')}</AppText>
        <TextInput
          accessibilityLabel={t('profile.epf')}
          value={epf}
          onChangeText={(text) => setEpf(sanitizeNumber(text, 2))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={field}
        />
      </View>
      <View style={{ gap: 4 }}>
        <AmountInput label={t('profile.socso')} value={socso} onChange={(text) => setSocso(text)} placeholder={senToInput(estimateSocso(grossSen ?? 0))} />
        <AppText variant="small" tone="muted">{t('profile.deductionHint')}</AppText>
      </View>
      <View style={{ gap: 4 }}>
        <AmountInput label={t('profile.eis')} value={eis} onChange={(text) => setEis(text)} placeholder={senToInput(estimateEis(grossSen ?? 0))} />
        <AppText variant="small" tone="muted">{t('profile.deductionHint')}</AppText>
      </View>
      <View style={{ gap: 4 }}>
        <AmountInput label={t('profile.pcb')} value={pcb} onChange={(text) => setPcb(text)} placeholder={senToInput(estimatedPcb)} />
        <AppText variant="small" tone="muted">{t('profile.pcbHint')}</AppText>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('profile.salaryDay')}</AppText>
        <PaydayPicker value={startDay} onChange={setStartDay} />
        <AppText variant="small" tone="muted">{t('profile.salaryDayHint')}</AppText>
      </View>
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      {saved ? (
        <AppText variant="smallStrong" tone="positive">
          {t('profile.saved')}
        </AppText>
      ) : null}
      <Button title={t('common.save')} onPress={onSave} disabled={!valid || busy || saved} />
    </Screen>
  );
}
