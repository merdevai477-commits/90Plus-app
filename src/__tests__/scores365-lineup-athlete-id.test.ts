/**
 * 365Scores lineups expose two different ids per player: `competitor.lineups.members[].id`
 * is a per-game roster row, while `game.members[].athleteId` is the athlete. Career,
 * match report, info, and headshot endpoints only accept the athlete id.
 */

// The mapper lives next to services that open a DB connection on import.
jest.mock('../lib/prisma', () => {
  const prisma = {
    cachedFixture: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { __esModule: true, prisma, default: prisma, withRetry: jest.fn() };
});

import {
  deriveFormationFromPositions,
  lineupHasFieldPositions,
  mapScores365Lineups,
} from '../services/scores365-experiment.service';
import { is365LineupIdMappingStale } from '../utils/lineups-fallback';

const base = {
  fixture: { id: 4804603 },
  teams: {
    home: { id: 8200, name: 'Al Ahly SC', logo: 'home.png' },
    away: { id: 8309, name: 'Smouha', logo: 'away.png' },
  },
} as any;

const game = {
  id: 4804603,
  lineupsStatus: 1,
  homeCompetitor: {
    id: 8200,
    name: 'Al Ahly SC',
    lineups: {
      formation: '4-2-3-1',
      hasFieldPositions: true,
      members: [
        { id: 538177, status: 1, yardFormation: { line: 4, fieldPosition: 3 } },
        { id: 650570, status: 2 },
      ],
    },
  },
  awayCompetitor: {
    id: 8309,
    name: 'Smouha',
    lineups: { formation: '4-3-3', members: [{ id: 3391256, status: 1 }] },
  },
  members: [
    { id: 538177, competitorId: 8200, athleteId: 4576, name: 'Ahmed Sayed Zizo', jerseyNumber: 25 },
    { id: 650570, competitorId: 8200, athleteId: 51735, name: 'Taher Mohamed', jerseyNumber: 7 },
    { id: 3391256, competitorId: 8309, athleteId: 84443, name: 'Fady Farid', jerseyNumber: 1 },
  ],
} as any;

describe('mapScores365Lineups athlete ids', () => {
  const [home] = mapScores365Lineups(game, base, { swapped: false } as any);

  it('exposes the athlete id, not the roster row id', () => {
    expect(home.startXI[0].player.id).toBe(4576);
    expect(home.startXI[0].player.athleteId).toBe(4576);
    expect(home.substitutes[0].player.athleteId).toBe(51735);
  });

  it('keeps the roster row id so named-lineup enrichment can still join', () => {
    expect(home.startXI[0].player.scores365MemberId).toBe(538177);
  });

  it('builds headshot urls from the athlete id', () => {
    expect(home.startXI[0].player.photo).toContain('/Athletes/4576');
  });

  it('keeps the grid when 365 published real field positions', () => {
    expect(home.startXI[0].player.grid).toBe('4:3');
    expect(home.formation).toBe('4-2-3-1');
    expect(home._formationDerived).toBe(false);
  });
});

/**
 * 3. Liga (Ingolstadt - Aachen): 365 sends `hasFieldPositions: false`, an empty
 * formation and `yardFormation.line = 1` for every starter. Emitting `1:N` grids
 * put all eleven players on one row in the app.
 */
describe('mapScores365Lineups without field positions', () => {
  const roles: Array<[number, number, string]> = [
    // [memberId, position.id, role]
    [1, 1, 'Goalkeeper'],
    [2, 2, 'Centre Back'],
    [3, 2, 'Centre Back'],
    [4, 2, 'Centre Back'],
    [5, 3, 'Defensive Midfield'],
    [6, 3, 'Central Midfield'],
    [7, 3, 'Central Midfield'],
    [8, 3, 'Attacking Midfield'],
    [9, 3, 'Defensive Midfield'],
    [10, 4, 'Centre Forward'],
    [11, 4, 'Left Forward'],
  ];
  const nameOnlyGame = {
    id: 4763487,
    lineupsStatus: 1,
    homeCompetitor: {
      id: 8200,
      name: 'Al Ahly SC',
      lineups: {
        formation: '',
        hasFieldPositions: false,
        members: roles.map(([id, positionId, role], idx) => ({
          id,
          status: 1,
          formation: { id: 20 + idx, shortName: role },
          position: { id: positionId },
          yardFormation: { line: 1, fieldPosition: 11 - idx },
        })),
      },
    },
    awayCompetitor: { id: 8309, name: 'Smouha', lineups: { formation: '', members: [] } },
    members: roles.map(([id]) => ({
      id,
      competitorId: 8200,
      athleteId: 1000 + id,
      name: `Player ${id}`,
      jerseyNumber: id,
    })),
  } as any;

  const [home] = mapScores365Lineups(nameOnlyGame, base, { swapped: false } as any);

  it('does not emit a placeholder grid for every starter', () => {
    expect(home.startXI.every((entry: any) => entry.player.grid === null)).toBe(true);
    expect(home._hasFieldPositions).toBe(false);
  });

  it('derives the formation from coarse positions', () => {
    expect(home.formation).toBe('3-5-2');
    expect(home._formationDerived).toBe(true);
  });

  it('orders starters goalkeeper → defence → midfield → attack', () => {
    expect(home.startXI.map((entry: any) => entry.player.pos)).toEqual([
      'G', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'M', 'F', 'F',
    ]);
  });

  it('classifies "Defensive Midfield" as a midfielder, not a defender', () => {
    const dm = home.startXI.find((entry: any) => entry.player.scores365MemberId === 5);
    expect(dm.player.pos).toBe('M');
  });
});

describe('lineupHasFieldPositions', () => {
  it('trusts an explicit hasFieldPositions=true', () => {
    expect(lineupHasFieldPositions({ hasFieldPositions: true }, [])).toBe(true);
  });

  it('accepts starters spread over two or more lines when the flag is missing', () => {
    const starters = [{ yardFormation: { line: 1 } }, { yardFormation: { line: 2 } }];
    expect(lineupHasFieldPositions({}, starters)).toBe(true);
  });

  it('rejects a single shared line', () => {
    const starters = Array.from({ length: 11 }, () => ({ yardFormation: { line: 1 } }));
    expect(lineupHasFieldPositions({ hasFieldPositions: false }, starters)).toBe(false);
    expect(lineupHasFieldPositions(undefined, starters)).toBe(false);
  });
});

describe('deriveFormationFromPositions', () => {
  it('builds D-M-F from eleven classified starters', () => {
    expect(
      deriveFormationFromPositions(['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'F', 'F', 'F']),
    ).toBe('4-3-3');
  });

  it('drops empty segments', () => {
    expect(
      deriveFormationFromPositions(['G', 'D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'M', 'M']),
    ).toBe('4-6');
  });

  it('refuses to guess when a starter has no position or the keeper is missing', () => {
    expect(
      deriveFormationFromPositions(['G', 'D', 'D', 'D', 'D', null, 'M', 'M', 'F', 'F', 'F']),
    ).toBeNull();
    expect(
      deriveFormationFromPositions(['D', 'D', 'D', 'D', 'M', 'M', 'M', 'M', 'F', 'F', 'F']),
    ).toBeNull();
    expect(deriveFormationFromPositions(['G', 'D', 'M'])).toBeNull();
  });
});

describe('is365LineupIdMappingStale', () => {
  it('flags lineups cached before the athlete id fix', () => {
    const legacy = [
      { _source: 'scores365-experiment', startXI: [{ player: { id: 538177 } }], substitutes: [] },
    ];
    expect(is365LineupIdMappingStale(legacy)).toBe(true);
  });

  it('accepts freshly mapped lineups', () => {
    expect(is365LineupIdMappingStale(mapScores365Lineups(game, base, { swapped: false } as any))).toBe(
      false,
    );
  });

  it('leaves API-Football lineups alone', () => {
    const apiFootball = [{ _source: 'api-football', startXI: [{ player: { id: 12345 } }] }];
    expect(is365LineupIdMappingStale(apiFootball)).toBe(false);
  });

  it('treats an absent lineup as nothing to refresh', () => {
    expect(is365LineupIdMappingStale([])).toBe(false);
  });
});
