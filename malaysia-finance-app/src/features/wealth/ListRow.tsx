import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/ui/AppText';
import { PressableScale } from '@/ui/PressableScale';
import { useTheme } from '@/ui/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  /** The figure on the right, e.g. "RM 120.00". */
  value?: string;
  valueTone?: 'text' | 'positive' | 'negative';
  onPress: () => void;
  first?: boolean;
  accessibilityLabel?: string;
};

/** One line of a grouped list inside a Card (no padding): title and subtitle on the left, a figure and chevron on the right. */
export function ListRow({ title, subtitle, value, valueTone = 'text', onPress, first = false, accessibilityLabel }: Props) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      pressedScale={0.99}
      style={{
        minHeight: 60,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: c.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="bodyStrong" tone={valueTone}>
          {value}
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={c.accent} />
    </PressableScale>
  );
}
