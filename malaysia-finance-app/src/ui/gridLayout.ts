export type GridLayout = {
  columns: number;
  /** Width of every cell in px, floored so a full row never overflows the container. */
  cellWidth: number;
};

/**
 * Equal-width columns for a grid inside a container `width` px wide. The column count is fixed when `columns` is
 * given, otherwise as many as fit at `minCellWidth` (at most `maxColumns`). Always at least one column.
 */
export function gridLayout(
  width: number,
  opts: { gap: number; minCellWidth?: number; maxColumns?: number; columns?: number },
): GridLayout {
  const { gap } = opts;
  const fit = Math.floor((width + gap) / ((opts.minCellWidth ?? 150) + gap));
  const columns = Math.max(1, opts.columns ?? Math.min(opts.maxColumns ?? 4, fit));
  const cellWidth = Math.max(0, Math.floor((width - gap * (columns - 1)) / columns));
  return { columns, cellWidth };
}
