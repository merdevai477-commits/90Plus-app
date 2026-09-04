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

import { mapScores365Lineups } from '../services/scores365-experiment.service';
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
