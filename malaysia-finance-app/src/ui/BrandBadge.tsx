import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BRAND_MARKS } from './brandMarks';
import { fontFamily } from './theme';

type Props = {
  /** Brand id. When a real mark is bundled for it (see brandMarks.ts) the mark is drawn instead of the initials. */
  id?: string;
  initials: string;
  color: string;
  ink: string;
  size?: number;
  testID?: string;
};

/**
 * A brand-coloured circle for billers, subscriptions and pay later providers. Brands with a bundled
 * mark show it in the badge's ink colour; every other brand shows its initials.
 */
export function BrandBadge({ id, initials, color, ink, size = 42, testID }: Props) {
  const mark = id ? BRAND_MARKS[id] : undefined;
  // Longer initials get smaller type so "TNB" and "AIA" still fit the circle.
  const scale = initials.length >= 4 ? 0.28 : initials.length === 3 ? 0.32 : initials.length === 2 ? 0.38 : 0.45;
  const glyph = Math.round(size * 0.56);
  return (
    <View
      testID={testID}
      // Decorative: the name next to it already says who it is.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
    >
      {mark ? (
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <Path d={mark} fill={ink} />
        </Svg>
      ) : (
        <Text allowFontScaling={false} style={{ color: ink, fontFamily: fontFamily.bold, fontSize: Math.round(size * scale), letterSpacing: -0.3 }}>
          {initials}
        </Text>
      )}
    </View>
  );
}
