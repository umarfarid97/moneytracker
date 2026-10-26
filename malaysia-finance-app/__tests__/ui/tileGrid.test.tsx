import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { gridLayout } from '@/ui/gridLayout';
import { TileGrid } from '@/ui/TileGrid';

describe('gridLayout', () => {
  const opts = { gap: 16, minCellWidth: 150, maxColumns: 4 };

  test('two equal columns on a phone, filling the row', () => {
    const { columns, cellWidth } = gridLayout(350, opts);
    expect(columns).toBe(2);
    expect(cellWidth * 2 + 16).toBeLessThanOrEqual(350);
    expect(350 - (cellWidth * 2 + 16)).toBeLessThan(2);
  });

  test('one column when two cells would not fit, never zero', () => {
    expect(gridLayout(280, opts).columns).toBe(1);
    expect(gridLayout(0, opts)).toEqual({ columns: 1, cellWidth: 0 });
  });

  test('more columns on wide screens, capped at maxColumns', () => {
    expect(gridLayout(700, opts).columns).toBe(4);
    expect(gridLayout(2000, opts).columns).toBe(4);
    expect(gridLayout(2000, { ...opts, maxColumns: 3 }).columns).toBe(3);
  });

  test('a fixed column count wins over the width', () => {
    const { columns, cellWidth } = gridLayout(300, { gap: 0, columns: 6 });
    expect(columns).toBe(6);
    expect(cellWidth).toBe(50);
  });

  test('cells never overflow for any width', () => {
    for (let w = 100; w <= 2400; w += 7) {
      const { columns, cellWidth } = gridLayout(w, opts);
      expect(cellWidth * columns + 16 * (columns - 1)).toBeLessThanOrEqual(w);
    }
  });
});

describe('TileGrid', () => {
  const widths = () => screen.getAllByTestId('tile-grid-cell').map((c) => (c.props.style as { width: number }).width);

  test.each([1, 3, 5, 7])('every cell gets the same width with %i children', async (n) => {
    await render(<TileGrid>{Array.from({ length: n }, (_, i) => <Text key={i}>tile {i}</Text>)}</TileGrid>);
    expect(widths()).toHaveLength(n);
    expect(new Set(widths()).size).toBe(1);
  });

  test('sizes cells from the measured container, not the window', async () => {
    await render(<TileGrid><Text>a</Text><Text>b</Text><Text>c</Text></TileGrid>);
    await fireEvent(screen.getByTestId('tile-grid'), 'layout', { nativeEvent: { layout: { width: 344, height: 0 } } });
    expect(widths()).toEqual([164, 164, 164]);
    await fireEvent(screen.getByTestId('tile-grid'), 'layout', { nativeEvent: { layout: { width: 200, height: 0 } } });
    expect(widths()).toEqual([200, 200, 200]);
  });
});
