import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = { icon: keyof typeof Ionicons.glyphMap; color: string; size?: number };

/** iOS Settings-style rounded square: a white icon on a softly graded colour. */
export function IconBadge({ icon, color, size = 40 }: Props) {
  return (
    <LinearGradient
      colors={[`${color}cc`, color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.52)} color="#ffffff" />
    </LinearGradient>
  );
}
