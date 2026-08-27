/**
 * Grading rules for Predict & Win settlement.
 *
 * `gradeEntries` is the pure core of winner determination, so the business
 * rules (first correct predictor wins, winners capped at `winnersCount`,
 * deterministic ordering) are pinned here without touching a database.
 */

import { actualWinner, gradeEntries, type GradeableEntry } from '../competition-resolver.service';

const T0 = new Date('2026-05-25T20:00:00.000Z').getTime();

function entry(
  id: string,
  offsetMs: number,
  prediction: Partial<GradeableEntry> = {},
): GradeableEntry {
  return {
    id,
    userId: 'user-' + id,
    predictedHomeScore: null,
    predictedAwayScore: null,
    predictedWinner: null,
    createdAt: new Date(T0 + offsetMs),
    ...prediction,
  };
}

function exact(id: string, offsetMs: number, home: number, away: number): GradeableEntry {
  return entry(id, offsetMs, { predictedHomeScore: home, predictedAwayScore: away });
}

describe('actualWinner', () => {
  it.each([
    [2, 1, 'home'],
    [0, 3, 'away'],
    [1, 1, 'draw'],
    [0, 0, 'draw'],
  ])('%i-%i → %s', (home, away, expected) => {
    expect(actualWinner(home as number, away as number)).toBe(expected);
  });
});

describe('gradeEntries — EXACT_SCORE', () => {
  const opts = { mode: 'EXACT_SCORE' as const, homeScore: 2, awayScore: 1, winnersCount: 2 };

  it('marks only the exact score correct', () => {
    const graded = gradeEntries(
      [exact('a', 0, 2, 1), exact('b', 10, 1, 2), exact('c', 20, 2, 0)],
      opts,
    );
    expect(graded.map((g) => [g.entry.id, g.isCorrect])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);
  });

  it('awards ranks to the earliest correct entries', () => {
    const graded = gradeEntries(
      [exact('late', 300, 2, 1), exact('first', 100, 2, 1), exact('second', 200, 2, 1)],
      opts,
    );
    const ranks = Object.fromEntries(graded.map((g) => [g.entry.id, g.rank]));
    expect(ranks).toEqual({ first: 1, second: 2, late: null });
  });

  it('caps winners at winnersCount even when more entrants are correct', () => {
    const graded = gradeEntries(
      [exact('a', 0, 2, 1), exact('b', 1, 2, 1), exact('c', 2, 2, 1), exact('d', 3, 2, 1)],
      opts,
    );
    expect(graded.filter((g) => g.rank !== null)).toHaveLength(2);
    expect(graded.filter((g) => g.isCorrect)).toHaveLength(4);
  });

  it('produces no winners when nobody is correct', () => {
    const graded = gradeEntries([exact('a', 0, 0, 0), exact('b', 1, 5, 5)], opts);
    expect(graded.every((g) => g.rank === null)).toBe(true);
  });

  it('awards fewer winners than the cap when correct entries are scarce', () => {
    const graded = gradeEntries([exact('a', 0, 2, 1), exact('b', 1, 9, 9)], opts);
    expect(graded.filter((g) => g.rank !== null).map((g) => g.entry.id)).toEqual(['a']);
  });

  it('assigns a contiguous 1..N rank sequence with no duplicates', () => {
    const graded = gradeEntries(
      [exact('a', 0, 2, 1), exact('b', 1, 2, 1), exact('c', 2, 2, 1)],
      { ...opts, winnersCount: 3 },
    );
    expect(graded.map((g) => g.rank).filter(Boolean).sort()).toEqual([1, 2, 3]);
  });

  it('breaks identical timestamps deterministically by id', () => {
    const a = gradeEntries([exact('b', 0, 2, 1), exact('a', 0, 2, 1)], { ...opts, winnersCount: 1 });
    const b = gradeEntries([exact('a', 0, 2, 1), exact('b', 0, 2, 1)], { ...opts, winnersCount: 1 });
    expect(a.find((g) => g.rank === 1)!.entry.id).toBe('a');
    expect(b.find((g) => g.rank === 1)!.entry.id).toBe('a');
  });

  it('handles an empty entry list', () => {
    expect(gradeEntries([], opts)).toEqual([]);
  });

  it('never ranks anyone when winnersCount is zero', () => {
    const graded = gradeEntries([exact('a', 0, 2, 1)], { ...opts, winnersCount: 0 });
    expect(graded[0].isCorrect).toBe(true);
    expect(graded[0].rank).toBeNull();
  });
});

describe('gradeEntries — WINNER', () => {
  const opts = { mode: 'WINNER' as const, homeScore: 1, awayScore: 1, winnersCount: 2 };

  it('grades against the outcome rather than the scoreline', () => {
    const graded = gradeEntries(
      [
        entry('draw1', 0, { predictedWinner: 'draw' }),
        entry('home', 10, { predictedWinner: 'home' }),
        entry('draw2', 20, { predictedWinner: 'draw' }),
      ],
      opts,
    );
    const byId = Object.fromEntries(graded.map((g) => [g.entry.id, g]));
    expect(byId.draw1.rank).toBe(1);
    expect(byId.draw2.rank).toBe(2);
    expect(byId.home.isCorrect).toBe(false);
  });

  it('ignores exact-score fields in WINNER mode', () => {
    const graded = gradeEntries([exact('a', 0, 1, 1)], opts);
    expect(graded[0].isCorrect).toBe(false);
  });
});
