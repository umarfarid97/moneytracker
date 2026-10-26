import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { space } from './theme';

type Props = {
  children: ReactNode;
  /** Tiles per row. */
  columns?: number;
};

/**
 * A grid of equal tiles that never depends on a measured width. Tiles go in rows of `columns`; every cell
 * shares its row equally (flex: 1) and stretches to the tallest tile, and a short last row is padded with
 * empty cells so its tiles stay the same size. Adding or removing tiles, a scrollbar or a narrower window
 * cannot knock it out of line, which a width worked out from the window can.
 */
export function TileGrid({ children, columns = 2 }: Props) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View testID="tile-grid" style={{ gap: space.gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', alignItems: 'stretch', gap: space.gap }}>
          {row.map((item, i) => (
            <View key={i} testID="tile-grid-cell" style={{ flex: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row' }}>
              {item}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1, flexBasis: 0 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
