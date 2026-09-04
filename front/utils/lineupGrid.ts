interface GridPlayer {
  grid?: string | null;
  fieldLine?: number | null;
  fieldSide?: number | null;
}

interface PositionedPlayer extends GridPlayer {
  pos?: string | null;
}

export type PositionLetter = 'G' | 'D' | 'M' | 'F';

const POS_ORDER: Record<PositionLetter, number> = { G: 0, D: 1, M: 2, F: 3 };

/** Collapse provider labels (G/D/M/F, GK/DEF, "Attacker", "Striker"…) to one letter. */
export function normalizePos(pos?: string | null): PositionLetter | null {
  if (!pos) return null;
  const p = pos.trim().toUpperCase();
  if (!p) return null;
  if (p.startsWith('G')) return 'G';
  if (p.startsWith('D')) return 'D';
  if (p.startsWith('M')) return 'M';
  if (p.startsWith('F') || p.startsWith('A') || p.startsWith('S') || p.startsWith('W')) return 'F';
  return null;
}

export function sortPlayersByGrid<T extends GridPlayer>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    const parse = (g?: string | null) => {
      if (!g) return { line: 99, pos: 99 };
      const [line, pos] = g.split(':').map(Number);
      return { line: line || 99, pos: pos || 99 };
    };
    const ag = parse(a.grid);
    const bg = parse(b.grid);
    if (ag.line !== bg.line) return ag.line - bg.line;
    return ag.pos - bg.pos;
  });
}

export function groupPlayersByGridLine<T extends GridPlayer>(
  players: T[],
): Array<{ line: number; players: T[] }> {
  const sorted = sortPlayersByGrid(players);
  const byLine = new Map<number, T[]>();
  for (const player of sorted) {
    const line = player.grid ? Number(player.grid.split(':')[0]) || 0 : 0;
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line)!.push(player);
  }
  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([line, rowPlayers]) => ({
      line,
      players: rowPlayers.sort((a, b) => {
        const ap = Number(a.grid?.split(':')[1]) || 0;
        const bp = Number(b.grid?.split(':')[1]) || 0;
        return ap - bp;
      }),
    }));
}

/** How many different pitch rows the `grid` strings describe. */
export function distinctGridLines(players: GridPlayer[]): number {
  const lines = new Set<number>();
  for (const p of players) {
    if (p.grid && p.grid.includes(':')) {
      const line = Number(p.grid.split(':')[0]);
      if (Number.isFinite(line)) lines.add(line);
    }
  }
  return lines.size;
}

/** Absolute pitch coordinates are usable only when they spread players over several depths. */
export function hasAbsoluteFieldData(players: GridPlayer[]): boolean {
  const depths = new Set<number>();
  for (const p of players) {
    if (p.fieldLine != null && p.fieldSide != null) depths.add(Number(p.fieldLine));
  }
  return depths.size >= 2;
}

/**
 * Row-based grid data is only trustworthy when the starters actually span
 * several lines. Feeds without field positions still send `grid: "1:N"` for
 * everyone, which would otherwise render the whole XI in a single row.
 */
export function hasGridLayoutData(players: GridPlayer[]): boolean {
  return hasAbsoluteFieldData(players) || distinctGridLines(players) >= 2;
}

/**
 * Pitch order: real grid lines when present, otherwise goalkeeper → defence →
 * midfield → attack so a sequential formation fill lands players on the right row.
 */
export function sortPlayersForPitch<T extends PositionedPlayer>(players: T[]): T[] {
  if (distinctGridLines(players) >= 2) return sortPlayersByGrid(players);
  return [...players].sort(
    (a, b) => POS_ORDER[normalizePos(a.pos) ?? 'M'] - POS_ORDER[normalizePos(b.pos) ?? 'M'],
  );
}

export function parseFormationRows(formation?: string | null): number[] {
  if (!formation) return [];
  return formation
    .split('-')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * `3-5-2` style label from coarse positions. Null unless there is exactly one
 * goalkeeper and every other starter carries a known outfield position.
 */
export function deriveFormationFromPositions(players: Array<{ pos?: string | null }>): string | null {
  if (players.length < 7) return null;
  const counts: Record<PositionLetter, number> = { G: 0, D: 0, M: 0, F: 0 };
  for (const player of players) {
    const pos = normalizePos(player.pos);
    if (!pos) return null;
    counts[pos] += 1;
  }
  if (counts.G !== 1) return null;
  const segments = [counts.D, counts.M, counts.F].filter((n) => n > 0);
  return segments.length >= 2 ? segments.join('-') : null;
}

/**
 * The formation to display: the provider's when it accounts for the outfield
 * players, otherwise one derived from positions, otherwise nothing (never a
 * made-up "4-4-2").
 */
export function resolveFormationLabel(
  formation: string | null | undefined,
  players: Array<{ pos?: string | null }>,
): { label: string | null; derived: boolean } {
  const rows = parseFormationRows(formation);
  const outfield = Math.max(0, players.length - 1);
  const explicitFits =
    rows.length >= 2 && (players.length === 0 || rows.reduce((a, b) => a + b, 0) === outfield);
  if (explicitFits) return { label: rows.join('-'), derived: false };

  const derived = deriveFormationFromPositions(players);
  if (derived) return { label: derived, derived: true };
  if (rows.length >= 2) return { label: rows.join('-'), derived: false };
  return { label: null, derived: false };
}

/**
 * Pitch rows (goalkeeper first) for a starting XI that has no usable grid:
 * fill the resolved formation rows in pitch order, or group by position when
 * no formation can be trusted.
 */
export function buildFormationColumns<T extends PositionedPlayer>(
  players: T[],
  formation: string | null | undefined,
): T[][] {
  if (players.length === 0) return [];
  const ordered = sortPlayersForPitch(players);
  const { label } = resolveFormationLabel(formation, players);
  const rows = parseFormationRows(label);

  if (rows.length >= 2) {
    const columns: T[][] = [];
    let index = 0;
    for (const rowCount of [1, ...rows]) {
      const slice = ordered.slice(index, index + rowCount);
      if (slice.length > 0) columns.push(slice);
      index += rowCount;
    }
    if (index < ordered.length) {
      const tail = ordered.slice(index);
      if (columns.length === 0) columns.push(tail);
      else columns[columns.length - 1] = [...columns[columns.length - 1], ...tail];
    }
    return columns;
  }

  const buckets: Record<PositionLetter, T[]> = { G: [], D: [], M: [], F: [] };
  let classified = 0;
  for (const player of ordered) {
    const pos = normalizePos(player.pos);
    if (pos) classified += 1;
    buckets[pos ?? 'M'].push(player);
  }
  if (classified >= Math.ceil(players.length / 2)) {
    return [buckets.G, buckets.D, buckets.M, buckets.F].filter((col) => col.length > 0);
  }

  // Nothing to go on: keeper up top, then a balanced 4-3-3 spread.
  const columns: T[][] = [];
  let index = 0;
  for (const rowCount of [1, 4, 3, 3]) {
    const slice = ordered.slice(index, index + rowCount);
    if (slice.length > 0) columns.push(slice);
    index += rowCount;
  }
  if (index < ordered.length) {
    columns[columns.length - 1] = [...columns[columns.length - 1], ...ordered.slice(index)];
  }
  return columns;
}
