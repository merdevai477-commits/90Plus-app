jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../competition-match-pool.service', () => ({
  findInPool: jest.fn(),
  getPoolForDate: jest.fn(),
  getUpcomingPool: jest.fn(),
}));

import {
  assertSponsorCanCreateCompetition,
  SPONSOR_CREATE_COOLDOWN_MS,
  sponsorCreateDecisionAt,
  type SponsorCreateGateRow,
} from '../competitions.service';

const NOW = new Date('2026-09-07T12:00:00.000Z');

function row(
  status: SponsorCreateGateRow['status'],
  hoursAgo: number,
  stamps: Partial<Pick<SponsorCreateGateRow, 'reviewedAt' | 'publishedAt'>> = {},
): SponsorCreateGateRow {
  const at = new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000);
  return {
    status,
    createdAt: at,
    reviewedAt: stamps.reviewedAt === undefined ? at : stamps.reviewedAt,
    publishedAt: stamps.publishedAt === undefined ? (status === 'REJECTED' || status === 'CANCELLED' || status === 'DRAFT' ? null : at) : stamps.publishedAt,
  };
}

describe('sponsor create cooldown after accept or reject', () => {
  it('allows a first ad when the sponsor has none', () => {
    expect(() => assertSponsorCanCreateCompetition(null, NOW)).not.toThrow();
  });

  it('blocks a second ad while a draft is still under review', () => {
    expect(() => assertSponsorCanCreateCompetition(row('DRAFT', 48), NOW)).toThrow(
      'COMPETITION_PENDING',
    );
  });

  it('blocks for 24h after reject, then allows another ad', () => {
    expect(() => assertSponsorCanCreateCompetition(row('REJECTED', 1), NOW)).toThrow(
      'CREATE_COOLDOWN',
    );
    expect(() => assertSponsorCanCreateCompetition(row('REJECTED', 25), NOW)).not.toThrow();
  });

  it('blocks for 24h after accept, then allows another ad', () => {
    expect(() => assertSponsorCanCreateCompetition(row('PUBLISHED', 1), NOW)).toThrow(
      'CREATE_COOLDOWN',
    );
    expect(() => assertSponsorCanCreateCompetition(row('LOCKED', 10), NOW)).toThrow(
      'CREATE_COOLDOWN',
    );
    expect(() => assertSponsorCanCreateCompetition(row('PUBLISHED', 25), NOW)).not.toThrow();
    expect(() => assertSponsorCanCreateCompetition(row('SETTLED', 25), NOW)).not.toThrow();
  });

  it('starts the accept clock from publishedAt, not createdAt', () => {
    const createdAt = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);
    const publishedAt = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
    const latest: SponsorCreateGateRow = {
      status: 'PUBLISHED',
      createdAt,
      publishedAt,
      reviewedAt: publishedAt,
    };
    expect(sponsorCreateDecisionAt(latest)).toEqual(publishedAt);
    expect(() => assertSponsorCanCreateCompetition(latest, NOW)).toThrow('CREATE_COOLDOWN');
  });

  it('uses a 24 hour window', () => {
    expect(SPONSOR_CREATE_COOLDOWN_MS).toBe(24 * 60 * 60 * 1000);
  });
});
