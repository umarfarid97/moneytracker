import { createContext, useContext } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { activeTheme, fontFamily, fontSize, type Palette } from './theme';
import { THEMES } from './themeDefs';
import { useTheme } from './useTheme';

type Variant = 'title' | 'section' | 'kpi' | 'body' | 'bodyStrong' | 'small' | 'smallStrong' | 'eyebrow';

// Built per render: fontFamily follows the active theme.
const build = (): Record<Variant, TextStyle> => ({
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, lineHeight: 38, letterSpacing: -0.4 },
  section: { fontFamily: fontFamily.semibold, fontSize: fontSize.section, lineHeight: 26, letterSpacing: 0.2 },
  kpi: { fontFamily: fontFamily.bold, fontSize: fontSize.kpi, lineHeight: 42, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, fontVariant: ['tabular-nums'] },
  small: { fontFamily: fontFamily.regular, fontSize: fontSize.small, lineHeight: 20 },
  smallStrong: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 20, fontVariant: ['tabular-nums'] },
  /** Small capitals above a figure or a group, e.g. "SPENT TODAY". */
  eyebrow: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: activeTheme() !== 'classic' ? 1.6 : 0.8, textTransform: 'uppercase' },
});

let cached: { theme: string; styles: Record<Variant, TextStyle> } | undefined;
function variants(): Record<Variant, TextStyle> {
  const theme = activeTheme();
  if (cached?.theme !== theme) cached = { theme, styles: build() };
  return cached.styles;
}

/** Set by HeroCard on Dark green's sage card: text there uses dark ink instead of the light-on-charcoal tones. */
export const OnHeroContext = createContext(false);

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: keyof Pick<Palette, 'text' | 'muted' | 'accent' | 'positive' | 'negative' | 'warning'>;
  color?: string;
};

export function AppText({ variant = 'body', tone = 'text', color, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  const onHero = useContext(OnHeroContext);
  const ink = onHero ? (tone === 'muted' ? c.heroSoft : c.heroInk) : c[tone];
  // Big figures shrink to fit on one line instead of wrapping.
  const fit = variant === 'kpi' ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : null;
  const merged = { ...StyleSheet.flatten([variants()[variant], { color: color ?? ink }, style]) } as { -readonly [K in keyof TextStyle]: TextStyle[K] };
  // A wider theme font (a monospace face) is scaled down so lines wrap about as often as in Classic.
  const scale = THEMES[activeTheme()].fontScale;
  if (scale !== 1 && merged.fontSize) merged.fontSize = Math.round(merged.fontSize * scale * 10) / 10;
  return <Text {...fit} {...rest} style={merged} />;
}
