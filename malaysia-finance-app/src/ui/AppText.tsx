import { Text, type TextProps, type TextStyle } from 'react-native';
import { fontFamily, fontSize, type Palette } from './theme';
import { useTheme } from './useTheme';

type Variant = 'title' | 'section' | 'kpi' | 'body' | 'bodyStrong' | 'small' | 'smallStrong';

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, lineHeight: 34 },
  section: { fontFamily: fontFamily.semibold, fontSize: fontSize.section, lineHeight: 26 },
  kpi: { fontFamily: fontFamily.semibold, fontSize: fontSize.kpi, lineHeight: 38, fontVariant: ['tabular-nums'] },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, fontVariant: ['tabular-nums'] },
  small: { fontFamily: fontFamily.regular, fontSize: fontSize.small, lineHeight: 20 },
  smallStrong: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 20, fontVariant: ['tabular-nums'] },
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: keyof Pick<Palette, 'text' | 'muted' | 'accent' | 'positive' | 'negative' | 'warning'>;
  color?: string;
};

export function AppText({ variant = 'body', tone = 'text', color, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  return <Text {...rest} style={[VARIANTS[variant], { color: color ?? c[tone] }, style]} />;
}
