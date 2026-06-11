import {
  refreshWorldCupNewsBundle,
  WorldCupNewsService,
} from '../world-cup-news.service';

jest.mock('../redis-cache.service', () => {
  const store = new Map<string, unknown>();

  return {
    __store: store,
    redisCacheService: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
});

const redisModule = jest.requireMock('../redis-cache.service') as {
  __store: Map<string, unknown>;
};

describe('WorldCupNewsService quota-safe reads', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    redisModule.__store.clear();
    process.env.NEWS_API_KEY = 'test-key';
    process.env.NEWS_DAILY_BUDGET = '90';
    process.env.NEWS_FEED_SIZE = '5';
    process.env.NEWS_CACHE_TTL_MINUTES = '120';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('serves both languages from one bundle without duplicate upstream calls', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          articles: [
            {
              title: '5 مباريات في مونديال 2026',
              url: 'https://example.com/ar-1',
              source: { name: 'Aljazeera' },
              publishedAt: '2026-06-09T12:00:00Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          articles: [
            {
              title: 'World Cup 2026 opener preview',
              url: 'https://example.com/en-1',
              source: { name: 'BBC' },
              publishedAt: '2026-06-09T12:00:00Z',
            },
          ],
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    await refreshWorldCupNewsBundle({ force: true });

    const first = await WorldCupNewsService.getWorldCupNews({
      language: 'all',
      page: 1,
      pageSize: 5,
    });
    const second = await WorldCupNewsService.getWorldCupNews({
      language: 'ar',
      page: 1,
      pageSize: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.data.ar?.articles).toHaveLength(1);
    expect(first.data.en?.articles).toHaveLength(1);
    expect(second.data.ar?.articles?.[0]?.title).toContain('مونديال 2026');
    expect(first.quota.used).toBe(2);
  });
});
