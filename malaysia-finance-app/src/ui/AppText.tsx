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
  eyebrow: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
});

let cached: { theme: string; styles: Record<Variant, TextStyle> } | undefined;
function variants(): Record<Variant, TextStyle> {
  const theme = activeTheme();
  if (cached?.theme !== theme) cached = { theme, styles: build() };
  return cached.styles;
}

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: keyof Pick<Palette, 'text' | 'muted' | 'accent' | 'positive' | 'negative' | 'warning'>;
  color?: string;
};

export function AppText({ variant = 'body', tone = 'text', color, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  // Big figures shrink to fit on one line instead of wrapping.
  const fit = variant === 'kpi' ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : null;
  const merged = { ...StyleSheet.flatten([variants()[variant], { color: color ?? c[tone] }, style]) } as { -readonly [K in keyof TextStyle]: TextStyle[K] };
  // A wider theme font (Terminal's monospace) is scaled down so lines wrap about as often as in Classic.
  const scale = THEMES[activeTheme()].fontScale;
  if (scale !== 1 && merged.fontSize) merged.fontSize = Math.round(merged.fontSize * scale * 10) / 10;
  return <Text {...fit} {...rest} style={merged} />;
}
