import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { controlHeight, radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled = false }: Props) {
  const { c } = useTheme();
  const primary = variant === 'primary';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: controlHeight,
        borderRadius: radius.control,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? c.accent : c.track,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <AppText variant="bodyStrong" color={primary ? c.onAccent : c.text}>
        {title}
      </AppText>
    </PressableScale>
  );
}
