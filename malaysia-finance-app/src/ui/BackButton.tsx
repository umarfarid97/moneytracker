import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PressableScale } from './PressableScale';
import { t } from '@/i18n/t';
import { useTheme } from './useTheme';

/** Chevron at the top of a pushed screen that returns to the previous one. */
export function BackButton() {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={12}
      onPress={() => router.back()}
      style={{ alignSelf: 'flex-start', marginLeft: -4 }}
    >
      <Ionicons name="chevron-back" size={28} color={c.text} />
    </PressableScale>
  );
}
