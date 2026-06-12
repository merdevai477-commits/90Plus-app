import {
  resolveStandingsGroupsForMatch,
  standingRowMatchesTeam,
  teamMatchesStanding,
} from '../standingsHelpers';
import type { Standing } from '../../services/apiFootball';

function row(id: number, name: string, group = 'Group A'): Standing {
  return {
    rank: 1,
    team: { id, name, logo: '' },
    points: 0,
    goalsDiff: 0,
    group,
    form: '',
    status: '',
    description: null,
    all: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
    home: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
    away: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
    update: '',
  };
}

describe('standingsHelpers', () => {
  test('teamMatchesStanding matches partial names', () => {
    expect(teamMatchesStanding('South Korea', 'Korea')).toBe(true);
    expect(teamMatchesStanding('Czech Republic', 'France')).toBe(false);
  });

  test('standingRowMatchesTeam prefers team id', () => {
    const standing = row(10, 'South Korea');
    expect(standingRowMatchesTeam(standing, { id: 10, name: 'Other' })).toBe(true);
  });

  test('resolveStandingsGroupsForMatch returns shared group only', () => {
    const groups = [
      {
        group: 'Group A',
        standings: [row(1, 'South Korea'), row(2, 'Czech Republic')],
      },
      {
        group: 'Group B',
        standings: [row(3, 'Brazil'), row(4, 'France')],
      },
    ];

    const result = resolveStandingsGroupsForMatch(
      groups,
      { id: 1, name: 'South Korea' },
      { id: 2, name: 'Czech Republic' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.group).toBe('Group A');
    expect(result[0]?.standings).toHaveLength(2);
  });
});
