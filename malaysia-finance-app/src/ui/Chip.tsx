import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = { label: string; selected?: boolean; onPress?: () => void; accessibilityLabel?: string };

export function Chip({ label, selected = false, onPress, accessibilityLabel }: Props) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.95}
      style={{
        minHeight: 36,
        paddingVertical: 8,
        paddingHorizontal: 14,
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
