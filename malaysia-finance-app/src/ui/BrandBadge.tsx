import { Text, View } from 'react-native';
import { fontFamily } from './theme';

type Props = {
  initials: string;
  color: string;
  ink: string;
  size?: number;
  testID?: string;
};

/** A brand-coloured circle with initials, used for billers and pay later providers (no logo files are bundled). */
export function BrandBadge({ initials, color, ink, size = 42, testID }: Props) {
  // Longer initials get smaller type so "TNB" and "AIA" still fit the circle.
  const scale = initials.length >= 4 ? 0.28 : initials.length === 3 ? 0.32 : initials.length === 2 ? 0.38 : 0.45;
  return (
    <View
      testID={testID}
      // Decorative: the name next to it already says who it is.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text allowFontScaling={false} style={{ color: ink, fontFamily: fontFamily.bold, fontSize: Math.round(size * scale), letterSpacing: -0.3 }}>
        {initials}
      </Text>
    </View>
  );
}
