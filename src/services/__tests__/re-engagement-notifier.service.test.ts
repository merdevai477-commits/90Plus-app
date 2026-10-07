const prismaMock = {
  user: { findMany: jest.fn() },
  notification: { groupBy: jest.fn() },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../notify.service', () => ({
  notifyUsers: jest.fn(async (list: unknown[]) => ({ delivered: list.length, suppressed: 0, failed: 0 })),
}));
jest.mock('../notification.service', () => ({
  NotificationType: { RE_ENGAGEMENT: 'RE_ENGAGEMENT' },
}));

import { notifyUsers } from '../notify.service';
import {
  buildReEngagementMessage,
  runReEngagement,
  tierForInactivity,
} from '../re-engagement-notifier.service';
import { resolvePushFirstName } from '../../utils/push-display-name';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('resolvePushFirstName', () => {
  it('uses the first word of the display name', () => {
    expect(resolvePushFirstName({ displayName: 'mohamed ali', username: 'x' })).toBe('Mohamed');
    expect(resolvePushFirstName({ displayName: 'محمد أحمد', username: 'x' })).toBe('محمد');
  });

  it('strips the auto-generated clerk suffix from usernames', () => {
    expect(
      resolvePushFirstName({
        displayName: 'mohamed_ab12cd34',
        username: 'mohamed_ab12cd34',
        clerkUserId: 'user_2xYzQwab12cd34',
      }),
    ).toBe('Mohamed');
  });

  it('returns null for placeholder accounts', () => {
    expect(
      resolvePushFirstName({
        displayName: 'user_2xYzQwab12cd',
        username: 'user_2xYzQwab12cd',
        clerkUserId: 'user_2xYzQwab12cd',
      }),
    ).toBeNull();
    expect(resolvePushFirstName({ displayName: '', username: '' })).toBeNull();
  });
});

describe('tierForInactivity', () => {
  it('maps absence length to a tier and stops after 90 days', () => {
    expect(tierForInactivity(6 * HOUR)).toBeNull();
    expect(tierForInactivity(13 * HOUR)).toBe('short');
    expect(tierForInactivity(5 * DAY)).toBe('miss');
    expect(tierForInactivity(30 * DAY)).toBe('comeback');
    expect(tierForInactivity(120 * DAY)).toBeNull();
  });
});

describe('buildReEngagementMessage', () => {
  const now = new Date('2026-10-07T10:00:00.000Z');

  it('addresses the user by name in their language', () => {
    const ar = buildReEngagementMessage({ userId: 'u1', tier: 'short', language: 'ar', firstName: 'محمد', now });
    const en = buildReEngagementMessage({ userId: 'u1', tier: 'short', language: 'en', firstName: 'Mohamed', now });
    expect(ar.title).toContain('محمد');
    expect(ar.title).toMatch(/[\u0600-\u06FF]/);
    expect(en.title).toContain('Mohamed');
    expect(en.title).not.toMatch(/[\u0600-\u06FF]/);
    expect(ar.variantId).toBe(en.variantId);
  });

  it('falls back to a generic vocative when no name is known', () => {
    const ar = buildReEngagementMessage({ userId: 'u1', tier: 'miss', language: 'ar', firstName: null, now });
    const en = buildReEngagementMessage({ userId: 'u1', tier: 'miss', language: 'en', firstName: null, now });
    expect(ar.title).toContain('بطل');
    expect(en.title).toContain('champ');
    expect(ar.title).not.toContain('{name}');
  });

  it('rotates to a different variant on consecutive days', () => {
    const today = buildReEngagementMessage({ userId: 'u1', tier: 'short', language: 'en', firstName: 'A', now });
    const tomorrow = buildReEngagementMessage({
      userId: 'u1',
      tier: 'short',
      language: 'en',
      firstName: 'A',
      now: new Date(now.getTime() + DAY),
    });
    expect(today.variantId).not.toBe(tomorrow.variantId);
  });
});

describe('runReEngagement', () => {
  const now = new Date('2026-10-07T10:02:00.000Z'); // 13:02 Cairo (UTC+3 DST), 19:02 Tokyo

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.notification.groupBy.mockResolvedValue([]);
  });

  function user(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      username: `${id}_name`,
      displayName: 'Omar Hassan',
      clerkUserId: null,
      settings: { language: 'en' },
      lastLoginDate: new Date(now.getTime() - 20 * HOUR),
      lastActiveAt: null,
      createdAt: new Date(now.getTime() - 60 * DAY),
      ...overrides,
    };
  }

  it('sends localized, named pushes to users whose local hour is a send slot', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      user('cairo'),
      user('tokyo', { settings: { language: 'ar', timezone: 'Asia/Tokyo' } }),
    ]);

    const result = await runReEngagement({ now });

    expect(result.eligible).toBe(1);
    const sent = (notifyUsers as jest.Mock).mock.calls[0][0];
    expect(sent).toHaveLength(1);
    expect(sent[0].userId).toBe('cairo');
    expect(sent[0].title).toContain('Omar');
    expect(sent[0].language).toBe('en');
    expect(sent[0].idempotencyKey).toBe('re-engagement:cairo:2026-10-07');
    expect(sent[0].data.tier).toBe('short');
  });

  it('respects the per-tier minimum gap since the last re-engagement push', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([user('recent'), user('due')]);
    prismaMock.notification.groupBy.mockResolvedValueOnce([
      { userId: 'recent', _max: { createdAt: new Date(now.getTime() - 10 * HOUR) } },
      { userId: 'due', _max: { createdAt: new Date(now.getTime() - 25 * HOUR) } },
    ]);

    await runReEngagement({ now });

    const sent = (notifyUsers as jest.Mock).mock.calls[0][0];
    expect(sent.map((p: { userId: string }) => p.userId)).toEqual(['due']);
  });

  it('skips users dormant for more than 90 days', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      user('dormant', {
        lastLoginDate: new Date(now.getTime() - 120 * DAY),
        createdAt: new Date(now.getTime() - 200 * DAY),
      }),
    ]);

    const result = await runReEngagement({ now });

    expect(result.eligible).toBe(0);
    expect(notifyUsers).not.toHaveBeenCalled();
  });
});
