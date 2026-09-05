import { Prisma } from '@prisma/client';

const prismaMock = {
  userDailyQuizSession: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../notify.service', () => ({
  notifyUsers: jest.fn(async () => ({ delivered: 0, suppressed: 0, failed: 0 })),
}));

import { logger } from '../../utils/logger';
import { notifyUsers } from '../notify.service';
import {
  QUIZ_SESSION_ACTIVE_WINDOW_DAYS,
  addUtcCalendarDays,
  dailyQuizSessionEligibilityWhere,
  findRecentDailyQuizUserIds,
  getEligibleQuizUsers,
  quizNotifierWindow,
  runDailyQuizNotifier,
  sessionQualifiesForDailyQuizPing,
  utcCalendarDate,
} from '../daily-quiz-notifier.service';

const NOW = new Date('2026-09-06T07:00:00.000Z');

describe('daily-quiz-notifier UserDailyQuizSession query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses UserDailyQuizSession fields from the Prisma schema (not QuizAttempt)', () => {
    expect(Prisma.UserDailyQuizSessionScalarFieldEnum.packDate).toBe('packDate');
    expect(Prisma.UserDailyQuizSessionScalarFieldEnum.completedAt).toBe('completedAt');
    expect(Prisma.UserDailyQuizSessionScalarFieldEnum.answeredCount).toBe('answeredCount');
    expect(Prisma.UserDailyQuizSessionScalarFieldEnum.userId).toBe('userId');
    expect('createdAt' in Prisma.QuizAttemptScalarFieldEnum).toBe(false);
  });

  it('windows packDate to the last 7 UTC days excluding today', () => {
    const { today, yesterday, windowStart } = quizNotifierWindow(NOW);
    expect(today.toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(yesterday.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(windowStart.toISOString()).toBe('2026-08-30T00:00:00.000Z');
    expect(QUIZ_SESSION_ACTIVE_WINDOW_DAYS).toBe(7);
    expect(addUtcCalendarDays(utcCalendarDate(NOW), -1).toISOString()).toBe(yesterday.toISOString());
  });

  it('requires a completed or answered session in-window and skips users who already finished today', () => {
    const where = dailyQuizSessionEligibilityWhere(NOW);
    expect(where.packDate).toEqual({
      gte: new Date('2026-08-30T00:00:00.000Z'),
      lte: new Date('2026-09-05T00:00:00.000Z'),
    });
    expect(where.OR).toEqual([
      { completedAt: { not: null } },
      { answeredCount: { gt: 0 } },
    ]);
    expect(where.user).toEqual({
      dailyQuizSessions: {
        none: {
          packDate: new Date('2026-09-06T00:00:00.000Z'),
          completedAt: { not: null },
        },
      },
    });
  });

  it('classifies completed vs unanswered vs old vs already-done-today fixtures', () => {
    const pack = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
    const at = { now: NOW, alreadyCompletedToday: false as boolean };
    expect(sessionQualifiesForDailyQuizPing(
      { packDate: pack('2026-09-05'), completedAt: NOW, answeredCount: 15 },
      at,
    )).toBe(true);
    expect(sessionQualifiesForDailyQuizPing(
      { packDate: pack('2026-09-04'), completedAt: null, answeredCount: 6 },
      at,
    )).toBe(true);
    expect(sessionQualifiesForDailyQuizPing(
      { packDate: pack('2026-09-04'), completedAt: null, answeredCount: 0 },
      at,
    )).toBe(false);
    expect(sessionQualifiesForDailyQuizPing(
      { packDate: pack('2026-08-20'), completedAt: NOW, answeredCount: 15 },
      at,
    )).toBe(false);
    expect(sessionQualifiesForDailyQuizPing(
      { packDate: pack('2026-09-05'), completedAt: NOW, answeredCount: 15 },
      { now: NOW, alreadyCompletedToday: true },
    )).toBe(false);
  });

  it('findMany is called against userDailyQuizSession with the eligibility where', async () => {
    prismaMock.userDailyQuizSession.findMany.mockResolvedValue([{ userId: 'u1' }]);
    await findRecentDailyQuizUserIds(NOW);
    expect(prismaMock.userDailyQuizSession.findMany).toHaveBeenCalledWith({
      where: dailyQuizSessionEligibilityWhere(NOW),
      select: { userId: true },
      distinct: ['userId'],
    });
  });

  it('does not swallow Prisma errors as an empty eligible list', async () => {
    const boom = new Error('Unknown argument `createdAt`');
    prismaMock.userDailyQuizSession.findMany.mockRejectedValue(boom);
    await expect(findRecentDailyQuizUserIds(NOW)).rejects.toThrow('Unknown argument');
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns push-consented users who played recently and have not finished today', async () => {
    prismaMock.userDailyQuizSession.findMany.mockResolvedValue([{ userId: 'played' }, { userId: 'no-push' }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'played', expoPushToken: 'ExponentPushToken[aaa]', settings: { language: 'ar' } },
    ]);
    const users = await getEligibleQuizUsers(NOW);
    expect(users).toEqual([
      { id: 'played', expoPushToken: 'ExponentPushToken[aaa]', settings: { language: 'ar' } },
    ]);
  });

  it('dry-run identifies candidates without sending pushes', async () => {
    prismaMock.userDailyQuizSession.findMany.mockResolvedValue([{ userId: 'played' }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'played', expoPushToken: 'ExponentPushToken[aaa]', settings: {} },
    ]);
    const result = await runDailyQuizNotifier({ dryRun: true, now: NOW });
    expect(result).toEqual({ eligible: 1, dryRun: true });
    expect(notifyUsers).not.toHaveBeenCalled();
  });

  it('rethrows after logger.error when the send path fails', async () => {
    prismaMock.userDailyQuizSession.findMany.mockResolvedValue([{ userId: 'played' }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'played', expoPushToken: 'ExponentPushToken[aaa]', settings: {} },
    ]);
    (notifyUsers as jest.Mock).mockRejectedValueOnce(new Error('expo down'));
    await expect(runDailyQuizNotifier({ now: NOW })).rejects.toThrow('expo down');
    expect(logger.error).toHaveBeenCalled();
  });
});
