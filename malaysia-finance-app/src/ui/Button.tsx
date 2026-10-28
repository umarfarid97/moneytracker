import { useContext } from 'react';
import { AppText, OnHeroContext } from './AppText';
import { PressableScale } from './PressableScale';
import { controlHeight, radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  onPress: () => void;
  /** primary: solid blue; secondary: soft blue; light: same as primary (kept for hero cards). */
  variant?: 'primary' | 'secondary' | 'light';
  disabled?: boolean;
  /** Overrides the spoken name when the title alone is ambiguous (e.g. several Delete buttons). */
  accessibilityLabel?: string;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled = false, accessibilityLabel, compact = false }: Props) {
  const { c } = useTheme();
  const onHero = useContext(OnHeroContext);
  const primary = variant === 'primary' || variant === 'light';
  // On Dark green's sage summary card a lime button would vanish, so it flips to dark ink with a lime label.
  const ink = onHero ? (primary ? c.accent : c.heroInk) : primary ? c.onAccent : c.accentInk;
  const fill = onHero ? (primary ? c.heroInk : c.heroChip) : primary ? c.accent : c.accentSoft;
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
          backgroundColor: fill,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <AppText variant="bodyStrong" color={ink}>
        {title}
      </AppText>
    </PressableScale>
  );
}
