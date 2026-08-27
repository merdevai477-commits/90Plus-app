/**
 * The global `clerkMiddleware()` leaves `req.auth` as a *function*, so
 * `req.auth?.userId` is undefined on any route that has not been through
 * `requireAuth` or `optionalAuth`. Every competitions handler resolves the
 * caller with `req.auth?.userId`, so a public-but-personalised route missing
 * `optionalAuth` silently degrades every signed-in user to anonymous:
 * `myEntry` comes back null on the hub and the detail screen, and `tab=mine`
 * 401s for a user who is very much signed in.
 *
 * This asserts the wiring rather than the behaviour, because the failure is
 * invisible at the handler level — the code reads fine and simply never sees
 * a user id.
 */

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../middleware/responseCache.middleware', () => ({
  responseCacheMiddleware: () => (_req: any, _res: any, next: any) => next(),
  clearResponseCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../middleware/clerk.middleware', () => ({
  requireAuth: function requireAuth(_req: any, _res: any, next: any) {
    next();
  },
  optionalAuth: function optionalAuth(_req: any, _res: any, next: any) {
    next();
  },
}));
jest.mock('../../services/competitions.service', () => ({
  createCompetition: jest.fn(),
  getCompetition: jest.fn(),
  getMatchPool: jest.fn(),
  listCompetitions: jest.fn(),
  listMyCompetitions: jest.fn(),
  listPrizeCategories: jest.fn(),
  submitPrediction: jest.fn(),
  updateOwnCompetition: jest.fn(),
}));
jest.mock('../../services/competition-match-pool.service', () => ({ POOL_SIZE: 10 }));

import router from '../competitions.routes';

interface RouteInfo {
  method: string;
  path: string;
  middleware: string[];
}

function routes(): RouteInfo[] {
  return (router as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
      middleware: layer.route.stack.map((s: any) => s.name),
    }));
}

function find(method: string, path: string): RouteInfo {
  const hit = routes().find((r) => r.method === method && r.path === path);
  if (!hit) throw new Error(`route ${method} ${path} is not registered`);
  return hit;
}

describe('competitions routes — auth wiring', () => {
  it.each([
    ['GET', '/'],
    ['GET', '/:id'],
  ])('%s %s runs optionalAuth so a signed-in caller is recognised', (method, path) => {
    expect(find(method, path).middleware).toContain('optionalAuth');
  });

  it.each([
    ['GET', '/match-pool'],
    ['GET', '/mine'],
    ['POST', '/:id/predict'],
    ['POST', '/'],
    ['PATCH', '/:id'],
  ])('%s %s is behind requireAuth', (method, path) => {
    expect(find(method, path).middleware).toContain('requireAuth');
  });

  it('never leaves a handler that resolves a user without an auth middleware', () => {
    const unguarded = routes().filter(
      (r) => !r.middleware.some((m) => m === 'requireAuth' || m === 'optionalAuth'),
    );
    // `/prize-categories` is the one genuinely anonymous route: a static,
    // cacheable list with nothing user-scoped in it.
    expect(unguarded.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /prize-categories']);
  });

  it('registers /mine and /match-pool before the /:id catch-all', () => {
    const paths = routes().map((r) => r.path);
    expect(paths.indexOf('/mine')).toBeLessThan(paths.indexOf('/:id'));
    expect(paths.indexOf('/match-pool')).toBeLessThan(paths.indexOf('/:id'));
    expect(paths.indexOf('/prize-categories')).toBeLessThan(paths.indexOf('/:id'));
  });
});
