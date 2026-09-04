/**
 * A throttled 365 upstream used to hold every match-details request hostage for the
 * full socket timeout (12s+). Once any good payload exists the request path must serve
 * it immediately and refresh out of band; a true cold miss waits only for a short budget.
 */

jest.mock('../lib/prisma', () => {
  const prisma = {
    cachedFixture: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { __esModule: true, prisma, default: prisma, withRetry: jest.fn() };
});

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function okResponse(game: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ game }),
  } as unknown as Response;
}

const GAME_ID = 4_752_417;
const liveGame = (score: number) => ({
  id: GAME_ID,
  statusGroup: 3,
  statusText: 'Live',
  homeCompetitor: { id: 1, name: 'Home', score },
  awayCompetitor: { id: 2, name: 'Away', score: 0 },
});

let svc: typeof import('../services/scores365-experiment.service');
const fetchMock = jest.fn();
let now = 1_000_000;

beforeAll(async () => {
  process.env.SCORES365_GAME_REQUEST_BUDGET_MS = '40';
  process.env.SCORES365_CACHE_MS = '2000';
  (global as any).fetch = fetchMock;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  svc = await import('../services/scores365-experiment.service');
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('fetchScores365GameById stale-while-revalidate', () => {
  it('serves the last good payload without waiting on a slow refresh', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(liveGame(0)));
    const first = await svc.fetchScores365GameById(GAME_ID, { language: 'en' });
    expect(first?.homeCompetitor?.score).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Within the memory TTL: no upstream call at all.
    await svc.fetchScores365GameById(GAME_ID, { language: 'en' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // TTL expired, upstream is hanging: caller gets last-good immediately.
    now += 5_000;
    const hanging = deferred<Response>();
    fetchMock.mockReturnValueOnce(hanging.promise);
    const startedAt = performance.now();
    const stale = await svc.fetchScores365GameById(GAME_ID, { language: 'en' });
    expect(performance.now() - startedAt).toBeLessThan(30);
    expect(stale?.homeCompetitor?.score).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Concurrent stale readers share the single in-flight refresh.
    await svc.fetchScores365GameById(GAME_ID, { language: 'en' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Once the refresh lands, the next read sees the new score.
    hanging.resolve(okResponse(liveGame(1)));
    await new Promise((r) => setImmediate(r));
    const fresh = await svc.fetchScores365GameById(GAME_ID, { language: 'en' });
    expect(fresh?.homeCompetitor?.score).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a cold miss after the request budget while the fetch completes in cache', async () => {
    const coldId = GAME_ID + 1;
    const hanging = deferred<Response>();
    fetchMock.mockReturnValueOnce(hanging.promise);

    const cold = await svc.fetchScores365GameById(coldId, { language: 'en' });
    expect(cold).toBeNull();

    hanging.resolve(okResponse({ ...liveGame(2), id: coldId }));
    await new Promise((r) => setImmediate(r));
    const warmed = await svc.fetchScores365GameById(coldId, { language: 'en' });
    expect(warmed?.homeCompetitor?.score).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lets forced (background) callers wait for the real upstream answer', async () => {
    const forcedId = GAME_ID + 2;
    fetchMock.mockResolvedValueOnce(okResponse({ ...liveGame(0), id: forcedId }));
    await svc.fetchScores365GameById(forcedId, { language: 'en' });

    now += 5_000;
    const slow = deferred<Response>();
    fetchMock.mockReturnValueOnce(slow.promise);
    const pending = svc.fetchScores365GameById(forcedId, { language: 'en', force: true });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(settled).toBe(false);

    slow.resolve(okResponse({ ...liveGame(3), id: forcedId }));
    const result = await pending;
    expect(result?.homeCompetitor?.score).toBe(3);
  });
});
