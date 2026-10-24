import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';
import { radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const ITEMS: { label: StringKey; path: '/profile' | '/budget' | '/categories' | '/payment-methods' | '/tax-calculator' | '/loan-calculator' }[] = [
  { label: 'more.profile', path: '/profile' },
  { label: 'more.budget', path: '/budget' },
  { label: 'more.categories', path: '/categories' },
  { label: 'more.methods', path: '/payment-methods' },
  { label: 'more.taxCalc', path: '/tax-calculator' },
  { label: 'more.loan', path: '/loan-calculator' },
];

export default function More() {
  const { c } = useTheme();
  return (
    <Screen fab>
      <AppText variant="title">{t('tab.more')}</AppText>
      <View style={{ gap: 8 }}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.path}
            accessibilityRole="button"
            onPress={() => router.push(item.path)}
            style={{
              backgroundColor: c.surface,
              borderRadius: radius.control,
              paddingHorizontal: 16,
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="bodyStrong">{t(item.label)}</AppText>
            <Ionicons name="chevron-forward" size={20} color={c.muted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
