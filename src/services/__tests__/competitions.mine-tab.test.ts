/**
 * Regression tests for "I created a challenge and it never appeared".
 *
 * A sponsor's competition is created as `DRAFT` and only becomes public when an
 * admin publishes it — that rule is intentional and unchanged. What was broken
 * is that the sponsor had nowhere to see their own submission afterwards:
 * "تحدياتي" filtered on `entries.some({ userId })`, i.e. competitions the user
 * *entered*, never ones they *created*. The wizard promised "سيتم مراجعتها
 * ونشرها قريباً" and the challenge then vanished from the app entirely, with no
 * way to tell a successful submission from a failed one.
 *
 * These pin both halves: the owner sees their DRAFT, and nobody else does.
 */

import { listCompetitions, getCompetition } from '../competitions.service';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    competition: { findMany: jest.fn(), findFirst: jest.fn() },
    sponsor: { findFirst: jest.fn() },
  },
}));

const findMany = (prisma as any).competition.findMany as jest.Mock;
const findFirst = (prisma as any).competition.findFirst as jest.Mock;
const sponsorFindFirst = (prisma as any).sponsor.findFirst as jest.Mock;

const USER = 'user-1';
const SPONSOR = 'sponsor-1';

beforeEach(() => {
  jest.clearAllMocks();
  findMany.mockResolvedValue([]);
});

/** The `where` the service handed Prisma for the last query. */
function lastWhere() {
  return findMany.mock.calls[0][0].where;
}

describe('the "تحدياتي" tab', () => {
  it('includes the competitions the sponsor created, whatever their status', async () => {
    sponsorFindFirst.mockResolvedValue({ id: SPONSOR });
    await listCompetitions({ userId: USER, tab: 'mine' });

    const where = lastWhere();
    // No top-level status gate — it would re-hide DRAFT.
    expect(where.status).toBeUndefined();
    expect(where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ sponsorId: SPONSOR })]),
    );

    // The owned branch carries no status filter at all: DRAFT and REJECTED are
    // exactly what the sponsor needs to see.
    const owned = where.OR.find((b: any) => b.sponsorId === SPONSOR);
    expect(owned.status).toBeUndefined();
  });

  it('still includes the competitions the user entered', async () => {
    sponsorFindFirst.mockResolvedValue({ id: SPONSOR });
    await listCompetitions({ userId: USER, tab: 'mine' });

    const entered = lastWhere().OR.find((b: any) => b.entries);
    expect(entered.entries).toEqual({ some: { userId: USER } });
    // Entered competitions keep the readable set, so a postponed match the user
    // predicted on stays in their history.
    expect(entered.status).toEqual({
      in: ['PUBLISHED', 'LOCKED', 'SETTLED', 'CANCELLED'],
    });
    expect(entered.sponsor).toEqual(expect.objectContaining({ isActive: true }));
  });

  it('asks for entered competitions only when the user owns no sponsor', async () => {
    sponsorFindFirst.mockResolvedValue(null);
    await listCompetitions({ userId: USER, tab: 'mine' });

    expect(lastWhere().OR).toHaveLength(1);
    expect(lastWhere().OR[0].entries).toBeDefined();
  });

  it('narrows the entered half when the sponsored filter is also on', async () => {
    sponsorFindFirst.mockResolvedValue({ id: SPONSOR });
    await listCompetitions({ userId: USER, tab: 'mine', filter: 'sponsored' });

    const entered = lastWhere().OR.find((b: any) => b.entries);
    expect(entered.sponsor).toEqual({ isActive: true, isVerified: true });
  });

  it('requires a session', async () => {
    await expect(listCompetitions({ userId: null, tab: 'mine' })).rejects.toThrow('AUTH_REQUIRED');
  });
});

describe('public surfaces never leak a DRAFT', () => {
  it.each(['all', 'today', 'sponsored'] as const)('tab=%s asks only for public statuses', async (tab) => {
    await listCompetitions({ userId: USER, tab });
    expect(lastWhere().status).toEqual({ in: ['PUBLISHED', 'LOCKED', 'SETTLED'] });
    // `today` uses OR for match-day vs published-today — never for status.
    if (tab !== 'today') expect(lastWhere().OR).toBeUndefined();
  });

  it('an anonymous browse asks only for public statuses', async () => {
    await listCompetitions({ userId: null, tab: 'all' });
    expect(lastWhere().status).toEqual({ in: ['PUBLISHED', 'LOCKED', 'SETTLED'] });
  });

  it('the today tab includes match-day rows and prizes published today', async () => {
    await listCompetitions({ userId: null, tab: 'today' });
    const or = lastWhere().OR;
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ matchDate: expect.objectContaining({ gte: expect.any(Date) }) }),
        expect.objectContaining({ publishedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
      ]),
    );
  });
});

describe('opening a competition', () => {
  it('lets the owning sponsor read their own draft', async () => {
    findFirst.mockResolvedValue({ id: 'c1', status: 'DRAFT', entries: [] });
    await getCompetition('c1', USER);

    const or = findFirst.mock.calls[0][0].where.OR;
    expect(or).toEqual(
      expect.arrayContaining([{ sponsor: { ownerId: USER } }]),
    );
  });

  it('offers an anonymous reader only the readable set', async () => {
    findFirst.mockResolvedValue({ id: 'c1', status: 'PUBLISHED' });
    await getCompetition('c1', null);

    const or = findFirst.mock.calls[0][0].where.OR;
    expect(or).toHaveLength(1);
    expect(or[0].status).toEqual({ in: ['PUBLISHED', 'LOCKED', 'SETTLED', 'CANCELLED'] });
  });

  it('still 404s when nothing matches', async () => {
    findFirst.mockResolvedValue(null);
    await expect(getCompetition('nope', USER)).rejects.toThrow('COMPETITION_NOT_FOUND');
  });
});
