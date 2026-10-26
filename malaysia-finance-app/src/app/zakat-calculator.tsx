import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/features/wealth/TextField';
import { calculateZakat, NISAB_GOLD_GRAMS } from '@/domain/giving';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { useProfile } from '@/hooks/useProfile';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

type Field = 'savings' | 'goldPrice' | 'income' | 'needs';

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
  const [text, setText] = useState<Record<Field, string>>(() => ({
    savings: '',
    goldPrice: '',
    income: profile.grossMonthly > 0 ? senToInput(profile.grossMonthly * 12) : '',
    needs: '',
  }));
  const [grams, setGrams] = useState('');
  const set = (f: Field) => (next: string) => setText((prev) => ({ ...prev, [f]: next }));
  const amount = (f: Field) => parseRM(text[f]) ?? 0;
  const gramsN = /^\d+(\.\d{1,3})?$/.test(grams.trim()) ? Number(grams) : 0;

  const result = calculateZakat({
    savings: amount('savings'),
    goldGrams: gramsN,
    goldPricePerGram: amount('goldPrice'),
    annualIncome: amount('income'),
    annualNeeds: amount('needs'),
  });

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('zakatCalc.title')}</AppText>
        <AppText variant="small" tone="muted">{t('zakatCalc.intro')}</AppText>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="small" tone="muted">{t('zakatCalc.total')}</AppText>
          <AppText testID="zakat-total" variant="kpi">{formatRM(result.total)}</AppText>
        </View>
        {result.hasNisab ? (
          <Row label={t('zakatCalc.nisab', { grams: NISAB_GOLD_GRAMS })} value={formatRM(result.nisab)} testID="zakat-nisab" />
        ) : (
          <AppText variant="small" tone="muted">{t('zakatCalc.needPrice')}</AppText>
        )}
        <Row label={t('zakatCalc.onSavings')} value={formatRM(result.savings)} testID="zakat-savings" />
        <Row label={t('zakatCalc.onGold')} value={formatRM(result.gold)} testID="zakat-gold" />
        <Row label={t('zakatCalc.onIncome')} value={formatRM(result.income)} testID="zakat-income" />
        <Button
          title={t('zakatCalc.record')}
          disabled={result.total <= 0}
          onPress={() => router.push({ pathname: '/zakat', params: { amount: senToInput(result.total) } })}
        />
      </Card>

      <AmountInput label={t('zakatCalc.goldPrice')} value={text.goldPrice} onChange={set('goldPrice')} compact />
      <AmountInput label={t('zakatCalc.savings')} value={text.savings} onChange={set('savings')} compact />
      <TextField label={t('zakatCalc.goldGrams')} value={grams} onChange={setGrams} numeric maxLength={9} />
      <AmountInput label={t('zakatCalc.income')} value={text.income} onChange={set('income')} compact />
      <AmountInput label={t('zakatCalc.needs')} value={text.needs} onChange={set('needs')} compact />

      <AppText variant="small" tone="muted">{t('zakatCalc.disclaimer')}</AppText>
    </Screen>
  );
}
