jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@clerk/express', () => ({
  clerkClient: { signInTokens: { createSignInToken: jest.fn() } },
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  CONCURRENT_ROTATION_GRACE_MS,
  isRecentConcurrentRotation,
} from '../device-session.service';

describe('device-session concurrent rotation grace', () => {
  it('treats a key rotated moments ago as concurrency, not theft', () => {
    const now = Date.parse('2026-10-31T12:00:00.000Z');
    expect(isRecentConcurrentRotation(new Date(now - 1_000), now)).toBe(true);
    expect(isRecentConcurrentRotation(new Date(now - CONCURRENT_ROTATION_GRACE_MS + 1), now)).toBe(
      true,
    );
  });

  it('treats an older revoked key as outside the grace window', () => {
    const now = Date.parse('2026-10-31T12:00:00.000Z');
    expect(isRecentConcurrentRotation(new Date(now - CONCURRENT_ROTATION_GRACE_MS), now)).toBe(
      false,
    );
    expect(isRecentConcurrentRotation(new Date(now - 5 * 60_000), now)).toBe(false);
    expect(isRecentConcurrentRotation(null, now)).toBe(false);
    expect(isRecentConcurrentRotation(undefined, now)).toBe(false);
  });
});
