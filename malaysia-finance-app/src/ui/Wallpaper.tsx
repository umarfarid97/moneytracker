import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { THEMES } from './themeDefs';
import { useTheme } from './useTheme';

/** Soft diagonal green light streaks fading from the top of the screen into the near-black ground. */
const STREAKS = [
  { x: '-10%', width: '28%', opacity: 0.34 },
  { x: '18%', width: '14%', opacity: 0.22 },
  { x: '38%', width: '30%', opacity: 0.26 },
  { x: '70%', width: '16%', opacity: 0.16 },
] as const;

/** Wallpaper behind a screen's content (Dark green's light streaks). Classic stays plain. It never receives touches. */
export function Wallpaper() {
  const { c, theme } = useTheme();
  if (THEMES[theme].wallpaper !== 'streaks') return null;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.wallpaperInk} stopOpacity="1" />
          <Stop offset="0.55" stopColor={c.wallpaperInk} stopOpacity="0.35" />
          <Stop offset="1" stopColor={c.wallpaperInk} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {STREAKS.map((s) => (
        <Rect key={s.x} x={s.x} y="-8%" width={s.width} height="46%" fill="url(#fade)" opacity={s.opacity} transform="rotate(18 200 0)" />
      ))}
    </Svg>
  );
}
