import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { GivingSheet } from '@/features/wealth/GivingSheet';
import { ListRow } from '@/features/wealth/ListRow';
import { dayMonth } from '@/domain/dates';
import { isZakat, type GivingRecord } from '@/domain/giving';
import { formatRM } from '@/domain/money';
import { useGiving } from '@/hooks/useGiving';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Screen } from '@/ui/Screen';

export default function Zakat() {
  const year = Number(useToday().slice(0, 4));
  const { data, summary, add, update, remove } = useGiving(year);
  const params = useLocalSearchParams<{ amount?: string }>();
  // Coming from the calculator, the form opens straight away with the amount filled in.
  const [sheet, setSheet] = useState<{ key: number; record: GivingRecord | null; amount?: string } | null>(
    params.amount ? { key: 1, record: null, amount: params.amount } : null,
  );

  async function removeRecord(g: GivingRecord): Promise<boolean> {
    if (!(await confirmDelete(t('giving.deleteTitle'), t('giving.deleteMessage'), t('common.delete'), t('common.cancel')))) return false;
    await remove(g.id);
    return true;
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('giving.title')}</AppText>
      <HeroCard style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={onHero.soft}>{t('giving.given', { year })}</AppText>
          <AppText testID="giving-total" variant="kpi" color={onHero.ink}>{formatRM(summary.total)}</AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="small" tone="muted">{t('giving.zakatTotal')}</AppText>
            <AppText testID="giving-zakat" variant="bodyStrong">{formatRM(summary.zakat)}</AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="small" tone="muted">{t('giving.sedekahTotal')}</AppText>
            <AppText testID="giving-sedekah" variant="bodyStrong">{formatRM(summary.sedekah)}</AppText>
          </View>
        </View>
      </HeroCard>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('giving.add')} onPress={() => setSheet({ key: Date.now(), record: null })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('zakatCalc.open')} variant="secondary" onPress={() => router.push('/zakat-calculator')} />
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <AppText variant="bodyStrong">{t('giving.taxTitle')}</AppText>
        <AppText variant="small" tone="muted">
          {t('giving.taxZakat', { amount: formatRM(summary.zakatForTax) })}
        </AppText>
        <AppText variant="small" tone="muted">
          {t('giving.taxDonations', { amount: formatRM(summary.donationsForTax) })}
        </AppText>
        <Button title={t('giving.openTax')} variant="secondary" compact onPress={() => router.push('/tax-calculator')} />
      </Card>

      <AppText variant="section">{t('giving.records')}</AppText>
      {data.length === 0 ? (
        <EmptyState icon="heart" text={t('giving.empty')} hint={t('giving.emptyHint')} />
      ) : (
        <Card style={{ padding: 0 }}>
          {data.map((g, i) => {
            const title = g.recipient ? `${t(`giving.kind.${g.kind}`)} · ${g.recipient}` : t(`giving.kind.${g.kind}`);
            return (
              <ListRow
                key={g.id}
                first={i === 0}
                title={title}
                accessibilityLabel={`${title} ${formatRM(g.amount)}`}
                subtitle={[dayMonth(g.date), g.countsForTax ? t(isZakat(g.kind) ? 'giving.rebate' : 'giving.deduction') : '', g.note]
                  .filter(Boolean)
                  .join(' · ')}
                value={formatRM(g.amount)}
                onPress={() => setSheet({ key: Date.now(), record: g })}
              />
            );
          })}
        </Card>
      )}

      {sheet ? (
        <GivingSheet
          key={sheet.key}
          visible
          existing={sheet.record}
          preset={sheet.amount ? { kind: 'zakat', amount: sheet.amount } : undefined}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            if (sheet.record) await update({ ...sheet.record, ...input });
            else await add(input);
          }}
          onDelete={sheet.record ? () => removeRecord(sheet.record!) : undefined}
        />
      ) : null}
    </Screen>
  );
}
