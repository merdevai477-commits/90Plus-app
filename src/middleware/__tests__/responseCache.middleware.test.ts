import type { Request, Response, NextFunction } from 'express';
import {
  responseCacheMiddleware,
  responseCache,
  clearResponseCache,
  handleInvalidationMessage,
} from '../responseCache.middleware';

jest.mock('../../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
    delPattern: jest.fn(async () => undefined),
  },
}));

const makeReq = (path: string, headers: Record<string, string> = {}): Request =>
  ({
    method: 'GET',
    path,
    originalUrl: path,
    url: path,
    query: {},
    headers,
    get: () => undefined,
  }) as unknown as Request;

const makeRes = (statusCode = 200) => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode,
    headers,
    sent: undefined as unknown,
    setHeader: jest.fn((k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    }),
    getHeader: (k: string) => headers[k.toLowerCase()],
    status: jest.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    end: jest.fn(),
    send: jest.fn(function (this: any, body: unknown) {
      this.sent = body;
      return this;
    }),
    json: jest.fn(function (this: any, body: unknown) {
      this.sent = body;
      return this;
    }),
  };
  return res as typeof res & Response;
};

describe('responseCacheMiddleware', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearResponseCache();
  });

  it('sets Cache-Control, ETag and X-Cache: MISS before sending the serialized body', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const req = makeReq('/api/football/cached/matches/2026-09-04');
    const res = makeRes();
    const next: NextFunction = jest.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    const body = { status: 'SUCCESS', results: 1, response: [{ id: 1 }] };
    res.send.mockImplementationOnce(function (this: any, payload: unknown) {
      expect(res.headers['etag']).toMatch(/^"[a-f0-9]{32}"$/);
      expect(res.headers['x-cache']).toBe('MISS');
      expect(res.headers['cache-control']).toBe('public, max-age=60');
      this.sent = payload;
      return this;
    });
    (res as any).json(body);

    expect(res.sent).toBe(JSON.stringify(body));
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.headers['etag']).toBe(`"${responseCache.generateETag(body)}"`);
  });

  it('serves a HIT from the stored string without serializing again', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const path = '/api/football/cached/matches/2026-09-05';
    const body = { status: 'SUCCESS', results: 1, response: [{ id: 7, name: 'x' }] };

    const first = makeRes();
    await middleware(makeReq(path), first, jest.fn());
    (first as any).json(body);

    const stringify = jest.spyOn(JSON, 'stringify');
    const second = makeRes();
    const next = jest.fn();
    await middleware(makeReq(path), second, next);
    expect(next).not.toHaveBeenCalled();
    expect(stringify).not.toHaveBeenCalledWith(body);
    stringify.mockRestore();

    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.headers['etag']).toBe(first.headers['etag']);
    expect(second.sent).toBe(JSON.stringify(body));
    expect(second.json).not.toHaveBeenCalled();
  });

  it('answers 304 when If-None-Match matches the cached ETag', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const path = '/api/football/cached/matches/2026-09-06';
    const first = makeRes();
    await middleware(makeReq(path), first, jest.fn());
    (first as any).json({ status: 'SUCCESS', results: 0, response: [] });

    const second = makeRes();
    await middleware(makeReq(path, { 'if-none-match': first.headers['etag'] }), second, jest.fn());
    expect(second.status).toHaveBeenCalledWith(304);
    expect(second.end).toHaveBeenCalled();
    expect(second.send).not.toHaveBeenCalled();
  });

  it('emits strong ETag matching HIT path form', () => {
    const etag = responseCache.generateETag({ status: 'SUCCESS', response: [] });
    expect(etag).toMatch(/^[a-f0-9]{32}$/);
    expect(etag.startsWith('W/')).toBe(false);
  });

  it('does not alter non-cacheable response body path', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const res = makeRes(500);
    await middleware(makeReq('/api/test'), res, jest.fn());
    (res as any).json({ status: 'ERROR', message: 'fail' });
    expect(res.sent).toEqual({ status: 'ERROR', message: 'fail' });
    expect(res.send).not.toHaveBeenCalled();
    expect(res.headers['x-cache']).toBe('SKIP');
    expect(res.headers['etag']).toBeUndefined();
  });

  it('drops L1 copies when another instance publishes an invalidation', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const path = '/api/predictions/user/stats';
    const first = makeRes();
    await middleware(makeReq(path), first, jest.fn());
    (first as any).json({ status: 'SUCCESS', data: { points: 1 } });
    expect(responseCache.size()).toBe(1);

    handleInvalidationMessage('not json');
    handleInvalidationMessage(JSON.stringify({ from: 'other-instance', pattern: '/reels' }));
    expect(responseCache.size()).toBe(1);

    handleInvalidationMessage(JSON.stringify({ from: 'other-instance', pattern: '/predictions/user' }));
    expect(responseCache.size()).toBe(0);
  });

  it('does not cache degraded fallbacks', async () => {
    const middleware = responseCacheMiddleware({ ttl: 60_000, sharedCache: true });
    const path = '/api/football/cached/matches/2026-09-07';
    const first = makeRes();
    await middleware(makeReq(path), first, jest.fn());
    (first as any).json({ status: 'SUCCESS', results: 0, response: [], degraded: true });
    expect(first.headers['x-cache']).toBe('SKIP');

    const next = jest.fn();
    await middleware(makeReq(path), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
