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
});
