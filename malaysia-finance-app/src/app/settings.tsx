import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage } from '@/i18n/language';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { APPEARANCES, setAppearance, setThemeName, useAppearance, useThemeName } from '@/ui/appearance';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { THEME_NAMES } from '@/ui/themeDefs';
import { useTheme } from '@/ui/useTheme';

type Path = '/security' | '/notifications-settings' | '/backup';

const ITEMS: { label: StringKey; path: Path; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'more.security', path: '/security', icon: 'lock-closed', color: '#0d5bd3' },
  { label: 'more.notifications', path: '/notifications-settings', icon: 'notifications', color: '#ea580c' },
  { label: 'more.backup', path: '/backup', icon: 'cloud-upload', color: '#0d5bd3' },
];

/** Appearance, language and the things you set once: app lock, reminders and backup. */
export default function Settings() {
  const { c } = useTheme();
  const appearance = useAppearance();
  const themeName = useThemeName();
  const language = useLanguage();
  const [picking, setPicking] = useState<'appearance' | 'theme' | 'language' | null>(null);

  const options: { key: string; label: string; hint?: string; selected: boolean; pick: () => void }[] =
    picking === 'appearance'
      ? APPEARANCES.map((a) => ({ key: a, label: t(`more.appearance.${a}`), selected: appearance === a, pick: () => setAppearance(a) }))
      : picking === 'theme'
        ? THEME_NAMES.map((n) => ({ key: n, label: t(`more.theme.${n}`), hint: t(`more.theme.${n}.hint`), selected: themeName === n, pick: () => { void setThemeName(n); } }))
        : LANGUAGES.map((l) => ({ key: l, label: LANGUAGE_NAMES[l], selected: language === l, pick: () => setLanguage(l) }));
  const sheetTitle = picking === 'appearance' ? t('more.appearance') : picking === 'theme' ? t('more.theme') : t('more.language');

  const rows: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; value?: string; onPress: () => void }[] = [
    // Dark green is dark only, so the Light / Dark / Match device choice applies to Classic alone.
    ...(themeName === 'green' ? [] : [{ key: 'appearance', label: t('more.appearance'), icon: 'contrast' as const, value: t(`more.appearance.${appearance}`), onPress: () => setPicking('appearance') }]),
    { key: 'theme', label: t('more.theme'), icon: 'color-palette', value: t(`more.theme.${themeName}`), onPress: () => setPicking('theme') },
    { key: 'language', label: t('more.language'), icon: 'language', value: LANGUAGE_NAMES[language], onPress: () => setPicking('language') },
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
      <Sheet visible={picking !== null} title={sheetTitle} onClose={() => setPicking(null)}>
        <View>
          {options.map((o, i) => (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              accessibilityState={{ selected: o.selected }}
              onPress={() => { o.pick(); setPicking(null); }}
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
                {o.hint ? <AppText variant="small" tone="muted">{o.hint}</AppText> : null}
              </View>
              {o.selected ? <Ionicons name="checkmark" size={22} color={c.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
