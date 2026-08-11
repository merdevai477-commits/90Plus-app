/**
 * Share & Win — referral, scoring and cycle rules.
 *
 * Prisma is mocked (the same pattern the other service suites use), so these
 * exercise the decision logic: who converts, who is rejected, how score is
 * computed and how weeks are keyed.
 */

import { Prisma } from '@prisma/client';

const prismaMock = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  shareWinCycle: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  shareWinReferral: { findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
  shareWinShareEvent: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
  shareWinStanding: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const awardXpMock = jest.fn().mockResolvedValue({ awarded: 50 });
jest.mock('../xp.service', () => ({
  awardXp: (...args: unknown[]) => awardXpMock(...args),
  XP_VALUES: { REFERRAL_CONVERSION: 50 },
}));

import {
  SCORE_PER_PARTICIPANT,
  SCORE_PER_SHARE,
  buildReferralLink,
  claimReferral,
  computeScore,
  isValidReferralCode,
  isoWeekKey,
  normalizeReferralCode,
} from '../share-win.service';

const NOW = new Date('2026-08-08T12:00:00.000Z');

/** A cycle lookup that always resolves, so claimReferral gets past ensureCurrentCycle. */
function stubActiveCycle() {
  prismaMock.shareWinCycle.findUnique.mockResolvedValue({
    id: 'cycle-1',
    weekKey: isoWeekKey(NOW),
    startAt: new Date('2026-08-03T00:00:00.000Z'),
    endAt: new Date('2026-08-10T00:00:00.000Z'),
    status: 'ACTIVE',
    prizes: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.shareWinShareEvent.count.mockResolvedValue(0);
  prismaMock.shareWinReferral.count.mockResolvedValue(0);
  prismaMock.shareWinStanding.upsert.mockResolvedValue({});
  prismaMock.$executeRaw.mockResolvedValue(0);
});

// ─── Referral codes ─────────────────────────────────────────────────────────

describe('referral codes', () => {
  test('normalizes case, whitespace and separators', () => {
    expect(normalizeReferralCode(' ab-23 cd ')).toBe('AB23CD');
    expect(normalizeReferralCode('ab23cd')).toBe('AB23CD');
  });

  test('accepts 6-char codes from the unambiguous alphabet only', () => {
    expect(isValidReferralCode('AB23CD')).toBe(true);
    expect(isValidReferralCode('ab23cd')).toBe(true);
    // O, 0, I and 1 are excluded so codes survive being read aloud.
    expect(isValidReferralCode('AB1OCD')).toBe(false);
    expect(isValidReferralCode('AB10CD')).toBe(false);
    expect(isValidReferralCode('AB23C')).toBe(false);
    expect(isValidReferralCode('AB23CDE')).toBe(false);
    expect(isValidReferralCode('')).toBe(false);
  });

  test('link is built from the shared base URL, never a hardcoded host here', () => {
    const link = buildReferralLink('AB23CD');
    expect(link.endsWith('/invite/AB23CD')).toBe(true);
    expect(link.startsWith('http')).toBe(true);
  });
});

// ─── Scoring ────────────────────────────────────────────────────────────────

describe('scoring', () => {
  test('score is participants × 3 and share-only actions add zero', () => {
    expect(computeScore(0, 0)).toBe(0);
    expect(computeScore(20, 100)).toBe(20 * SCORE_PER_PARTICIPANT + 100 * SCORE_PER_SHARE);
    expect(computeScore(20, 100)).toBe(60);
  });

  test('share-only events do not earn leaderboard points', () => {
    expect(computeScore(0, 1)).toBe(0);
    expect(computeScore(1, 1)).toBe(SCORE_PER_PARTICIPANT);
  });

  test('a brand-new user scores zero rather than undefined', () => {
    expect(computeScore(0, 0)).toBe(0);
  });
});

// ─── Weekly cycles ──────────────────────────────────────────────────────────

describe('weekly cycle keys', () => {
  test('every day of one ISO week maps to the same key', () => {
    const monday = isoWeekKey(new Date('2026-08-03T00:00:00Z'));
    const wednesday = isoWeekKey(new Date('2026-08-05T13:37:00Z'));
    const sunday = isoWeekKey(new Date('2026-08-09T23:59:59Z'));
    expect(wednesday).toBe(monday);
    expect(sunday).toBe(monday);
  });

  test('the next Monday starts a new key, so week 1 is never overwritten', () => {
    const week1 = isoWeekKey(new Date('2026-08-09T23:59:59Z'));
    const week2 = isoWeekKey(new Date('2026-08-10T00:00:00Z'));
    expect(week2).not.toBe(week1);
  });

  test('keys are sortable YYYY-Www strings', () => {
    expect(isoWeekKey(new Date('2026-01-05T00:00:00Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

// ─── Referral attribution ───────────────────────────────────────────────────

describe('claimReferral', () => {
  const REFERRER = { id: 'referrer-1', isDeleted: false, isBanned: false };
  const NEW_USER = { id: 'new-user', createdAt: new Date(NOW.getTime() - 60_000) };

  test('rejects a malformed code before touching the database', async () => {
    const result = await claimReferral('new-user', 'nope!', NOW);
    expect(result).toEqual({ attributed: false, reason: 'invalid_code' });
    expect(prismaMock.shareWinReferral.create).not.toHaveBeenCalled();
  });

  test('rejects an unknown code', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? null : NEW_USER,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue(null);

    const result = await claimReferral('new-user', 'AB23CD', NOW);
    expect(result).toEqual({ attributed: false, reason: 'unknown_code' });
  });

  test('rejects self-referral', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode
        ? { id: 'new-user', isDeleted: false, isBanned: false }
        : NEW_USER,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue(null);

    const result = await claimReferral('new-user', 'AB23CD', NOW);
    expect(result).toEqual({ attributed: false, reason: 'self_referral' });
    expect(prismaMock.shareWinReferral.create).not.toHaveBeenCalled();
  });

  test('rejects a user who already has a referrer', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? REFERRER : NEW_USER,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue({ id: 'existing' });

    const result = await claimReferral('new-user', 'AB23CD', NOW);
    expect(result).toEqual({ attributed: false, reason: 'already_attributed' });
    expect(prismaMock.shareWinReferral.create).not.toHaveBeenCalled();
  });

  test('rejects an existing user — accounts older than the window never convert', async () => {
    const oldUser = { id: 'old-user', createdAt: new Date(NOW.getTime() - 10 * 24 * 3600_000) };
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? REFERRER : oldUser,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue(null);

    const result = await claimReferral('old-user', 'AB23CD', NOW);
    expect(result).toEqual({ attributed: false, reason: 'not_a_new_user' });
    expect(prismaMock.shareWinReferral.create).not.toHaveBeenCalled();
  });

  test('rejects a banned or deleted referrer', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? { ...REFERRER, isBanned: true } : NEW_USER,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue(null);

    const result = await claimReferral('new-user', 'AB23CD', NOW);
    expect(result).toEqual({ attributed: false, reason: 'unknown_code' });
  });

  test('attributes a genuinely new user and awards the referrer XP once', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? REFERRER : NEW_USER,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue(null);
    prismaMock.shareWinReferral.create.mockResolvedValue({ id: 'ref-1' });
    stubActiveCycle();

    const result = await claimReferral('new-user', 'ab23cd', NOW);

    expect(result).toEqual({ attributed: true, reason: 'attributed' });
    expect(prismaMock.shareWinReferral.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referrerId: 'referrer-1',
          referredUserId: 'new-user',
          referralCode: 'AB23CD',
        }),
      }),
    );
    // Idempotency key is the referred user, so a retry cannot double-award.
    expect(awardXpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'referrer-1',
        action: 'REFERRAL_CONVERSION',
        idempotencyKey: 'share-win-referral:new-user',
      }),
    );
  });

  test('a lost registration race resolves to already_attributed, not a crash', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? REFERRER : NEW_USER,
    );
    prismaMock.shareWinReferral.findUnique.mockResolvedValue(null);
    stubActiveCycle();

    // The unique index on referredUserId fires inside the transaction.
    prismaMock.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await claimReferral('new-user', 'AB23CD', NOW);
    expect(result).toEqual({ attributed: false, reason: 'already_attributed' });
    expect(awardXpMock).not.toHaveBeenCalled();
  });

  test('repeated claims of the same code stay at one participant', async () => {
    prismaMock.user.findUnique.mockImplementation(({ where }: any) =>
      where.referralCode ? REFERRER : NEW_USER,
    );
    prismaMock.shareWinReferral.create.mockResolvedValue({ id: 'ref-1' });
    stubActiveCycle();

    prismaMock.shareWinReferral.findUnique.mockResolvedValueOnce(null);
    const first = await claimReferral('new-user', 'AB23CD', NOW);

    prismaMock.shareWinReferral.findUnique.mockResolvedValueOnce({ id: 'ref-1' });
    const second = await claimReferral('new-user', 'AB23CD', NOW);

    expect(first.attributed).toBe(true);
    expect(second.attributed).toBe(false);
    expect(prismaMock.shareWinReferral.create).toHaveBeenCalledTimes(1);
  });
});
