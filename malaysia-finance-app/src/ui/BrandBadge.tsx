import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BRAND_LOGOS } from './brandLogos';
import { BRAND_MARKS } from './brandMarks';
import { fontFamily } from './theme';

type Props = {
  /** Brand id. A logo file in assets/brands/ wins, then a bundled mark (see brandMarks.ts), then the initials. */
  id?: string;
  initials: string;
  color: string;
  ink: string;
  /** Ionicons name for what the brand is (bolt, water, wifi, car...). Drawn as a small corner chip on larger badges. */
  icon?: string;
  size?: number;
  testID?: string;
};

/**
 * A brand-coloured circle for billers, loans, subscriptions and pay later providers. A real logo file or
 * bundled mark is shown when there is one; otherwise the initials, with a line icon for the kind of bill.
 */
export function BrandBadge({ id, initials, color, ink, icon, size = 42, testID }: Props) {
  const logo = id ? BRAND_LOGOS[id] : undefined;
  const mark = id ? BRAND_MARKS[id] : undefined;
  // Longer initials get smaller type so "TNB" and "PTPTN" still fit the circle.
  const scale = initials.length >= 5 ? 0.24 : initials.length === 4 ? 0.28 : initials.length === 3 ? 0.32 : initials.length === 2 ? 0.38 : 0.45;
  const glyph = Math.round(size * 0.56);
  const glyphs = Ionicons.glyphMap ?? {};
  const iconName = icon && (`${icon}-outline` in glyphs ? `${icon}-outline` : icon in glyphs ? icon : undefined);
  // Too small for a corner chip to read (the pickers): the monogram alone carries it.
  const chip = !logo && !mark && iconName && size >= 30 ? Math.round(size * 0.44) : 0;
  return (
    <View
      testID={testID}
      // Decorative: the name next to it already says who it is.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: logo ? '#ffffff' : color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: logo ? 1 : 0, borderColor: '#e2e8f0' }}>
        {logo ? (
          <Image source={logo} resizeMode="contain" style={{ width: size * 0.7, height: size * 0.7 }} />
        ) : mark ? (
          <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
            <Path d={mark} fill={ink} />
          </Svg>
        ) : (
          <Text allowFontScaling={false} style={{ color: ink, fontFamily: fontFamily.bold, fontSize: Math.round(size * scale), letterSpacing: -0.3, marginTop: chip ? -size * 0.06 : 0 }}>
            {initials}
          </Text>
        )}
      </View>
      {chip ? (
        <View style={{ position: 'absolute', right: -chip * 0.15, bottom: -chip * 0.15, width: chip, height: chip, borderRadius: chip / 2, backgroundColor: '#ffffff', borderWidth: 1, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={Math.round(chip * 0.64)} color={color} />
        </View>
      ) : null}
    </View>
  );
}
