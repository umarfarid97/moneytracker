import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useData } from '@/hooks/DataProvider';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Shown while demo data is loaded, so made-up numbers are never mistaken for real ones. Opens the Demo data screen. */
export function DemoBanner() {
  const { demoLoaded } = useData();
  const { c } = useTheme();
  if (!demoLoaded) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('demo.banner')}
      onPress={() => router.push('/demo')}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.card, backgroundColor: c.accentSoft,
      }}
    >
      <Ionicons name="flask" size={20} color={c.accent} />
      <AppText variant="bodyStrong" tone="accent" style={{ flex: 1 }}>
        {t('demo.banner')}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={c.accent} />
    </Pressable>
  );
}
