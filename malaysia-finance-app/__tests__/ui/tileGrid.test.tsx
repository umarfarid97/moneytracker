import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TileGrid } from '@/ui/TileGrid';

const cells = (n: number) => Array.from({ length: n }, (_, i) => <Text key={i}>tile {i}</Text>);

describe('TileGrid', () => {
  test.each([1, 2, 3, 5, 8])('lays out %i tiles in equal cells of two per row', async (n) => {
    const { toJSON } = await render(<TileGrid>{cells(n)}</TileGrid>);
    const root = toJSON() as unknown as { children: { children: { props: { style: any } }[] }[] };
    expect(root.children).toHaveLength(Math.ceil(n / 2));
    for (const row of root.children) {
      // Every row always has two equal flex cells, padded with an empty one, never a width from the window.
      expect(row.children).toHaveLength(2);
      for (const cell of row.children) {
        const style = Object.assign({}, ...[cell.props.style].flat());
        expect(style.flex).toBe(1);
        expect(style.width).toBeUndefined();
      }
    }
    expect(screen.getAllByText(/tile/)).toHaveLength(n);
  });
});
