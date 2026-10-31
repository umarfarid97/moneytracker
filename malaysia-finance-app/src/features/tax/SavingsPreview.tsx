import { useState } from 'react';
import { View } from 'react-native';
import type { TaxYearData } from '@/data/tax/types';
import { formatRM, parseRM } from '@/domain/money';
import type { ReliefClaim } from '@/domain/types';
import type { TaxBillInput } from '@/domain/taxBill';
import { previewTaxSaving } from '@/domain/taxPreparation';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { ReliefPicker } from '@/ui/ReliefPicker';

export function SavingsPreview({ input, claims, data, valid }: { input: TaxBillInput; claims: ReliefClaim[]; data: TaxYearData; valid: boolean }) {
  const [reliefId, setReliefId] = useState('lifestyle');
  const [text, setText] = useState('');
  const amount = text.trim() ? parseRM(text) : 0;
  const result = previewTaxSaving(input, claims, reliefId, amount ?? 0, data);
  return <Card style={{ gap: 12 }}>
    <AppText variant="section">{t('prep.preview')}</AppText>
    <AppText variant="small" tone="muted">{t('prep.previewHint')}</AppText>
    <ReliefPicker reliefs={data.reliefs.filter(r => !r.perItem)} value={reliefId} onChange={id => setReliefId(id ?? '')} />
    <AmountInput label={t('prep.expense')} value={text} onChange={setText} />
    <View style={{ gap: 4 }}>
      <AppText tone="muted">{t('prep.eligible')}</AppText>
      <AppText testID="preview-eligible" variant="bodyStrong">{valid && amount !== null ? formatRM(result.eligible) : '—'}</AppText>
      <AppText tone="muted">{t('prep.saving')}</AppText>
      <AppText testID="preview-saving" variant="kpi">{valid && amount !== null ? formatRM(result.saving) : '—'}</AppText>
    </View>
    <AppText variant="small" tone="muted">{t('prep.savingHint')}</AppText>
  </Card>;
}
