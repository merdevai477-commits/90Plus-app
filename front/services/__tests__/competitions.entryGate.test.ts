/**
 * `isEntryOpen` decides whether the prediction controls are live, and must
 * mirror the backend gates exactly (published + before deadline + before
 * kickoff). A mismatch either blocks a legitimate prediction or lets the user
 * submit one the API will reject.
 */

import { isEntryOpen, normalizeCompetitionListPage, type CompetitionInfo } from '../competitions.service';

const HOUR = 3_600_000;

function competition(overrides: Partial<CompetitionInfo> = {}): CompetitionInfo {
  return {
    id: 'c1',
    sponsor: {
      id: 's1',
      name: 'Kick Zone',
      description: null,
      logoUrl: null,
      address: null,
      hasDelivery: false,
      socialLinks: null,
      isVerified: true,
      isActive: true,
    },
    category: {
      id: 'cat1',
      key: 'sportswear',
      nameAr: 'ملابس',
      description: null,
      icon: null,
      sortOrder: 1,
      isActive: true,
    },
    prizeName: 'Shoes',
    prizeImageUrl: null,
    prizeType: 'sportswear',
    prizeDescription: null,
    winnersCount: 1,
    apiMatchId: 1,
    homeTeam: 'A',
    awayTeam: 'B',
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: new Date(Date.now() + 2 * HOUR).toISOString(),
    leagueName: null,
    matchStatus: null,
    resultHomeScore: null,
    resultAwayScore: null,
    predictionDeadline: new Date(Date.now() + HOUR).toISOString(),
    predictionMode: 'EXACT_SCORE',
    status: 'PUBLISHED',
    rules: null,
    startAt: null,
    endAt: null,
    isFree: true,
    participantsCount: 0,
    myEntry: null,
    ...overrides,
  };
}

describe('normalizeCompetitionListPage', () => {
  it('reads the canonical { items, nextCursor } shape', () => {
    const row = { id: 'c1' } as CompetitionInfo;
    expect(normalizeCompetitionListPage({ items: [row], nextCursor: 'cur1' })).toEqual({
      items: [row],
      nextCursor: 'cur1',
    });
  });

  it('accepts a bare array when the payload is not wrapped', () => {
    const row = { id: 'c1' } as CompetitionInfo;
    expect(normalizeCompetitionListPage([row])).toEqual({ items: [row], nextCursor: null });
  });

  it('falls back to alternate keys instead of returning undefined items', () => {
    const row = { id: 'c1' } as CompetitionInfo;
    expect(normalizeCompetitionListPage({ data: [row], next_cursor: 'cur2' })).toEqual({
      items: [row],
      nextCursor: 'cur2',
    });
  });
});

describe('isEntryOpen', () => {
  it('is open before the deadline on a published competition', () => {
    expect(isEntryOpen(competition())).toBe(true);
  });

  it('closes once the deadline has passed', () => {
    expect(
      isEntryOpen(competition({ predictionDeadline: new Date(Date.now() - 1000).toISOString() })),
    ).toBe(false);
  });

  it('closes exactly at the deadline', () => {
    const now = new Date().toISOString();
    expect(isEntryOpen(competition({ predictionDeadline: now }))).toBe(false);
  });

  it('closes once the match has kicked off even if the deadline is later', () => {
    expect(
      isEntryOpen(
        competition({
          matchDate: new Date(Date.now() - 60_000).toISOString(),
          predictionDeadline: new Date(Date.now() + HOUR).toISOString(),
        }),
      ),
    ).toBe(false);
  });

  it.each(['DRAFT', 'LOCKED', 'SETTLED', 'CANCELLED', 'REJECTED'] as const)(
    'is closed in %s status',
    (status) => {
      expect(isEntryOpen(competition({ status }))).toBe(false);
    },
  );
});
