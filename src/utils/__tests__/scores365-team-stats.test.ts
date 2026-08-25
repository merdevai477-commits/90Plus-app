import { buildTeamStatisticsFrom365GameStats } from '../scores365-team-stats';

describe('buildTeamStatisticsFrom365GameStats', () => {
  const teams = {
    home: { id: 100, name: 'Home FC', logo: '' },
    away: { id: 200, name: 'Away FC', logo: '' },
  };

  it('maps corners and possession to API-Football types', () => {
    const payload = {
      statistics: [
        { id: 10, name: 'Possession', competitorId: 1, value: '55%' },
        { id: 10, name: 'Possession', competitorId: 2, value: '45%' },
        { id: 8, name: 'Corners', competitorId: 1, value: '7' },
        { id: 8, name: 'Corners', competitorId: 2, value: '3' },
        { id: 11, name: 'Attacks', competitorId: 1, value: '80' },
        { id: 11, name: 'Attacks', competitorId: 2, value: '60' },
        { id: 4, name: 'Shots On Target', competitorId: 1, value: '5' },
        { id: 4, name: 'Shots On Target', competitorId: 2, value: '2' },
      ],
    };

    const result = buildTeamStatisticsFrom365GameStats(payload, teams, {
      home: 1,
      away: 2,
    }) as Array<{ team: { id: number }; statistics: Array<{ type: string; value: unknown }> }>;

    expect(result).toHaveLength(2);
    expect(result[0].team.id).toBe(100);
    expect(result[1].team.id).toBe(200);

    const homeCorner = result[0].statistics.find((s) => s.type === 'Corner Kicks');
    const awayCorner = result[1].statistics.find((s) => s.type === 'Corner Kicks');
    expect(homeCorner?.value).toBe(7);
    expect(awayCorner?.value).toBe(3);

    const homePoss = result[0].statistics.find((s) => s.type === 'Ball Possession');
    expect(homePoss?.value).toBe('55%');

    const homeAttacks = result[0].statistics.find((s) => s.type === 'Attacks');
    expect(homeAttacks?.value).toBe(80);
  });

  it('returns empty when competitor ids do not match', () => {
    const payload = {
      statistics: [{ id: 8, name: 'Corners', competitorId: 99, value: '4' }],
    };
    expect(
      buildTeamStatisticsFrom365GameStats(payload, teams, { home: 1, away: 2 }),
    ).toEqual([]);
  });
});
