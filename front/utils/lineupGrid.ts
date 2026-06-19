interface GridPlayer {
  grid?: string | null;
  fieldLine?: number | null;
  fieldSide?: number | null;
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

export function hasGridLayoutData(players: GridPlayer[]): boolean {
  return players.some(
    (p) =>
      (p.fieldLine != null && p.fieldSide != null) ||
      (p.grid != null && p.grid.includes(':')),
  );
}
