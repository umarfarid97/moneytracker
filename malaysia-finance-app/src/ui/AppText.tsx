import { Text, type TextProps, type TextStyle } from 'react-native';
import { fontFamily, fontSize, type Palette } from './theme';
import { useTheme } from './useTheme';

type Variant = 'title' | 'section' | 'kpi' | 'body' | 'bodyStrong' | 'small' | 'smallStrong' | 'eyebrow';

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontFamily: fontFamily.semibold, fontWeight: '800', fontSize: fontSize.title, lineHeight: 38, letterSpacing: -0.4 },
  section: { fontFamily: fontFamily.semibold, fontWeight: '700', fontSize: fontSize.section, lineHeight: 26, letterSpacing: 0.2 },
  kpi: { fontFamily: fontFamily.semibold, fontWeight: '800', fontSize: fontSize.kpi, lineHeight: 42, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  body: { fontFamily: fontFamily.regular, fontWeight: '400', fontSize: fontSize.body, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.medium, fontWeight: '600', fontSize: fontSize.body, lineHeight: 22, fontVariant: ['tabular-nums'] },
  small: { fontFamily: fontFamily.regular, fontWeight: '400', fontSize: fontSize.small, lineHeight: 20 },
  smallStrong: { fontFamily: fontFamily.medium, fontWeight: '600', fontSize: fontSize.small, lineHeight: 20, fontVariant: ['tabular-nums'] },
  /** Small capitals above a figure or a group, e.g. "SPENT TODAY". */
  eyebrow: { fontFamily: fontFamily.medium, fontWeight: '700', fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: keyof Pick<Palette, 'text' | 'muted' | 'accent' | 'positive' | 'negative' | 'warning'>;
  color?: string;
};

export function AppText({ variant = 'body', tone = 'text', color, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  // Big figures shrink to fit on one line instead of wrapping.
  const fit = variant === 'kpi' ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : null;
  return <Text {...fit} {...rest} style={[VARIANTS[variant], { color: color ?? c[tone] }, style]} />;
}
