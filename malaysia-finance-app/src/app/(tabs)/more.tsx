import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Path = '/wealth' | '/tax' | '/profile' | '/budget' | '/tax-calculator' | '/loan-calculator' | '/reports' | '/net-worth' | '/import-statement' | '/owed' | '/income' | '/settings';

const ITEMS: { label: StringKey; path: Path; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'more.profile', path: '/profile', icon: 'person', color: '#4f46e5' },
  { label: 'more.budget', path: '/budget', icon: 'pie-chart', color: '#16a34a' },
  { label: 'more.reports', path: '/reports', icon: 'bar-chart', color: '#0d5bd3' },
  { label: 'more.netWorth', path: '/net-worth', icon: 'wallet', color: '#16a34a' },
  { label: 'more.wealth', path: '/wealth', icon: 'trending-up', color: '#0d5bd3' },
  { label: 'more.owed', path: '/owed', icon: 'people', color: '#0d5bd3' },
  { label: 'more.income', path: '/income', icon: 'cash', color: '#16a34a' },
  { label: 'tax.title', path: '/tax', icon: 'document-text', color: '#0d5bd3' },
  { label: 'more.taxCalc', path: '/tax-calculator', icon: 'calculator', color: '#db2777' },
  { label: 'more.loan', path: '/loan-calculator', icon: 'home', color: '#7c3aed' },
  { label: 'more.import', path: '/import-statement', icon: 'document-text', color: '#0d5bd3' },
  { label: 'more.settings', path: '/settings', icon: 'settings', color: '#64748b' },
];

export default function More() {
  const { c } = useTheme();
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
    </Screen>
  );
}
