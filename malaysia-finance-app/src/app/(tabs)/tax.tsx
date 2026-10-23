import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { formatRM } from '@/domain/money';
import { capReliefClaims } from '@/domain/reliefs';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { useTaxYear } from '@/hooks/useTaxYear';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function Tax() {
  const { c, scheme } = useTheme();
  const { year, setYear, options, data, notice } = useTaxYear();
  const { data: claims } = useReliefClaims(year);
  const summary = useMemo(() => capReliefClaims(claims, data.reliefs), [claims, data]);
  const automatic = data.automaticReliefs.reduce((sum, r) => sum + r.amount, 0);
  const warn = statusStyle('tight', scheme);

  return (
    <Screen fab>
      <View style={{ gap: 4 }}>
        <AppText variant="title">{t('tax.title')}</AppText>
        <AppText variant="bodyStrong" tone="muted">
          {t('tax.year', { ya: year })}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {options.map((y) => (
            <Chip key={y} label={String(y)} selected={y === year} onPress={() => setYear(y)} />
          ))}
        </View>
        {notice ? (
          <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
            {notice}
          </AppText>
        ) : null}
      </View>
      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('tax.totalRelief')}
        </AppText>
        <AppText testID="total-relief" variant="kpi">
          {formatRM(automatic + summary.total)}
        </AppText>
      </Card>
      <Button title={t('taxCalc.title')} onPress={() => router.push('/tax-calculator')} />

      <View style={{ gap: 8 }}>
        {data.automaticReliefs.map((r) => (
          <View
            key={r.id}
            style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 4 }}
          >
            <AppText variant="bodyStrong">{r.name}</AppText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="small" tone="muted">
                {t('tax.automatic')}
              </AppText>
              <AppText variant="smallStrong">{formatRM(r.amount)}</AppText>
            </View>
          </View>
        ))}
        {data.reliefs.map((def) => {
          const entry = summary.perRelief[def.id];
          const surplus = entry ? entry.claimed - entry.allowed : 0;
          const missing = summary.missingReceipts.includes(def.id);
          return (
            <Pressable
              key={def.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/relief/[id]', params: { id: def.id } })}
              style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 8 }}
            >
              <AppText variant="bodyStrong">{def.name}</AppText>
              <AppText variant="small" tone="muted">
                {entry
                  ? t('tax.claimedOf', { claimed: formatRM(entry.allowed), limit: formatRM(def.limit) })
                  : t('tax.upTo', { amount: formatRM(def.limit) })}
              </AppText>
              {entry ? <ProgressBar fraction={def.perItem ? 1 : entry.allowed / def.limit} /> : null}
              {surplus > 0 ? (
                <AppText variant="small" tone="negative">
                  {t('tax.notClaimable', { amount: formatRM(surplus) })}
                </AppText>
              ) : null}
              {missing ? (
                <View
                  style={{ alignSelf: 'flex-start', backgroundColor: warn.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <AppText variant="smallStrong" color={warn.ink}>
                    {t('tax.missingReceipt')}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
