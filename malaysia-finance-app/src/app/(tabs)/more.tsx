import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage } from '@/i18n/language';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { APPEARANCES, setAppearance, useAppearance } from '@/ui/appearance';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Path = '/wealth' | '/backup' | '/tax' | '/profile' | '/budget' | '/categories' | '/payment-methods' | '/tax-calculator' | '/loan-calculator' | '/reports' | '/net-worth';

const ITEMS: { label: StringKey; path: Path; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'more.profile', path: '/profile', icon: 'person', color: '#4f46e5' },
  { label: 'more.budget', path: '/budget', icon: 'pie-chart', color: '#16a34a' },
  { label: 'more.reports', path: '/reports', icon: 'bar-chart', color: '#0d5bd3' },
  { label: 'more.netWorth', path: '/net-worth', icon: 'wallet', color: '#16a34a' },
  { label: 'more.categories', path: '/categories', icon: 'pricetags', color: '#ea580c' },
  { label: 'more.methods', path: '/payment-methods', icon: 'card', color: '#0284c7' },
  { label: 'more.wealth', path: '/wealth', icon: 'trending-up', color: '#0d5bd3' },
  { label: 'tax.title', path: '/tax', icon: 'document-text', color: '#0d5bd3' },
  { label: 'more.taxCalc', path: '/tax-calculator', icon: 'calculator', color: '#db2777' },
  { label: 'more.loan', path: '/loan-calculator', icon: 'home', color: '#7c3aed' },
  { label: 'more.backup', path: '/backup', icon: 'cloud-upload', color: '#0d5bd3' },
];

export default function More() {
  const { c } = useTheme();
  const appearance = useAppearance();
  const language = useLanguage();
  return (
    <Screen fab>
      <AppText variant="title">{t('tab.more')}</AppText>
      {/* One grouped list, like iOS Settings: coloured icons with hairlines between rows. */}
      <Card style={{ padding: 0, paddingHorizontal: 14 }}>
        {ITEMS.map((item, i) => (
          <Pressable
            key={item.path}
            accessibilityRole="button"
            onPress={() => router.push(item.path)}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: c.border,
            }}
          >
            <IconBadge icon={item.icon} color={item.color} size={34} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {t(item.label)}
            </AppText>
            <Ionicons name="chevron-forward" size={20} color={c.accent} />
          </Pressable>
        ))}
      </Card>
      <View style={{ gap: 8 }}>
        <AppText variant="section">{t('more.appearance')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {APPEARANCES.map((a) => (
            <Chip key={a} label={t(`more.appearance.${a}`)} selected={appearance === a} onPress={() => setAppearance(a)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="section">{t('more.language')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LANGUAGES.map((l) => (
            <Chip key={l} label={LANGUAGE_NAMES[l]} selected={language === l} onPress={() => setLanguage(l)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
