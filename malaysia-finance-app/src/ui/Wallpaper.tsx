import { StyleSheet } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { THEMES } from './themeDefs';
import { useTheme } from './useTheme';

const RULE = 32;
const GRID = 28;

/**
 * Faint wallpaper behind a screen's content: ruled paper with a margin line (Notepad) or an editor grid
 * (Terminal). Classic and SaaS stay plain. It never receives touches and sits under every card.
 */
export function Wallpaper() {
  const { c, theme } = useTheme();
  const kind = THEMES[theme].wallpaper;
  if (kind === 'none') return null;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        {kind === 'ruled' ? (
          <Pattern id="paper" width={RULE} height={RULE} patternUnits="userSpaceOnUse">
            <Line x1="0" y1={RULE - 0.5} x2={RULE} y2={RULE - 0.5} stroke={c.wallpaperInk} strokeWidth={1} />
          </Pattern>
        ) : (
          <Pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <Line x1="0.5" y1="0" x2="0.5" y2={GRID} stroke={c.wallpaperInk} strokeWidth={1} />
            <Line x1="0" y1="0.5" x2={GRID} y2="0.5" stroke={c.wallpaperInk} strokeWidth={1} />
          </Pattern>
        )}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={kind === 'ruled' ? 'url(#paper)' : 'url(#grid)'} />
      {kind === 'ruled' ? <Line x1={14} y1="0" x2={14} y2="100%" stroke={c.wallpaperAccent} strokeWidth={1.5} /> : null}
    </Svg>
  );
}
