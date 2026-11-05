import { visibleRowRange } from '../videoGridWindow';

describe('visibleRowRange', () => {
  const stride = 160;
  const rows = 20;
  const viewport = 800;

  it('keeps a short window around the rows on screen', () => {
    const range = visibleRowRange(-400, viewport, stride, rows);
    expect(range.first).toBe(1);
    expect(range.last).toBe(9);
    expect(range.last - range.first).toBeLessThan(rows);
  });

  it('mounts nothing when the grid is fully off screen', () => {
    expect(visibleRowRange(900, viewport, stride, rows)).toEqual({ first: 0, last: 0 });
    expect(visibleRowRange(-4000, viewport, stride, rows)).toEqual({ first: 0, last: 0 });
  });
});
