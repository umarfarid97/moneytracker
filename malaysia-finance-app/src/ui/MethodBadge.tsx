import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { brandFor } from '@/domain/banks';
import type { PaymentKind } from '@/domain/types';
import { fontFamily } from './theme';
import { useTheme } from './useTheme';

export const METHOD_ICON: Record<PaymentKind, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  debit: 'card-outline',
  credit: 'card-outline',
  ewallet: 'phone-portrait-outline',
  transfer: 'swap-horizontal',
};

type Props = {
  name: string;
  kind: PaymentKind;
  size?: number;
  /** Colour of the line icon drawn for methods that are not a known bank or e-wallet. */
  color?: string;
};

/**
 * A payment method's mark: a known Malaysian bank or e-wallet is a circle in its brand colour with
 * its initials; anything else (Cash, cards, custom names) is the plain line icon of its kind.
 */
export function MethodBadge({ name, kind, size = 36, color }: Props) {
  const { c } = useTheme();
  const brand = brandFor(name);
  if (!brand) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={METHOD_ICON[kind]} size={Math.round(size * 0.62)} color={color ?? c.text} />
      </View>
    );
  }
  // Longer initials get smaller type so "CIMB" and "HSBC" still fit the circle.
  const scale = brand.initials.length >= 4 ? 0.3 : brand.initials.length === 3 ? 0.34 : 0.42;
  return (
    <View
      testID={`brand-${brand.id}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: brand.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        allowFontScaling={false}
        style={{ color: brand.ink, fontFamily: fontFamily.bold, fontSize: Math.round(size * scale), letterSpacing: -0.3 }}
      >
        {brand.initials}
      </Text>
    </View>
  );
}
