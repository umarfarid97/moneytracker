import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { t } from '@/i18n/t';
import { PressableScale } from './PressableScale';
import { glow } from './theme';
import { useTheme } from './useTheme';

/** Round "add spending" button that floats above the content of every tab. */
export function Fab() {
  const { c, scheme } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('expense.add')}
      onPress={() => router.push('/add-expense')}
      pressedScale={0.92}
      style={[{ position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30 }, glow(c.accent, scheme)]}
    >
      <LinearGradient
        colors={c.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="add" size={32} color={c.onAccent} />
      </LinearGradient>
    </PressableScale>
  );
}
