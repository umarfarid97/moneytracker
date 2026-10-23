import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = { label: string; selected?: boolean; onPress?: () => void };

export function Chip({ label, selected = false, onPress }: Props) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.95}
      style={{
        height: 36,
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
