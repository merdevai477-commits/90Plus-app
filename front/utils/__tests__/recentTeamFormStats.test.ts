import { summarizeRecentTeamForm } from '../recentTeamFormStats';
import type { TeamFixture } from '../../services/apiFootball';

function row(
  homeId: number,
  awayId: number,
  hg: number,
  ag: number,
  names?: { home: string; away: string },
): TeamFixture {
  return {
    fixture: {
      id: homeId + awayId,
      date: '',
      timestamp: 0,
      status: { long: 'Match Finished', short: 'FT' },
    },
    league: { id: 1, name: 'L', logo: '' },
    teams: {
      home: { id: homeId, name: names?.home ?? 'Home', logo: '', winner: hg > ag },
      away: { id: awayId, name: names?.away ?? 'Away', logo: '', winner: ag > hg },
    },
    goals: { home: hg, away: ag },
  };
}

describe('summarizeRecentTeamForm', () => {
  it('returns empty when there are no fixtures', () => {
    expect(summarizeRecentTeamForm([], { id: 1, name: 'Home' }).played).toBe(0);
  });

  it('aggregates last matches for the home side', () => {
    const fixtures = [
      row(10, 20, 2, 0),
      row(30, 10, 1, 1),
      row(10, 40, 0, 3),
    ];
    const summary = summarizeRecentTeamForm(fixtures, { id: 10, name: 'Home' }, 5);
    expect(summary).toEqual({
      played: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      goalsFor: 3,
      goalsAgainst: 4,
      form: 'WDL',
    });
  });

  it('caps at the requested limit', () => {
    const fixtures = [row(1, 2, 1, 0), row(1, 3, 2, 0), row(1, 4, 3, 0)];
    expect(summarizeRecentTeamForm(fixtures, { id: 1 }, 2).played).toBe(2);
    expect(summarizeRecentTeamForm(fixtures, { id: 1 }, 2).form).toBe('WW');
  });
});
