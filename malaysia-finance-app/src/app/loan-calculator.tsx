import { useState } from 'react';
import { TextInput, View } from 'react-native';
import {
  assessLoan, LOAN_DEFAULTS, monthlyInstalment, parseRatePct, parseYears, type LoanKind, type Verdict,
} from '@/domain/loan';
import { monthlyCommitmentTotal } from '@/domain/commitments';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { estimateNetMonthly } from '@/domain/netpay';
import { useCommitments } from '@/hooks/useCommitments';
import { useProfile } from '@/hooks/useProfile';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { sanitizeNumber } from '@/ui/numeric';

const KINDS: LoanKind[] = ['home', 'car', 'personal'];
const VERDICT_STATUS = { comfortable: 'on-track', tight: 'tight', 'not-suitable': 'over' } as const;

export default function LoanCalculator() {
  const { c, scheme } = useTheme();
  const { data: profile } = useProfile();
  const { data: commitments } = useCommitments();

  const [kind, setKind] = useState<LoanKind>('home');
  const [rateText, setRateText] = useState(String(LOAN_DEFAULTS.home.ratePct));
  const [yearsText, setYearsText] = useState(String(LOAN_DEFAULTS.home.maxYears));
  const [netText, setNetText] = useState(() => {
    const net = estimateNetMonthly(profile);
    return net > 0 ? senToInput(net) : '';
  });
  const [commitText, setCommitText] = useState(() => {
    const total = monthlyCommitmentTotal(commitments);
    return total > 0 ? senToInput(total) : '';
  });
  const [requestedText, setRequestedText] = useState('');

  const defaults = LOAN_DEFAULTS[kind];
  function chooseKind(next: LoanKind) {
    setKind(next);
    setRateText(String(LOAN_DEFAULTS[next].ratePct));
    setYearsText(String(LOAN_DEFAULTS[next].maxYears));
  }

  const rate = parseRatePct(rateText);
  const years = parseYears(yearsText, defaults.maxYears);
  const net = parseRM(netText) ?? 0;
  const commitmentsTotal = parseRM(commitText) ?? 0;
  const requested = parseRM(requestedText);
  const termOk = rate !== null && years !== null;

  const result =
    termOk && net > 0
      ? assessLoan({
          netMonthly: net,
          commitments: commitmentsTotal,
          kind,
          ratePct: rate,
          months: years * 12,
          method: defaults.method,
          requestedPrincipal: requested !== null && requested > 0 ? requested : undefined,
        })
      : null;
  const requestedInstalment =
    termOk && requested !== null && requested > 0
      ? monthlyInstalment(requested, rate, years * 12, defaults.method)
      : null;
  const verdict: Verdict | undefined = result?.verdict;
  const pill = verdict ? statusStyle(VERDICT_STATUS[verdict], scheme) : null;

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
    <Screen>
      <BackButton />
      <AppText variant="title">{t('loan.title')}</AppText>

      <Card style={{ gap: 12 }}>
        {net <= 0 ? (
          <AppText variant="body" tone="muted">
            {t('loan.needSalary')}
          </AppText>
        ) : !termOk ? (
          <AppText variant="body" tone="muted">
            {rate === null ? t('loan.rateError') : t('loan.yearsError', { max: defaults.maxYears })}
          </AppText>
        ) : result ? (
          <>
            <View style={{ gap: 4 }}>
              <AppText variant="small" tone="muted">
                {t('loan.range')}
              </AppText>
              <AppText testID="range" variant="section">
                {`${formatRM(result.comfortablePrincipal)} to ${formatRM(result.maxPrincipal)}`}
              </AppText>
            </View>
            <AppText variant="bodyStrong" tone="muted">
              {t('loan.maxInstalment', { amount: formatRM(result.maxInstalment) })}
            </AppText>
            {verdict && pill ? (
              <View style={{ gap: 8 }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: pill.bg, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <AppText testID="verdict" variant="bodyStrong" color={pill.ink}>
                    {t(`loan.verdict.${verdict}`)}
                  </AppText>
                </View>
                {requestedInstalment !== null ? (
                  <AppText variant="bodyStrong">{t('loan.instalment', { amount: formatRM(requestedInstalment) })}</AppText>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {KINDS.map((k) => (
          <Chip key={k} label={t(`loan.kind.${k}`)} selected={kind === k} onPress={() => chooseKind(k)} />
        ))}
      </View>

      <AmountInput label={t('loan.salary')} value={netText} onChange={(text) => setNetText(text)} />
      <AmountInput label={t('loan.commitments')} value={commitText} onChange={(text) => setCommitText(text)} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <AppText variant="smallStrong">{t('loan.rate')}</AppText>
          <TextInput
            accessibilityLabel={t('loan.rate')}
            value={rateText}
            onChangeText={(text) => setRateText(sanitizeNumber(text, 2))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[field, rate === null && { borderColor: c.negative }]}
          />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <AppText variant="smallStrong">{t('loan.years')}</AppText>
          <TextInput
            accessibilityLabel={t('loan.years')}
            value={yearsText}
            onChangeText={(text) => setYearsText(sanitizeNumber(text, 0))}
            keyboardType="number-pad"
            maxLength={3}
            style={[field, years === null && { borderColor: c.negative }]}
          />
        </View>
      </View>
      <AmountInput label={t('loan.requested')} value={requestedText} onChange={(text) => setRequestedText(text)} />

      <AppText variant="small" tone="muted">
        {t('common.estimate')}
      </AppText>
    </Screen>
  );
}
