import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useTheme } from './useTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Kept for callers; icons are drawn in plain ink, like the rest of the line icons. */
  color?: string;
  size?: number;
};

/** A plain line icon in the text colour, in a square slot of `size`. Filled names are drawn as their outline. */
export function IconBadge({ icon, size = 40 }: Props) {
  const { c } = useTheme();
  const outline = `${String(icon).replace(/-outline$/, '')}-outline`;
  const glyphs = Ionicons.glyphMap ?? {};
  const name = (outline in glyphs ? outline : icon) as keyof typeof Ionicons.glyphMap;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={Math.round(size * 0.62)} color={c.text} />
    </View>
  );
}
