import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { capReliefClaims } from '@/domain/reliefs';
import { calculateTaxBill } from '@/domain/taxBill';
import { useProfile } from '@/hooks/useProfile';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { useTaxYear } from '@/hooks/useTaxYear';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Field = 'salary' | 'freelance' | 'business' | 'expenses' | 'pcb' | 'zakat';

function Row({ label, value, testID, strong }: { label: string; value: string; testID?: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'text' : 'muted'} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText testID={testID} variant="bodyStrong">
        {value}
      </AppText>
    </View>
  );
}

export default function TaxCalculator() {
  const { c } = useTheme();
  const { year, data, notice } = useTaxYear();
  const { data: profile } = useProfile();
  const { data: claims } = useReliefClaims(year);

  const [text, setText] = useState<Record<Field, string>>(() => ({
    salary: profile.grossMonthly > 0 ? senToInput(profile.grossMonthly * 12) : '',
    freelance: '',
    business: '',
    expenses: '',
    pcb: '',
    zakat: '',
  }));
  const [spouse, setSpouse] = useState(false);
  const set = (field: Field) => (next: string) => setText((prev) => ({ ...prev, [field]: next }));
  const amount = (field: Field) => parseRM(text[field]) ?? 0;

  const reliefsTotal = useMemo(
    () =>
      data.automaticReliefs.reduce((sum, r) => sum + r.amount, 0) + capReliefClaims(claims, data.reliefs).total,
    [claims, data],
  );
  const bill = calculateTaxBill(
    {
      salary: amount('salary'),
      freelanceGross: amount('freelance'),
      businessGross: amount('business'),
      allowableExpenses: amount('expenses'),
      reliefsTotal,
      pcb: amount('pcb'),
      zakat: amount('zakat'),
      spouseRebate: spouse,
    },
    data,
  );
  const refund = bill.balance < 0;

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('taxCalc.title')}</AppText>
        <AppText variant="bodyStrong" tone="muted">
          {t('tax.year', { ya: year })}
        </AppText>
        {notice ? (
          <AppText variant="small" tone="muted">
            {notice}
          </AppText>
        ) : null}
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="small" tone="muted">
            {t('taxCalc.tax')}
          </AppText>
          <AppText testID="tax-payable" variant="kpi">
            {formatRM(bill.tax)}
          </AppText>
        </View>
        <Row label={t(refund ? 'taxCalc.refund' : 'taxCalc.balance')} value={formatRM(Math.abs(bill.balance))} testID="balance" strong />
      </Card>

      <AmountInput label={t('taxCalc.salary')} value={text.salary} onChange={set('salary')} />
      <AmountInput label={t('taxCalc.freelance')} value={text.freelance} onChange={set('freelance')} />
      <AmountInput label={t('taxCalc.business')} value={text.business} onChange={set('business')} />
      <AmountInput label={t('taxCalc.expenses')} value={text.expenses} onChange={set('expenses')} />
      <AmountInput label={t('taxCalc.pcb')} value={text.pcb} onChange={set('pcb')} />
      <AmountInput label={t('taxCalc.zakat')} value={text.zakat} onChange={set('zakat')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {t('taxCalc.spouse')}
        </AppText>
        <Switch accessibilityLabel={t('taxCalc.spouse')} value={spouse} onValueChange={setSpouse} />
      </View>

      <Card style={{ gap: 8 }}>
        <AppText variant="section">{t('taxCalc.breakdown')}</AppText>
        <Row label={t('tax.title')} value={formatRM(reliefsTotal)} testID="reliefs" />
        <Row label={t('taxCalc.chargeable')} value={formatRM(bill.chargeable)} testID="chargeable" />
        {bill.byBracket
          .filter((b) => b.taxed > 0 && b.ratePct > 0)
          .map((b) => (
            <Row
              key={b.from}
              label={`${b.ratePct}% on ${formatRM(b.taxed)}`}
              value={formatRM(b.tax)}
            />
          ))}
        {bill.rebate > 0 ? <Row label={t('taxCalc.rebate')} value={formatRM(bill.rebate)} testID="rebate" /> : null}
      </Card>

      <AppText variant="small" style={{ color: c.muted }}>
        {t('common.estimate')}
      </AppText>
    </Screen>
  );
}
