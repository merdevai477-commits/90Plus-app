/**
 * Daily message quota (ChatLimit): one credit per submitted chat message on a
 * rolling 24h window. Pins the existing behaviour that voice transcription
 * must not alter.
 */

type Row = { userId: string; count: number; date: string };
const rows = new Map<string, Row>();

const fakePrisma = {
  chatLimit: {
    findUnique: jest.fn(async ({ where }: any) => (rows.has(where.userId) ? { ...rows.get(where.userId)! } : null)),
    upsert: jest.fn(async ({ where, update, create }: any) => {
      const next = rows.has(where.userId) ? { ...rows.get(where.userId)!, ...update } : create;
      rows.set(where.userId, next);
      return next;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows.get(where.userId)!;
      if (data.count?.increment) row.count += data.count.increment;
      if (data.count?.decrement) row.count -= data.count.decrement;
      return row;
    }),
  },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, prisma: fakePrisma, default: fakePrisma }));

import {
  decrementLimit,
  getDailyMessageLimit,
  getRemaining,
  getResetTimeForUser,
  incrementLimit,
} from '../chat.service';

const USER = 'user_message_quota';
const T0 = new Date('2026-10-13T10:00:00.000Z');
const LIMIT = getDailyMessageLimit();

beforeEach(() => {
  rows.clear();
  jest.useFakeTimers().setSystemTime(T0);
});

afterEach(() => jest.useRealTimers());

describe('chat message quota', () => {
  it('starts full and each submitted message consumes one credit', async () => {
    expect(await getRemaining(USER, 'UTC')).toBe(LIMIT);
    await incrementLimit(USER, 'UTC');
    await incrementLimit(USER, 'UTC');
    expect(await getRemaining(USER, 'UTC')).toBe(LIMIT - 2);
  });

  it('a refunded failure gives the credit back but never goes below zero used', async () => {
    await incrementLimit(USER, 'UTC');
    await decrementLimit(USER, 'UTC');
    await decrementLimit(USER, 'UTC');
    expect(await getRemaining(USER, 'UTC')).toBe(LIMIT);
    expect(rows.get(USER)!.count).toBe(0);
  });

  it('remaining never drops below zero', async () => {
    for (let i = 0; i < LIMIT + 2; i += 1) await incrementLimit(USER, 'UTC');
    expect(await getRemaining(USER, 'UTC')).toBe(0);
  });

  it('resets on a rolling 24h window from the first message', async () => {
    await incrementLimit(USER, 'UTC');
    expect((await getResetTimeForUser(USER)).toISOString()).toBe('2026-10-14T10:00:00.000Z');

    jest.setSystemTime(new Date('2026-10-14T09:59:00.000Z'));
    expect(await getRemaining(USER, 'UTC')).toBe(LIMIT - 1);

    jest.setSystemTime(new Date('2026-10-14T10:00:00.000Z'));
    expect(await getRemaining(USER, 'UTC')).toBe(LIMIT);
    await incrementLimit(USER, 'UTC');
    expect(rows.get(USER)!.count).toBe(1);
    expect((await getResetTimeForUser(USER)).toISOString()).toBe('2026-10-15T10:00:00.000Z');
  });
});
