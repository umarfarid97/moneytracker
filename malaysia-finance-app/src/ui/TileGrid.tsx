import { Children, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { gridLayout } from './gridLayout';
import { space } from './theme';

type Props = {
  children: ReactNode;
  /** Fixed number of columns. Without it the grid fits as many cells of at least `minCellWidth` as the width allows. */
  columns?: number;
  minCellWidth?: number;
  maxColumns?: number;
  gap?: number;
};

/**
 * The one grid for tiles. It measures its own width (not the window's, which is wider than the content on
 * tablets and web) and gives every cell the same width, so rows always fill the line, a last odd cell keeps the
 * column width instead of stretching, and cells in a row are as tall as the tallest. Any number of children works.
 */
export function TileGrid({ children, columns, minCellWidth = 150, maxColumns = 4, gap = space.gap }: Props) {
  const window = useWindowDimensions();
  // Until the first layout pass, assume the screen's padded width so the first frame is already close.
  const [width, setWidth] = useState(window.width - space.pad * 2);
  const { cellWidth } = gridLayout(width, { gap, minCellWidth, maxColumns, columns });
  return (
    <View
      testID="tile-grid"
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== width) setWidth(w);
      }}
      style={{ alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {Children.toArray(children).map((child, i) => (
        <View key={i} testID="tile-grid-cell" style={{ width: cellWidth, flexDirection: 'row' }}>
          {child}
        </View>
      ))}
    </View>
  );
}
