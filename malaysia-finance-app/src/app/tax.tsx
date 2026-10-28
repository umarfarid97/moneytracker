import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { formatRM } from '@/domain/money';
import { capReliefClaims, groupReliefs } from '@/domain/reliefs';
import { useAllReliefClaims } from '@/hooks/useAllReliefClaims';
import { useTaxYear } from '@/hooks/useTaxYear';
import { reliefLabel } from '@/i18n/content';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function Tax() {
  const { c, scheme } = useTheme();
  const { year, setYear, options, data, notice } = useTaxYear();
  const { data: claims } = useAllReliefClaims(year);
  const summary = useMemo(() => capReliefClaims(claims, data.reliefs), [claims, data]);
  const automatic = data.automaticReliefs.reduce((sum, r) => sum + r.amount, 0);
  const sections = useMemo(() => groupReliefs(data.reliefs), [data]);
  const warn = statusStyle('tight', scheme);

  return (
    <Screen>
      <BackButton />
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
      <HeroCard hero="sunset" style={{ gap: 6 }}>
        <AppText variant="eyebrow" color={onHero.soft}>
          {t('tax.totalRelief')}
        </AppText>
        <AppText testID="total-relief" variant="kpi" color={onHero.ink} style={{ fontSize: 40, lineHeight: 48 }}>
          {formatRM(automatic + summary.total)}
        </AppText>
        {data.automaticReliefs.map((r) => (
          <AppText key={r.id} variant="small" color={onHero.soft}>
            {reliefLabel(r)} · {t('tax.automatic')} · {formatRM(r.amount)}
          </AppText>
        ))}
      </HeroCard>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('taxCalc.title')} onPress={() => router.push('/tax-calculator')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('pack.title')} variant="secondary" onPress={() => router.push('/tax-pack')} />
        </View>
      </View>

      {sections.map((section) => (
        <View key={section.key} style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t(`tax.section.${section.key}`)}</AppText>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {section.reliefs.map((def, index) => {
              const entry = summary.perRelief[def.id];
              const surplus = entry ? entry.claimed - entry.allowed : 0;
              const missing = summary.missingReceipts.includes(def.id);
              return (
                <Pressable
                  key={def.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/relief/[id]', params: { id: def.id } })}
                  style={{ padding: 14, gap: 6, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.control }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText variant="bodyStrong" style={{ flex: 1 }}>{reliefLabel(def)}</AppText>
                    {entry ? null : <AppText variant="small" tone="muted">{formatRM(def.limit)}</AppText>}
                    <Ionicons name="chevron-forward" size={18} color={c.accent} />
                  </View>
                  {entry ? (
                    <>
                      <AppText variant="small" tone="muted">
                        {t('tax.claimedOf', { claimed: formatRM(entry.allowed), limit: formatRM(def.limit) })}
                      </AppText>
                      <ProgressBar fraction={def.perItem ? 1 : entry.allowed / def.limit} />
                    </>
                  ) : null}
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
          </Card>
        </View>
      ))}
    </Screen>
  );
}
