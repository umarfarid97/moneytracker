import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from './useTheme';

/** Soft diagonal green light streaks fading from the top of the screen into the near-black ground. */
const STREAKS = [
  { x: '-10%', width: '28%', opacity: 0.34, angle: 18 },
  { x: '18%', width: '14%', opacity: 0.22, angle: 18 },
  { x: '38%', width: '30%', opacity: 0.26, angle: 18 },
  { x: '70%', width: '16%', opacity: 0.16, angle: 18 },
] as const;

/** Never receives touches and sits under every card. */
export function Wallpaper() {
  const { c } = useTheme();
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.streak} stopOpacity="1" />
          <Stop offset="0.55" stopColor={c.streak} stopOpacity="0.35" />
          <Stop offset="1" stopColor={c.streak} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {STREAKS.map((s) => (
        <Rect
          key={s.x}
          x={s.x}
          y="-8%"
          width={s.width}
          height="46%"
          fill="url(#fade)"
          opacity={s.opacity}
          transform={`rotate(${s.angle} 200 0)`}
        />
      ))}
    </Svg>
  );
}
