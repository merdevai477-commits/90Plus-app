import type { Request } from 'express';
import {
  isLiveFootballFreshBypassPath,
  shouldHonorFreshCacheBypass,
  shouldHonorPullCacheBypass,
  isPullRefreshBypassPath,
} from '../cache-bypass.util';

function mockReq(path: string, query: Record<string, string> = {}, baseUrl = '/api/football'): Request {
  return {
    baseUrl,
    path,
    query,
  } as unknown as Request;
}

describe('cache-bypass.util', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('isLiveFootballFreshBypassPath', () => {
    it('matches live list', () => {
      expect(isLiveFootballFreshBypassPath(mockReq('/fixtures/live'))).toBe(true);
    });

    it('matches fixture by id', () => {
      expect(isLiveFootballFreshBypassPath(mockReq('/fixtures/12345'))).toBe(true);
    });

    it('matches fixture events', () => {
      expect(isLiveFootballFreshBypassPath(mockReq('/fixtures/12345/events'))).toBe(true);
    });

    it('does not match lineups', () => {
      expect(isLiveFootballFreshBypassPath(mockReq('/fixtures/12345/lineups'))).toBe(false);
    });
  });

  describe('shouldHonorFreshCacheBypass', () => {
    it('allows all fresh bypasses in development', () => {
      process.env.NODE_ENV = 'development';
      expect(
        shouldHonorFreshCacheBypass(mockReq('/teams/all-logos', { fresh: '1' })),
      ).toBe(true);
    });

    it('allows live paths with fresh=1 in production', () => {
      process.env.NODE_ENV = 'production';
      expect(
        shouldHonorFreshCacheBypass(mockReq('/fixtures/99', { fresh: '1' })),
      ).toBe(true);
    });

    it('blocks non-live paths in production even with fresh=1', () => {
      process.env.NODE_ENV = 'production';
      expect(
        shouldHonorFreshCacheBypass(mockReq('/teams/all-logos', { fresh: '1' })),
      ).toBe(false);
    });

    it('returns false when fresh is not requested', () => {
      process.env.NODE_ENV = 'production';
      expect(shouldHonorFreshCacheBypass(mockReq('/fixtures/99'))).toBe(false);
    });
  });

  describe('pull=1 cache bypass', () => {
    it('matches details, calendar, and live list', () => {
      expect(isPullRefreshBypassPath(mockReq('/cached/fixture/99/details'))).toBe(true);
      expect(isPullRefreshBypassPath(mockReq('/cached/matches/2026-09-08'))).toBe(true);
      expect(isPullRefreshBypassPath(mockReq('/fixtures/live'))).toBe(true);
    });

    it('does not treat pull as a 365 force path for lineups', () => {
      expect(isPullRefreshBypassPath(mockReq('/cached/fixture/99/lineups'))).toBe(false);
    });

    it('honors pull=1 on details in production', () => {
      process.env.NODE_ENV = 'production';
      expect(
        shouldHonorPullCacheBypass(mockReq('/cached/fixture/99/details', { pull: '1' })),
      ).toBe(true);
    });

    it('does not honor pull without the query', () => {
      expect(shouldHonorPullCacheBypass(mockReq('/cached/fixture/99/details'))).toBe(false);
    });

    it('does not honor pull as a fresh=1 365 bypass', () => {
      process.env.NODE_ENV = 'production';
      expect(
        shouldHonorFreshCacheBypass(mockReq('/cached/fixture/99/details', { pull: '1' })),
      ).toBe(false);
    });
  });
});
