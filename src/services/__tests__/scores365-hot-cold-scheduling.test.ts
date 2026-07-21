import { selectCompetitionFixturesBatch } from '../threeSixFiveScores.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../match-cache.service', () => ({
  matchCacheService: {},
}));

describe('365 hot/cold competition scheduling', () => {
  it('keeps priority competitions while always advancing round-robin work', () => {
    const allIds = [1, 2, 3, 4, 5, 6];

    const first = selectCompetitionFixturesBatch(allIds, [1, 2, 3, 4, 5], 3, 0);
    expect(first.ids).toEqual([1, 2, 3]);
    expect(first.priorityCount).toBe(2);
    expect(first.nextCursor).toBe(3);

    const second = selectCompetitionFixturesBatch(allIds, [1, 2, 3, 4, 5], 3, first.nextCursor);
    expect(second.ids.slice(0, 2)).toEqual([1, 2]);
    expect(second.ids[2]).toBe(4);
    expect(second.nextCursor).toBe(4);
  });

  it('continues catalog discovery when every priority slot is busy', () => {
    const result = selectCompetitionFixturesBatch([10, 20, 30, 40], [10, 20, 30], 2, 3);

    expect(result.ids).toEqual([10, 40]);
    expect(result.nextCursor).toBe(0);
  });

  it('traverses the complete cold catalog despite permanently hot priorities', () => {
    const allIds = [1, 2, 3, 4, 5, 6];
    let cursor = 0;
    const visited = new Set<number>();

    for (let tick = 0; tick < 4; tick++) {
      const result = selectCompetitionFixturesBatch(allIds, [1, 2], 3, cursor);
      result.ids.forEach((id) => visited.add(id));
      cursor = result.nextCursor;
    }

    expect([...visited].sort((a, b) => a - b)).toEqual(allIds);
  });
});
