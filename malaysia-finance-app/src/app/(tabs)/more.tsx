import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { DemoBanner } from '@/features/demo/DemoBanner';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Path = '/wealth' | '/tax' | '/profile' | '/budget' | '/loan-calculator' | '/reports' | '/import-statement' | '/owed' | '/settings' | '/demo';
type Item = { label: StringKey; path: Path; icon: keyof typeof Ionicons.glyphMap; color: string };

const SECTIONS: { title: StringKey; items: Item[] }[] = [
  {
    title: 'more.section.money',
    items: [
      { label: 'more.profile', path: '/profile', icon: 'person', color: '#4f46e5' },
      { label: 'more.budget', path: '/budget', icon: 'pie-chart', color: '#16a34a' },
      { label: 'more.reports', path: '/reports', icon: 'bar-chart', color: '#0d5bd3' },
    ],
  },
  {
    title: 'more.section.wealth',
    items: [
      { label: 'more.wealth', path: '/wealth', icon: 'trending-up', color: '#0d5bd3' },
      { label: 'more.owed', path: '/owed', icon: 'people', color: '#0d5bd3' },
    ],
  },
  {
    title: 'more.section.tax',
    items: [
      { label: 'tax.title', path: '/tax', icon: 'document-text', color: '#0d5bd3' },
      { label: 'more.loan', path: '/loan-calculator', icon: 'home', color: '#7c3aed' },
    ],
  },
  {
    title: 'more.section.tools',
    items: [
      { label: 'more.import', path: '/import-statement', icon: 'download', color: '#0d5bd3' },
      { label: 'more.demo', path: '/demo', icon: 'flask', color: '#7c3aed' },
      { label: 'more.settings', path: '/settings', icon: 'settings', color: '#64748b' },
    ],
  },
];

export default function More() {
  const { c } = useTheme();
  return (
    <Screen fab>
      <AppText variant="title">{t('tab.more')}</AppText>
      <DemoBanner />
      {/* Grouped lists, like iOS Settings: coloured icons with hairlines between rows. */}
      {SECTIONS.map((section) => (
        <View key={section.title} style={{ gap: 8 }}>
          <AppText variant="eyebrow" tone="muted">{t(section.title)}</AppText>
          <Card style={{ padding: 0, paddingHorizontal: 14 }}>
            {section.items.map((item, i) => (
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
        </View>
      ))}
    </Screen>
  );
}
