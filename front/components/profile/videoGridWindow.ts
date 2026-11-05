/** Which grid rows should be mounted for the current scroll position. */
export function visibleRowRange(
  pageY: number,
  viewportHeight: number,
  rowStride: number,
  rowCount: number,
): { first: number; last: number } {
  if (rowCount <= 0 || rowStride <= 0) return { first: 0, last: 0 };
  const totalHeight = rowCount * rowStride;
  if (pageY >= viewportHeight || pageY + totalHeight <= 0) return { first: 0, last: 0 };
  const hiddenAbove = Math.max(0, -pageY);
  const first = Math.max(0, Math.floor(hiddenAbove / rowStride) - 1);
  const lastLocal = Math.min(totalHeight, viewportHeight - pageY);
  const last = Math.min(rowCount, Math.ceil(Math.max(0, lastLocal) / rowStride) + 1);
  return { first, last: Math.max(last, first) };
}
