import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { CURRENCIES, HOME_CURRENCY } from '@/domain/fx';
import { useProfile } from '@/hooks/useProfile';
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage } from '@/i18n/language';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { APPEARANCES, setAppearance, useAppearance } from '@/ui/appearance';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { IconBadge } from '@/ui/IconBadge';
import { Screen } from '@/ui/Screen';
import { useTheme } from '@/ui/useTheme';

type Path = '/security' | '/notifications-settings' | '/categories' | '/payment-methods' | '/backup';

const ITEMS: { label: StringKey; path: Path; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'more.security', path: '/security', icon: 'lock-closed', color: '#0d5bd3' },
  { label: 'more.notifications', path: '/notifications-settings', icon: 'notifications', color: '#ea580c' },
  { label: 'more.categories', path: '/categories', icon: 'pricetags', color: '#ea580c' },
  { label: 'more.methods', path: '/payment-methods', icon: 'card', color: '#0284c7' },
  { label: 'more.backup', path: '/backup', icon: 'cloud-upload', color: '#0d5bd3' },
];

/** Appearance, language and the things you set once: app lock, reminders, categories, payment methods and backup. */
export default function Settings() {
  const { c } = useTheme();
  const appearance = useAppearance();
  const language = useLanguage();
  const { data: profile, save } = useProfile();
  const pickCurrency = (code: string) => {
    if (code !== profile.defaultCurrency) save({ ...profile, defaultCurrency: code }).catch(() => {});
  };
  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('more.settings')}</AppText>
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
      <View style={{ gap: 8 }}>
        <AppText variant="section">{t('settings.defaultCurrency')}</AppText>
        <AppText variant="small" tone="muted">{t('settings.defaultCurrencyHint')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[HOME_CURRENCY, ...CURRENCIES.map((x) => x.code)].map((code) => (
            <Chip key={code} label={code} selected={profile.defaultCurrency === code} onPress={() => pickCurrency(code)} />
          ))}
        </View>
      </View>
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
            <AppText variant="bodyStrong" style={{ flex: 1 }}>{t(item.label)}</AppText>
            <Ionicons name="chevron-forward" size={20} color={c.accent} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
