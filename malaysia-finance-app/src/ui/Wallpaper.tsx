import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
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
  const kind = THEMES[theme].wallpaper;
  if (kind === 'vignette') {
    // Pastel dark: a violet glow in the top corner and a blue one low on the opposite side, fading into the slate ground.
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={c.wallpaperInk} stopOpacity="0.5" />
            <Stop offset="1" stopColor={c.wallpaperInk} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={c.wallpaperAccent} stopOpacity="0.32" />
            <Stop offset="1" stopColor={c.wallpaperAccent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="-40%" y="-30%" width="180%" height="70%" fill="url(#glowA)" />
        <Rect x="-60%" y="60%" width="160%" height="60%" fill="url(#glowB)" />
      </Svg>
    );
  }
  if (kind === 'rings') {
    // Mint dark: a couple of faint arcs, like the rings behind the reference phones.
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice">
        <Circle cx="95" cy="30" r="62" fill="none" stroke={c.wallpaperInk} strokeOpacity="0.05" strokeWidth="0.5" />
        <Circle cx="95" cy="30" r="88" fill="none" stroke={c.wallpaperInk} strokeOpacity="0.035" strokeWidth="0.5" />
      </Svg>
    );
  }
  if (kind !== 'streaks') return null;
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
