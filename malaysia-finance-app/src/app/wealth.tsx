import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { formatRM } from '@/domain/money';
import { useGiving } from '@/hooks/useGiving';
import { useRetirement } from '@/hooks/useRetirement';
import { useSavings } from '@/hooks/useSavings';
import { useToday } from '@/hooks/useToday';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { IconBadge } from '@/ui/IconBadge';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Path = '/epf' | '/socso' | '/zakat' | '/savings';

export default function Wealth() {
  const { c } = useTheme();
  const year = Number(useToday().slice(0, 4));
  const { epf, socso } = useRetirement(year);
  const { summary } = useGiving(year);
  const { totals } = useSavings();

  const rows: { path: Path; label: StringKey; hint: StringKey; icon: keyof typeof Ionicons.glyphMap; value: string }[] = [
    { path: '/epf', hint: 'wealth.epf.hint', label: 'epf.title', icon: 'shield-checkmark', value: formatRM(epf.balance) },
    { path: '/socso', hint: 'wealth.socso.hint', label: 'socso.title', icon: 'people', value: formatRM(socso.yearEmployee) },
    { path: '/savings', hint: 'wealth.savings.hint', label: 'savings.title', icon: 'trending-up', value: formatRM(totals.balance) },
    { path: '/zakat', hint: 'wealth.giving.hint', label: 'giving.title', icon: 'heart', value: formatRM(summary.total) },
  ];

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('wealth.title')}</AppText>
      <HeroCard style={{ gap: 4 }}>
        <AppText variant="eyebrow" color={onHero.soft}>{t('wealth.total')}</AppText>
        <AppText testID="wealth-total" variant="kpi" color={onHero.ink}>{formatRM(epf.balance + totals.balance)}</AppText>
        <AppText variant="small" tone="muted">{t('wealth.totalHint')}</AppText>
      </HeroCard>
      <Card style={{ padding: 0, paddingHorizontal: 14 }}>
        {rows.map((row, i) => (
          <PressableScale
            key={row.path}
            accessibilityRole="button"
            accessibilityLabel={t(row.label)}
            onPress={() => router.push(row.path)}
            pressedScale={0.99}
            style={{
              minHeight: 64,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: c.border,
            }}
          >
            <IconBadge icon={row.icon} size={34} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{t(row.label)}</AppText>
              <AppText variant="small" tone="muted">{t(row.hint)}</AppText>
            </View>
            <AppText variant="bodyStrong" color={c.accent}>{row.value}</AppText>
            <Ionicons name="chevron-forward" size={20} color={c.accent} />
          </PressableScale>
        ))}
      </Card>
    </Screen>
  );
}
