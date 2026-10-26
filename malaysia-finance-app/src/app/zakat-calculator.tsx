import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/features/wealth/TextField';
import { calculateIncomeZakat, calculateZakat, DEFAULT_INCOME_NISAB, NISAB_GOLD_GRAMS } from '@/domain/giving';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { useProfile } from '@/hooks/useProfile';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';

type Field = 'savings' | 'goldPrice' | 'income' | 'epf' | 'needs' | 'nisab';
type Mode = 'income' | 'wealth';

function Row({ label, value, testID, strong }: { label: string; value: string; testID?: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'text' : 'muted'} style={{ flex: 1 }}>{label}</AppText>
      <AppText testID={testID} variant="bodyStrong">{value}</AppText>
    </View>
  );
}

export default function ZakatCalculator() {
  const { data: profile } = useProfile();
  const [mode, setMode] = useState<Mode>('income');
  const yearlyGross = profile.grossMonthly * 12;
  const [text, setText] = useState<Record<Field, string>>(() => ({
    savings: '',
    goldPrice: '',
    income: yearlyGross > 0 ? senToInput(yearlyGross) : '',
    epf: yearlyGross > 0 ? senToInput(Math.round(yearlyGross * profile.epfRate)) : '',
    needs: '',
    nisab: senToInput(DEFAULT_INCOME_NISAB),
  }));
  const [grams, setGrams] = useState('');
  const set = (f: Field) => (next: string) => setText((prev) => ({ ...prev, [f]: next }));
  const amount = (f: Field) => parseRM(text[f]) ?? 0;
  const gramsN = /^\d+(\.\d{1,3})?$/.test(grams.trim()) ? Number(grams) : 0;

  const incomeResult = calculateIncomeZakat({
    annualIncome: amount('income'),
    annualEpf: amount('epf'),
    annualNeeds: amount('needs'),
    nisab: amount('nisab'),
  });
  const wealthResult = calculateZakat({
    savings: amount('savings'),
    goldGrams: gramsN,
    goldPricePerGram: amount('goldPrice'),
    annualIncome: 0,
    annualNeeds: 0,
  });
  const total = mode === 'income' ? incomeResult.total : wealthResult.total;

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('zakatCalc.title')}</AppText>
        <AppText variant="small" tone="muted">{t(mode === 'income' ? 'zakatCalc.introIncome' : 'zakatCalc.introWealth')}</AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label={t('zakatCalc.modeIncome')} selected={mode === 'income'} onPress={() => setMode('income')} />
        <Chip label={t('zakatCalc.modeWealth')} selected={mode === 'wealth'} onPress={() => setMode('wealth')} />
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="small" tone="muted">{t('zakatCalc.total')}</AppText>
          <AppText testID="zakat-total" variant="kpi">{formatRM(total)}</AppText>
        </View>
        {mode === 'income' ? (
          <>
            <Row label={t('zakatCalc.base')} value={formatRM(incomeResult.base)} testID="zakat-base" />
            <Row label={t('zakatCalc.nisabIncome')} value={formatRM(amount('nisab'))} testID="zakat-nisab" />
            {!incomeResult.reachesNisab ? (
              <AppText variant="small" tone="muted">{t('zakatCalc.belowNisab')}</AppText>
            ) : (
              <AppText variant="small" tone="muted">{t('zakatCalc.rebate')}</AppText>
            )}
          </>
        ) : (
          <>
            {wealthResult.hasNisab ? (
              <Row label={t('zakatCalc.nisab', { grams: NISAB_GOLD_GRAMS })} value={formatRM(wealthResult.nisab)} testID="zakat-nisab" />
            ) : (
              <AppText variant="small" tone="muted">{t('zakatCalc.needPrice')}</AppText>
            )}
            <Row label={t('zakatCalc.onSavings')} value={formatRM(wealthResult.savings)} testID="zakat-savings" />
            <Row label={t('zakatCalc.onGold')} value={formatRM(wealthResult.gold)} testID="zakat-gold" />
          </>
        )}
        <Button
          title={t('zakatCalc.record')}
          disabled={total <= 0}
          onPress={() => router.push({ pathname: '/zakat', params: { amount: senToInput(total) } })}
        />
      </Card>

      {mode === 'income' ? (
        <>
          <AmountInput label={t('zakatCalc.income')} value={text.income} onChange={set('income')} compact />
          <AmountInput label={t('zakatCalc.epf')} value={text.epf} onChange={set('epf')} compact />
          <AmountInput label={t('zakatCalc.needs')} value={text.needs} onChange={set('needs')} compact />
          <AmountInput label={t('zakatCalc.nisabInput')} value={text.nisab} onChange={set('nisab')} compact />
          <AppText variant="small" tone="muted">{t('zakatCalc.nisabHint')}</AppText>
        </>
      ) : (
        <>
          <AmountInput label={t('zakatCalc.goldPrice')} value={text.goldPrice} onChange={set('goldPrice')} compact />
          <AmountInput label={t('zakatCalc.savings')} value={text.savings} onChange={set('savings')} compact />
          <TextField label={t('zakatCalc.goldGrams')} value={grams} onChange={setGrams} numeric maxLength={9} />
        </>
      )}

      <AppText variant="small" tone="muted">{t('zakatCalc.disclaimer')}</AppText>
    </Screen>
  );
}
