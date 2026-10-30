import { mergeScoreIntoFullData } from '../fixture-score-merge.util';

describe('mergeScoreIntoFullData (A10)', () => {
  const stale = {
    fixture: { id: 1, referee: 'R', status: { short: 'NS', long: 'Not Started', elapsed: null } },
    goals: { away: null, home: null },
    score: { penalty: { away: null, home: null }, fulltime: { away: null, home: null } },
    events: [{ type: 'Goal' }],
  };

  it('carries status, goals and shootout into the preserved snapshot', () => {
    const merged = mergeScoreIntoFullData(stale, {
      fixture: { status: { short: 'PEN', long: 'Penalties', elapsed: 120 } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 3, away: 4 }, fulltime: { home: 1, away: 1 } },
    });
    expect(merged).toMatchObject({
      fixture: { id: 1, referee: 'R', status: { short: 'PEN' } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 3, away: 4 }, fulltime: { home: 1, away: 1 } },
      events: [{ type: 'Goal' }],
    });
  });

  it('a later partial payload with null pens does not erase a known tally', () => {
    const known = { ...stale, score: { penalty: { home: 3, away: 4 } } };
    const merged = mergeScoreIntoFullData(known, {
      fixture: { status: { short: 'NS' } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: null, away: null } },
    });
    expect((merged as any).score.penalty).toEqual({ home: 3, away: 4 });
  });

  it('returns null when nothing changed (key order ignored)', () => {
    const current = {
      fixture: { status: { elapsed: 90, long: 'Match Finished', short: 'FT' } },
      goals: { away: 0, home: 2 },
      score: { penalty: { away: null, home: null } },
    };
    expect(
      mergeScoreIntoFullData(current, {
        fixture: { status: { short: 'FT', long: 'Match Finished', elapsed: 90 } },
        goals: { home: 2, away: 0 },
        score: { penalty: { home: null, away: null } },
      }),
    ).toBeNull();
  });

  it.each([null, undefined, 'x', [1]])('non-object existing (%p) → null', (existing) => {
    expect(mergeScoreIntoFullData(existing, { goals: { home: 1, away: 0 } })).toBeNull();
  });
});
