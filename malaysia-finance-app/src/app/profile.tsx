import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatRM, parsePercent, parseRM, senToInput } from '@/domain/money';
import { estimateNetMonthly } from '@/domain/netpay';
import { useIncome } from '@/hooks/useIncome';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { sanitizeNumber } from '@/ui/numeric';

/** 0.11 -> "11", 0.0925 -> "9.25" (avoids floating point noise like 11.000000000000002). */
const rateToText = (rate: number) => String(Math.round(rate * 10000) / 100);

export default function Profile() {
  const { c } = useTheme();
  const { data: profile, save } = useProfile();
  const { received } = useIncome(useToday().slice(0, 7));

  const [gross, setGross] = useState(profile.grossMonthly > 0 ? senToInput(profile.grossMonthly) : '');
  const [net, setNet] = useState(profile.netMonthlyOverride !== null ? senToInput(profile.netMonthlyOverride) : '');
  const [epf, setEpf] = useState(rateToText(profile.epfRate));
  const [socso, setSocso] = useState(profile.socsoMonthly > 0 ? senToInput(profile.socsoMonthly) : '');
  const [eis, setEis] = useState(profile.eisMonthly > 0 ? senToInput(profile.eisMonthly) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const optional = (text: string) => (text.trim() === '' ? 0 : parseRM(text));
  const grossSen = optional(gross);
  const netSen = net.trim() === '' ? null : parseRM(net);
  const epfPct = parsePercent(epf, 100);
  const socsoSen = optional(socso);
  const eisSen = optional(eis);
  const valid =
    grossSen !== null && epfPct !== null && socsoSen !== null && eisSen !== null && (net.trim() === '' || netSen !== null);

  const draft = valid
    ? {
        ...profile,
        grossMonthly: grossSen,
        netMonthlyOverride: netSen,
        epfRate: epfPct / 100,
        socsoMonthly: socsoSen,
        eisMonthly: eisSen,
      }
    : null;

  async function onSave() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      await save(draft);
      router.back();
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
        <Card>
          <AppText variant="bodyStrong">{t('profile.estimate', { amount: formatRM(estimateNetMonthly({ ...profile, ...draft })) })}</AppText>
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
      <AmountInput label={t('profile.socso')} value={socso} onChange={(text) => setSocso(text)} />
      <AmountInput label={t('profile.eis')} value={eis} onChange={(text) => setEis(text)} />
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <Button title={t('common.save')} onPress={onSave} disabled={!valid || busy} />
    </Screen>
  );
}
