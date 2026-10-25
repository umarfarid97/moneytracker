import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { glow, radius } from './theme';
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
  const { c, scheme } = useTheme();
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
        selected ? { ...glow(tone, scheme), shadowOpacity: scheme === 'dark' ? 0 : 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } } : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 15 : 16} color={selected ? ink : tone} /> : null}
      <AppText variant="smallStrong" color={ink}>
        {label}
      </AppText>
    </PressableScale>
  );
}
