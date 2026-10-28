import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage } from '@/i18n/language';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { useTheme } from '@/ui/useTheme';

type Path = '/security' | '/notifications-settings' | '/backup';

const ITEMS: { label: StringKey; path: Path; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'more.security', path: '/security', icon: 'lock-closed', color: '#0d5bd3' },
  { label: 'more.notifications', path: '/notifications-settings', icon: 'notifications', color: '#ea580c' },
  { label: 'more.backup', path: '/backup', icon: 'cloud-upload', color: '#0d5bd3' },
];

/** Language and the things you set once: app lock, reminders and backup. */
export default function Settings() {
  const { c } = useTheme();
  const language = useLanguage();
  const [picking, setPicking] = useState(false);

  const options = LANGUAGES.map((l) => ({ key: l, label: LANGUAGE_NAMES[l], selected: language === l, pick: () => setLanguage(l) }));

  const rows: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; value?: string; onPress: () => void }[] = [
    { key: 'language', label: t('more.language'), icon: 'language', value: LANGUAGE_NAMES[language], onPress: () => setPicking(true) },
    ...ITEMS.map((item) => ({ key: item.path, label: t(item.label), icon: item.icon, onPress: () => router.push(item.path) })),
  ];

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('more.settings')}</AppText>
      <Card style={{ padding: 0, paddingHorizontal: 14 }}>
        {rows.map((row, i) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            onPress={row.onPress}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: c.border,
            }}
          >
            <IconBadge icon={row.icon} size={34} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>{row.label}</AppText>
            {row.value ? <AppText variant="small" tone="muted">{row.value}</AppText> : null}
            <Ionicons name="chevron-forward" size={20} color={c.accent} />
          </Pressable>
        ))}
      </Card>
      <Sheet visible={picking} title={t('more.language')} onClose={() => setPicking(false)}>
        <View>
          {options.map((o, i) => (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              accessibilityState={{ selected: o.selected }}
              onPress={() => { o.pick(); setPicking(false); }}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: c.border,
              }}
            >
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <AppText variant="bodyStrong">{o.label}</AppText>
              </View>
              {o.selected ? <Ionicons name="checkmark" size={22} color={c.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
