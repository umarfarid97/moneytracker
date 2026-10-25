import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  compact?: boolean;
  /** Leading icon, e.g. a category's icon. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Colour of the icon, and of the chip when selected; defaults to the accent. */
  color?: string;
};

export function Chip({ label, selected = false, onPress, accessibilityLabel, compact = false, icon, color }: Props) {
  const { c } = useTheme();
  const tone = color ?? c.accent;
  const ink = selected ? (color ? '#ffffff' : c.onAccent) : c.text;
  return (
    <PressableScale
      accessibilityRole="button"
      // The icon is a glyph in a Text, so name the chip by its label alone.
      accessibilityLabel={accessibilityLabel ?? (icon ? label : undefined)}
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.95}
      style={[
        {
          minHeight: compact ? 34 : 38,
          paddingVertical: compact ? 6 : 8,
          paddingHorizontal: compact ? 12 : 14,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: selected ? tone : c.surface,
          borderWidth: 1,
          borderColor: selected ? tone : c.border,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 15 : 16} color={selected ? ink : c.text} /> : null}
      <AppText variant="smallStrong" color={ink}>
        {label}
      </AppText>
    </PressableScale>
  );
}
