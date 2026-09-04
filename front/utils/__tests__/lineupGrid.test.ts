import {
  buildFormationColumns,
  deriveFormationFromPositions,
  hasGridLayoutData,
  normalizePos,
  resolveFormationLabel,
  sortPlayersForPitch,
} from '../lineupGrid';

type P = { name: string; pos?: string | null; grid?: string | null; fieldLine?: number | null; fieldSide?: number | null };

/** Ingolstadt - Aachen as cached before the fix: `grid: "1:N"` for all, no formation. */
const nameOnlyXI: P[] = [
  { name: 'CM1', pos: 'M', grid: '1:1' },
  { name: 'CM2', pos: 'M', grid: '1:2' },
  { name: 'CB1', pos: 'D', grid: '1:5' },
  { name: 'CF', pos: 'F', grid: '1:6' },
  { name: 'LF', pos: 'F', grid: '1:7' },
  { name: 'AM', pos: 'M', grid: '1:9' },
  { name: 'DM1', pos: 'M', grid: '1:11' },
  { name: 'CB2', pos: 'D', grid: '1:12' },
  { name: 'DM2', pos: 'M', grid: '1:13' },
  { name: 'CB3', pos: 'D', grid: '1:14' },
  { name: 'GK', pos: 'G', grid: '1:16' },
];

const griddedXI: P[] = [
  { name: 'GK', pos: 'G', grid: '1:1' },
  { name: 'RB', pos: 'D', grid: '2:1' },
  { name: 'CB', pos: 'D', grid: '2:2' },
  { name: 'CB2', pos: 'D', grid: '2:3' },
  { name: 'LB', pos: 'D', grid: '2:4' },
  { name: 'DM', pos: 'M', grid: '3:1' },
  { name: 'DM2', pos: 'M', grid: '3:2' },
  { name: 'RW', pos: 'M', grid: '4:1' },
  { name: 'AM', pos: 'M', grid: '4:2' },
  { name: 'LW', pos: 'M', grid: '4:3' },
  { name: 'ST', pos: 'F', grid: '5:1' },
];

describe('hasGridLayoutData', () => {
  it('rejects a grid that puts every starter on the same line', () => {
    expect(hasGridLayoutData(nameOnlyXI)).toBe(false);
  });

  it('accepts a real multi-line grid', () => {
    expect(hasGridLayoutData(griddedXI)).toBe(true);
  });

  it('accepts absolute coordinates only when they span several depths', () => {
    const flat = [
      { fieldLine: 50, fieldSide: 20 },
      { fieldLine: 50, fieldSide: 80 },
    ];
    const spread = [
      { fieldLine: 10, fieldSide: 50 },
      { fieldLine: 60, fieldSide: 50 },
    ];
    expect(hasGridLayoutData(flat)).toBe(false);
    expect(hasGridLayoutData(spread)).toBe(true);
  });
});

describe('formation derivation', () => {
  it('derives 3-5-2 from positions when the provider sent nothing', () => {
    expect(deriveFormationFromPositions(nameOnlyXI)).toBe('3-5-2');
    expect(resolveFormationLabel('', nameOnlyXI)).toEqual({ label: '3-5-2', derived: true });
    expect(resolveFormationLabel(null, nameOnlyXI)).toEqual({ label: '3-5-2', derived: true });
  });

  it('keeps a provider formation that accounts for the outfield players', () => {
    expect(resolveFormationLabel('4-2-3-1', griddedXI)).toEqual({ label: '4-2-3-1', derived: false });
  });

  it('never invents a default when nothing is known', () => {
    const anonymous = Array.from({ length: 11 }, (_, i) => ({ name: `P${i}`, pos: null }));
    expect(resolveFormationLabel(null, anonymous)).toEqual({ label: null, derived: false });
  });

  it('accepts a provider formation before the XI has loaded', () => {
    expect(resolveFormationLabel('4-3-3', [])).toEqual({ label: '4-3-3', derived: false });
  });

  it('normalizes provider position labels', () => {
    expect(normalizePos('Goalkeeper')).toBe('G');
    expect(normalizePos('DEF')).toBe('D');
    expect(normalizePos('Midfielder')).toBe('M');
    expect(normalizePos('Attacker')).toBe('F');
    expect(normalizePos('Striker')).toBe('F');
    expect(normalizePos('')).toBeNull();
  });
});

describe('buildFormationColumns', () => {
  it('lays a name-only XI out as GK / 3 / 5 / 2 in pitch order', () => {
    const columns = buildFormationColumns(nameOnlyXI, '');
    expect(columns.map((col) => col.length)).toEqual([1, 3, 5, 2]);
    expect(columns[0][0].name).toBe('GK');
    expect(columns[1].every((p) => p.pos === 'D')).toBe(true);
    expect(columns[2].every((p) => p.pos === 'M')).toBe(true);
    expect(columns[3].every((p) => p.pos === 'F')).toBe(true);
  });

  it('fills a provider formation in goalkeeper → attack order', () => {
    const shuffled = [...griddedXI].reverse().map((p) => ({ ...p, grid: null }));
    const columns = buildFormationColumns(shuffled, '4-2-3-1');
    expect(columns.map((col) => col.length)).toEqual([1, 4, 2, 3, 1]);
    expect(columns[0][0].pos).toBe('G');
    expect(columns[4][0].pos).toBe('F');
  });

  it('orders by grid line when a real grid exists', () => {
    const ordered = sortPlayersForPitch([...griddedXI].reverse());
    expect(ordered[0].name).toBe('GK');
    expect(ordered[ordered.length - 1].name).toBe('ST');
  });
});
