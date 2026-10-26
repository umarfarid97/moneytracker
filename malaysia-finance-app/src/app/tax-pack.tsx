import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { dayMonth } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { beSummaryText, buildBeSummary } from '@/domain/beForm';
import { buildReliefPack, reliefPackCsv, type PackItem } from '@/domain/reliefPack';
import { useExpenses } from '@/hooks/useExpenses';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { pickReceipt } from '@/receipts';
import { useTaxYear } from '@/hooks/useTaxYear';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function TaxPack() {
  const { c, scheme } = useTheme();
  const { year, data, notice } = useTaxYear();
  const { data: expenses, update: updateExpense } = useExpenses();
  const { data: manualClaims, update: updateClaim } = useReliefClaims(year);
  const [error, setError] = useState<string | null>(null);
  const pack = useMemo(
    () => buildReliefPack({ year, data, expenses, manualClaims }),
    [year, data, expenses, manualClaims],
  );
  const be = useMemo(() => buildBeSummary(pack), [pack]);
  const warn = statusStyle('tight', scheme);

  async function share() {
    setError(null);
    try {
      await Share.share({ title: t('pack.shareTitle', { year }), message: reliefPackCsv(pack) });
    } catch {
      setError(t('pack.shareFailed'));
    }
  }

  async function shareBe() {
    setError(null);
    try {
      await Share.share({ title: t('be.shareTitle', { year }), message: beSummaryText(be) });
    } catch {
      setError(t('pack.shareFailed'));
    }
  }

  /** Links a receipt photo to a claim that has none, so it counts as ready for filing. */
  async function linkReceipt(item: PackItem) {
    const uri = await pickReceipt('library');
    if (!uri) return;
    if (item.source === 'spending') {
      const e = expenses.find((x) => x.id === item.id);
      if (e) await updateExpense({ ...e, receiptUri: uri });
    } else {
      const c = manualClaims.find((x) => x.id === item.id);
      if (c) await updateClaim({ ...c, receiptUri: uri });
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

      {be.sections.length > 0 ? (
        <Card style={{ gap: 10 }}>
          <AppText variant="bodyStrong">{t('be.title')}</AppText>
          <AppText variant="small" tone="muted">{t('be.intro')}</AppText>
          {be.sections.map((sec) => (
            <View key={sec.id} style={{ gap: 6 }}>
              <AppText variant="eyebrow" tone="muted">{sec.title}</AppText>
              {sec.lines.map((l) => (
                <View key={l.reliefId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <AppText variant="body" style={{ flex: 1 }}>{l.name}</AppText>
                  <AppText variant="bodyStrong">{formatRM(l.enter)}</AppText>
                </View>
              ))}
            </View>
          ))}
          <AppText variant="small" tone="muted">{t('be.keep')}</AppText>
        </Card>
      ) : null}

      <Button title={t('be.share')} onPress={shareBe} />
      <Button title={t('pack.share')} variant="secondary" onPress={share} />
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: warn.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <AppText variant="smallStrong" color={warn.ink}>
                        {t('tax.missingReceipt')}
                      </AppText>
                    </View>
                    <Chip compact icon="attach-outline" label={t('be.addReceipt')} accessibilityLabel={t('be.addReceipt')} onPress={() => void linkReceipt(it)} />
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
