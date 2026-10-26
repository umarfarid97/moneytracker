import { View } from 'react-native';
import { AppText } from './AppText';
import { fontFamily } from './theme';
import { useTheme } from './useTheme';

export type Bar = { key: string; label: string; value: number };

/** Plain vertical bars scaled to the tallest; `highlight` marks one bar in the accent colour. */
export function BarChart({ bars, highlight, height = 110 }: { bars: Bar[]; highlight?: string; height?: number }) {
  const { c } = useTheme();
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: height + 22 }}>
      {bars.map((b) => (
        <View
          key={b.key}
          accessible
          accessibilityLabel={`${b.label} ${(b.value / 100).toFixed(2)}`}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
        >
          <View
            style={{
              width: '100%', maxWidth: 28, borderRadius: 6,
              height: b.value > 0 ? Math.max(4, (b.value / max) * height) : 2,
              backgroundColor: b.key === highlight ? c.accent : b.value > 0 ? c.track : c.border,
            }}
          />
          <AppText variant="small" tone="muted" style={{ fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14 }}>
            {b.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
