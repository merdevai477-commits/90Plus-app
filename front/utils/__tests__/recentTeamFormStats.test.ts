import {
  summarizeRecentTeamForm,
  summarizeRecentTeamAverages,
  formatStatAverage,
  pickHighlightSide,
} from '../recentTeamFormStats';
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

describe('summarizeRecentTeamAverages', () => {
  it('computes last-4 averages and trends from scores', () => {
    const fixtures = [
      row(10, 20, 2, 1),
      row(30, 10, 0, 0),
      row(10, 40, 3, 2),
      row(50, 10, 4, 1),
    ];
    const summary = summarizeRecentTeamAverages(fixtures, { id: 10, name: 'Home' }, 4);
    expect(summary.played).toBe(4);
    expect(summary.avgGoalsFor).toBeCloseTo((2 + 0 + 3 + 1) / 4);
    expect(summary.avgGoalsAgainst).toBeCloseTo((1 + 0 + 2 + 4) / 4);
    expect(summary.btts).toEqual({ count: 3, pct: 75 });
    expect(summary.over25).toEqual({ count: 3, pct: 75 });
    expect(summary.winOrDraw).toEqual({ count: 3, pct: 75 });
    expect(summary.cleanSheets).toEqual({ count: 1, pct: 25 });
  });
});

describe('pickHighlightSide / formatStatAverage', () => {
  it('highlights the better side and formats decimals like the reference UI', () => {
    expect(pickHighlightSide(1.75, 2.5, 'higher')).toBe('away');
    expect(pickHighlightSide(1.75, 1.5, 'lower')).toBe('away');
    expect(pickHighlightSide(1.99, 1.24, 'higher')).toBe('home');
    expect(formatStatAverage(1.75)).toBe('1.75');
    expect(formatStatAverage(2.5)).toBe('2.5');
    expect(formatStatAverage(16)).toBe('16');
    expect(formatStatAverage(null)).toBe('—');
  });
});
