import { map365RecentGamesToTeamFixtures } from '../scores365Adapters';

describe('map365RecentGamesToTeamFixtures', () => {
  it('includes finished games when statusGroup is 4', () => {
    const games = [
      {
        id: 1,
        startTime: '2026-06-19T01:00:00+03:00',
        statusGroup: 4,
        competitionDisplayName: 'World Cup',
        homeCompetitor: { id: 10, name: 'Home', score: 2 },
        awayCompetitor: { id: 20, name: 'Away', score: 1 },
      },
    ];
    const result = map365RecentGamesToTeamFixtures(games, 5);
    expect(result).toHaveLength(1);
    expect(result[0].goals).toEqual({ home: 2, away: 1 });
  });

  it('excludes scheduled games without scores', () => {
    const games = [
      {
        id: 2,
        startTime: '2026-07-01T01:00:00+03:00',
        statusGroup: 2,
        homeCompetitor: { id: 10, name: 'Home' },
        awayCompetitor: { id: 20, name: 'Away' },
      },
    ];
    expect(map365RecentGamesToTeamFixtures(games, 5)).toHaveLength(0);
  });
});
