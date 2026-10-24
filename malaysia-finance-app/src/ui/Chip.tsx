import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = { label: string; selected?: boolean; onPress?: () => void; accessibilityLabel?: string; compact?: boolean };

export function Chip({ label, selected = false, onPress, accessibilityLabel, compact = false }: Props) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.95}
      style={{
        minHeight: compact ? 32 : 36,
        paddingVertical: compact ? 5 : 8,
        paddingHorizontal: compact ? 12 : 14,
        borderRadius: radius.control,
        justifyContent: 'center',
        backgroundColor: selected ? c.accentSoft : c.track,
      }}
    >
      <AppText variant="smallStrong" color={selected ? c.accentInk : c.text}>
        {label}
      </AppText>
    </PressableScale>
  );
}
