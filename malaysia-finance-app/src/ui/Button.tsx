import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { controlHeight, glow, radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  onPress: () => void;
  /** primary: brand gradient; secondary: tinted; light: white, for use on a hero card. */
  variant?: 'primary' | 'secondary' | 'light';
  disabled?: boolean;
  /** Overrides the spoken name when the title alone is ambiguous (e.g. several Delete buttons). */
  accessibilityLabel?: string;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled = false, accessibilityLabel, compact = false }: Props) {
  const { c, scheme } = useTheme();
  const primary = variant === 'primary';
  const ink = primary ? c.onAccent : c.accentInk;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          height: compact ? 44 : controlHeight,
          borderRadius: radius.control,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? c.accent : variant === 'light' ? '#ffffff' : c.accentSoft,
          opacity: disabled ? 0.45 : 1,
        },
        primary && !disabled ? glow(c.accent, scheme) : null,
      ]}
    >
      {primary ? (
        <LinearGradient
          colors={c.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.control }}
        />
      ) : null}
      <AppText variant="bodyStrong" color={variant === 'light' ? '#3730a3' : ink}>
        {title}
      </AppText>
    </PressableScale>
  );
}
