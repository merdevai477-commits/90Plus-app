import { classifyScores365MatchStatus } from '../scores365-experiment.service';

function game(partial: Record<string, unknown>) {
  return {
    id: 1,
    sportId: 1,
    competitionId: 167,
    statusId: 0,
    statusGroup: 3,
    homeCompetitor: { id: 1, name: 'Home', score: 1 },
    awayCompetitor: { id: 2, name: 'Away', score: 1 },
    ...partial,
  } as Parameters<typeof classifyScores365MatchStatus>[0];
}

describe('classifyScores365MatchStatus', () => {
  it('maps statusGroup 4 to FT', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 4, statusText: 'Ended', shortStatusText: 'Ended', gameTime: 90 }),
    );
    expect(result.short).toBe('FT');
  });

  it('maps statusGroup 2 to NS', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 2, statusText: 'Scheduled', gameTime: -1, homeCompetitor: { id: 1, name: 'H', score: -1 }, awayCompetitor: { id: 2, name: 'A', score: -1 } }),
    );
    expect(result.short).toBe('NS');
  });

  it('keeps statusGroup 3 live even when scores are still -1', () => {
    const result = classifyScores365MatchStatus(
      game({
        statusGroup: 3,
        statusText: '1st Half',
        shortStatusText: '1st Half',
        gameTime: 12,
        homeCompetitor: { id: 1, name: 'H', score: -1 },
        awayCompetitor: { id: 2, name: 'A', score: -1 },
      }),
    );
    expect(result.short).toBe('1H');
    expect(result.elapsed).toBe(12);
  });

  it('does not treat high stale gameTime alone as 2H live', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 4, statusText: '', shortStatusText: '', gameTime: 125 }),
    );
    expect(result.short).toBe('FT');
  });

  it('caps second-half elapsed for live matches', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: '2nd Half', shortStatusText: '2nd Half', gameTime: 95 }),
    );
    expect(result.short).toBe('2H');
    expect(result.elapsed).toBe(95);
  });

  it('treats impossible live clock as FT', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: '2nd Half', shortStatusText: '2nd Half', gameTime: 125 }),
    );
    expect(result.short).toBe('FT');
  });

  it('recognizes Just Ended as FT', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 4, statusText: 'Just Ended', shortStatusText: 'Just Ended', gameTime: 90 }),
    );
    expect(result.short).toBe('FT');
  });

  it('maps live extra time to ET with a 91–120 minute', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: 'Extra Time', shortStatusText: 'ET', gameTime: 98 }),
    );
    expect(result.short).toBe('ET');
    expect(result.elapsed).toBe(98);
  });

  it('parses stoppage from gameTimeDisplay when clock stays at 90', () => {
    const result = classifyScores365MatchStatus(
      game({
        statusGroup: 3,
        statusText: '2nd Half',
        shortStatusText: '2nd Half',
        gameTime: 90,
        gameTimeDisplay: '90+4',
      }),
    );
    expect(result.short).toBe('2H');
    expect(result.elapsed).toBe(90);
    expect(result.extra).toBe(4);
  });

  it('parses first-half stoppage from gameTimeDisplay', () => {
    const result = classifyScores365MatchStatus(
      game({
        statusGroup: 3,
        statusText: '1st Half',
        shortStatusText: '1st Half',
        gameTime: 45,
        gameTimeDisplay: '45+2',
      }),
    );
    expect(result.short).toBe('1H');
    expect(result.elapsed).toBe(45);
    expect(result.extra).toBe(2);
  });

  it('maps finished after extra time to AET', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 4, statusText: 'After Extra Time', shortStatusText: 'AET', gameTime: 120 }),
    );
    expect(result.short).toBe('AET');
  });

  it('maps a live penalty shootout to P', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: 'Penalties', shortStatusText: 'Pen.', gameTime: 120 }),
    );
    expect(result.short).toBe('P');
  });

  it('maps finished after penalties to PEN', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 4, statusText: 'After Penalties', shortStatusText: 'Pen.', gameTime: 120 }),
    );
    expect(result.short).toBe('PEN');
  });

  it('maps cancelled matches to CANC even with score -1', () => {
    const result = classifyScores365MatchStatus(
      game({
        statusGroup: 2,
        statusText: 'Cancelled',
        shortStatusText: 'Canc.',
        gameTime: -1,
        homeCompetitor: { id: 1, name: 'H', score: -1 },
        awayCompetitor: { id: 2, name: 'A', score: -1 },
      }),
    );
    expect(result.short).toBe('CANC');
    expect(result.elapsed).toBeNull();
  });

  it('maps postponed matches to PST', () => {
    const result = classifyScores365MatchStatus(
      game({
        statusGroup: 2,
        statusText: 'Postponed',
        shortStatusText: 'Postp.',
        gameTime: -1,
        homeCompetitor: { id: 1, name: 'H', score: -1 },
        awayCompetitor: { id: 2, name: 'A', score: -1 },
      }),
    );
    expect(result.short).toBe('PST');
  });

  it('maps suspended matches to SUSP', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: 'Suspended', shortStatusText: 'Susp.', gameTime: 63 }),
    );
    expect(result.short).toBe('SUSP');
  });

  it('maps interrupted matches to INT', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: 'Interrupted', shortStatusText: 'Int.', gameTime: 71 }),
    );
    expect(result.short).toBe('INT');
  });

  it('maps abandoned matches to ABD', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 4, statusText: 'Abandoned', shortStatusText: 'Aband.', gameTime: 55 }),
    );
    expect(result.short).toBe('ABD');
  });

  it('still maps a normal 2nd half to 2H (no false special-state match)', () => {
    const result = classifyScores365MatchStatus(
      game({ statusGroup: 3, statusText: '2nd Half', shortStatusText: '2nd Half', gameTime: 67 }),
    );
    expect(result.short).toBe('2H');
  });
});
