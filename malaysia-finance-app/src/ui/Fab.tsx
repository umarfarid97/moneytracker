import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { t } from '@/i18n/t';
import { PressableScale } from './PressableScale';
import { useTheme } from './useTheme';

/** Round "add spending" button that floats above the content of every tab. */
export function Fab() {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('expense.add')}
      onPress={() => router.push('/add-expense')}
      pressedScale={0.92}
      style={{
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: c.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="add" size={30} color={c.onAccent} />
    </PressableScale>
  );
}
