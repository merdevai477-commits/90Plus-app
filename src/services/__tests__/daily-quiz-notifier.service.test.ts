import { Prisma } from '@prisma/client';

const prismaMock = {
  quizAttempt: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { logger } from '../../utils/logger';
import {
  findRecentQuizAttemptUserIds,
  getEligibleQuizUsers,
  quizAttemptActiveSinceWhere,
} from '../daily-quiz-notifier.service';

describe('daily-quiz-notifier QuizAttempt query (BACKEND-2V)', () => {
  const since = new Date('2026-09-01T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses completedAt — QuizAttempt has no createdAt on the Prisma schema', () => {
    expect(Prisma.QuizAttemptScalarFieldEnum.completedAt).toBe('completedAt');
    expect('createdAt' in Prisma.QuizAttemptScalarFieldEnum).toBe(false);
    expect(quizAttemptActiveSinceWhere(since)).toEqual({
      completedAt: { gte: since },
    });
  });

  it('findMany is called with completedAt (not createdAt)', async () => {
    prismaMock.quizAttempt.findMany.mockResolvedValue([{ userId: 'u1' }]);
    await findRecentQuizAttemptUserIds(since);
    expect(prismaMock.quizAttempt.findMany).toHaveBeenCalledWith({
      where: { completedAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId'],
    });
  });

  it('does not swallow Prisma errors as an empty eligible list', async () => {
    const boom = new Error('Unknown argument `createdAt`');
    prismaMock.quizAttempt.findMany.mockRejectedValue(boom);
    await expect(findRecentQuizAttemptUserIds(since)).rejects.toThrow('Unknown argument');
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns users who completed a quiz in the window and have push consent', async () => {
    prismaMock.quizAttempt.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', expoPushToken: 'ExponentPushToken[aaa]', settings: { language: 'en' } },
    ]);
    const users = await getEligibleQuizUsers();
    expect(users).toEqual([
      { id: 'u1', expoPushToken: 'ExponentPushToken[aaa]', settings: { language: 'en' } },
    ]);
    const where = prismaMock.quizAttempt.findMany.mock.calls[0][0].where;
    expect(where.completedAt).toBeDefined();
    expect(where.createdAt).toBeUndefined();
  });
});
