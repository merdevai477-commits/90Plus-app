import type { Request, Response, NextFunction } from 'express';
import {
  responseCacheMiddleware,
  responseCache,
} from '../responseCache.middleware';

jest.mock('../../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
    delPattern: jest.fn(async () => undefined),
  },
}));

describe('responseCacheMiddleware MISS headers (P1-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets Cache-Control, ETag, and X-Cache: MISS before the body is sent', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const headers: Record<string, string> = {};
    let jsonBody: unknown = null;
    let jsonCalled = false;

    const req = {
      method: 'GET',
      path: '/api/football/cached/matches/2026-09-04',
      originalUrl: '/api/football/cached/matches/2026-09-04',
      url: '/api/football/cached/matches/2026-09-04',
      query: {},
      headers: {},
      get: () => undefined,
    } as unknown as Request;

    const res = {
      statusCode: 200,
      setHeader: jest.fn((k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      }),
      getHeader: (k: string) => headers[k.toLowerCase()],
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      json: jest.fn(function (this: Response, body: unknown) {
        jsonCalled = true;
        // Headers must already be present when json runs (P1-4).
        expect(headers['etag']).toMatch(/^"[a-f0-9]{32}"$/);
        expect(headers['x-cache']).toBe('MISS');
        expect(headers['cache-control']).toBe('public, max-age=60');
        jsonBody = body;
        return this;
      }),
    } as unknown as Response;

    const next: NextFunction = jest.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    const body = { status: 'SUCCESS', results: 1, response: [{ id: 1 }] };
    (res as any).json(body);

    expect(jsonCalled).toBe(true);
    expect(jsonBody).toEqual(body);
    expect(headers['etag']).toBe(`"${responseCache.generateETag(body)}"`);
  });

  it('emits strong ETag matching HIT path form', () => {
    const etag = responseCache.generateETag({ status: 'SUCCESS', response: [] });
    expect(etag).toMatch(/^[a-f0-9]{32}$/);
    expect(etag.startsWith('W/')).toBe(false);
  });

  it('does not alter non-cacheable response body path', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const headers: Record<string, string> = {};
    const req = {
      method: 'GET',
      path: '/api/test',
      originalUrl: '/api/test',
      url: '/api/test',
      query: {},
      headers: {},
      get: () => undefined,
    } as unknown as Request;
    const res = {
      statusCode: 500,
      setHeader: jest.fn((k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      }),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      json: jest.fn(function (this: Response, body: unknown) {
        return body;
      }),
    } as unknown as Response;
    const next: NextFunction = jest.fn();
    await middleware(req, res, next);
    const out = (res as any).json({ status: 'ERROR', message: 'fail' });
    expect(out).toEqual({ status: 'ERROR', message: 'fail' });
    expect(headers['x-cache']).toBe('SKIP');
    expect(headers['etag']).toBeUndefined();
  });
});
