import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { dayMonth } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { buildReliefPack, reliefPackCsv } from '@/domain/reliefPack';
import { useExpenses } from '@/hooks/useExpenses';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { useTaxYear } from '@/hooks/useTaxYear';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function TaxPack() {
  const { c, scheme } = useTheme();
  const { year, data, notice } = useTaxYear();
  const { data: expenses } = useExpenses();
  const { data: manualClaims } = useReliefClaims(year);
  const [error, setError] = useState<string | null>(null);
  const pack = useMemo(
    () => buildReliefPack({ year, data, expenses, manualClaims }),
    [year, data, expenses, manualClaims],
  );
  const warn = statusStyle('tight', scheme);

  async function share() {
    setError(null);
    try {
      await Share.share({ title: t('pack.shareTitle', { year }), message: reliefPackCsv(pack) });
    } catch {
      setError(t('pack.shareFailed'));
    }
  }

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('pack.title')}</AppText>
        <AppText variant="bodyStrong" tone="muted">
          {t('tax.year', { ya: year })}
        </AppText>
        {notice ? (
          <AppText variant="small" tone="muted">
            {notice}
          </AppText>
        ) : null}
      </View>

      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('tax.totalRelief')}
        </AppText>
        <AppText testID="pack-total" variant="kpi">
          {formatRM(pack.total)}
        </AppText>
        {pack.missingReceipts > 0 ? (
          <AppText variant="small" tone="warning">
            {pack.missingReceipts === 1 ? t('pack.missing1') : t('pack.missing', { count: pack.missingReceipts })}
          </AppText>
        ) : null}
      </Card>

      <Button title={t('pack.share')} onPress={share} />
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}

      {pack.sections.length === 0 ? (
        <AppText variant="body" tone="muted">
          {t('pack.empty')}
        </AppText>
      ) : (
        pack.sections.map((s) => (
          <View key={s.reliefId} style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 10 }}>
            <AppText variant="bodyStrong">{s.name}</AppText>
            <AppText variant="small" tone="muted">
              {t('tax.claimedOf', { claimed: formatRM(s.allowed), limit: formatRM(s.limit) })}
            </AppText>
            {s.claimed > s.allowed ? (
              <AppText variant="small" tone="negative">
                {t('tax.notClaimable', { amount: formatRM(s.claimed - s.allowed) })}
              </AppText>
            ) : null}
            {s.items.map((it, index) => (
              <View key={`${s.reliefId}-${index}`} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {it.note || t('tax.fromSpendingShort')}
                  </AppText>
                  <AppText variant="bodyStrong">
                    {it.amount === it.spent
                      ? formatRM(it.amount)
                      : t('tax.claimableOf', { claimable: formatRM(it.amount), amount: formatRM(it.spent) })}
                  </AppText>
                </View>
                <AppText variant="small" tone="muted">
                  {it.date ? `${dayMonth(it.date)} · ${t(`pack.source.${it.source}`)}` : t(`pack.source.${it.source}`)}
                </AppText>
                {it.receipt === 'missing' ? (
                  <View style={{ alignSelf: 'flex-start', backgroundColor: warn.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <AppText variant="smallStrong" color={warn.ink}>
                      {t('tax.missingReceipt')}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
