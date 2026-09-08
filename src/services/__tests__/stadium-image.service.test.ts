const prismaMock = {
  stadiumImage: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  teamStadiumMap: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  cachedTeam: {
    findFirst: jest.fn(),
  },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { isPersistedPlaceholderUrl } from '../../config/stadium-image.config';
import { getRedisClient } from '../../lib/redis';
import { scores365VenueImageUrl } from '../../utils/scores365-match-info.util';
import {
  buildWikipediaStadiumQueries,
  extractInfoboxStadium,
  fetchFromWikipedia,
  flushStadiumImageWarm,
  getFromCache,
  getStadiumImage,
  getStadiumImageFast,
  parseWikipediaSummaryImage,
  resetStadiumImageTestState,
  resolveTeamToStadium,
  resolveVenueImage,
  saveToCache,
} from '../stadium-image.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function stadiumSummary(title: string, image: string) {
  return jsonResponse({
    type: 'standard',
    title,
    description: 'Football stadium in England',
    originalimage: { source: image },
    thumbnail: { source: `${image}-thumb` },
    coordinates: { lat: 53.43, lon: -2.96 },
  });
}

async function waitForUpsert(timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await flushStadiumImageWarm();
    if (prismaMock.stadiumImage.upsert.mock.calls.length > 0) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('warmup upsert did not run');
}

describe('stadium-image.service', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    resetStadiumImageTestState();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    prismaMock.stadiumImage.findUnique.mockReset();
    prismaMock.stadiumImage.upsert.mockReset();
    prismaMock.teamStadiumMap.findUnique.mockReset();
    prismaMock.teamStadiumMap.upsert.mockReset();
    prismaMock.cachedTeam.findFirst.mockReset();
    prismaMock.stadiumImage.upsert.mockResolvedValue({});
    prismaMock.teamStadiumMap.upsert.mockResolvedValue({});
    (getRedisClient as jest.Mock).mockReturnValue(null);
    delete process.env.STADIUM_IMAGE_LOCK_TTL_SEC;
    process.env.WIKIPEDIA_LANG = 'en';
    process.env.WIKIPEDIA_USER_AGENT = '90Plus-test/1.0 (https://90plus.pro; test@90plus.pro)';
  });

  it('parses Wikipedia summary originalimage with thumbnail fallback', () => {
    expect(
      parseWikipediaSummaryImage({
        originalimage: { source: 'https://upload.wikimedia.org/anfield.jpg' },
        thumbnail: { source: 'https://upload.wikimedia.org/anfield-thumb.jpg' },
        coordinates: { lat: 53.43, lon: -2.96 },
        description: 'Football stadium in Liverpool',
      }),
    ).toMatchObject({
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      thumbnailUrl: 'https://upload.wikimedia.org/anfield-thumb.jpg',
      latitude: 53.43,
      longitude: -2.96,
      description: 'Football stadium in Liverpool',
    });
    expect(parseWikipediaSummaryImage({ type: 'disambiguation' }).imageUrl).toBeNull();
  });

  it('builds a stadium suffix query even when the raw name has no noise words', () => {
    const queries = buildWikipediaStadiumQueries('Santiago Bernabéu');
    expect(queries[0]).toBe('Santiago Bernabéu');
    expect(queries).toContain('Santiago Bernabéu stadium');
  });

  it('prefers a known stadium override for sponsored venue names', () => {
    expect(buildWikipediaStadiumQueries('Signal Iduna Park')[0]).toBe('Westfalenstadion');
    expect(buildWikipediaStadiumQueries('Spotify Camp Nou')[0]).toBe('Camp Nou');
  });

  it('extracts Ground/Stadium from infobox wikitext', () => {
    expect(
      extractInfoboxStadium('{{Infobox football club\n|ground = [[Anfield]]\n|capacity = 61276\n}}'),
    ).toBe('Anfield');
  });

  it('returns a cache hit including found=false without calling Wikipedia', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue({
      stadiumNameNormalized: 'anfield',
      originalName: 'Anfield',
      imageUrl: null,
      thumbnailUrl: null,
      latitude: null,
      longitude: null,
      source: 'wikipedia',
      found: false,
    });
    await expect(getStadiumImage('Anfield')).resolves.toEqual({
      imageUrl: null,
      isPlaceholder: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.stadiumImage.upsert).not.toHaveBeenCalled();
  });

  it('returns a cached image URL on hit', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue({
      stadiumNameNormalized: 'anfield',
      originalName: 'Anfield',
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      thumbnailUrl: 'https://upload.wikimedia.org/anfield-thumb.jpg',
      latitude: 53.43,
      longitude: -2.96,
      source: 'wikipedia',
      found: true,
    });
    await expect(getStadiumImage('Anfield')).resolves.toEqual({
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      isPlaceholder: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips a person page and uses the first stadium candidate', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: { search: [{ title: 'Santiago Bernabéu' }, { title: 'Bernabéu (stadium)' }] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          type: 'standard',
          title: 'Santiago Bernabéu',
          description: 'Spanish footballer (1895–1978)',
          originalimage: { source: 'https://upload.wikimedia.org/person.jpg' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          type: 'standard',
          title: 'Bernabéu (stadium)',
          description: 'Stadium in Madrid, Spain',
          originalimage: { source: 'https://upload.wikimedia.org/bernabeu-stadium.jpg' },
          coordinates: { lat: 40.45306, lon: -3.68835 },
        }),
      );
    const result = await getStadiumImage('Santiago Bernabéu');
    expect(result).toEqual({
      imageUrl: 'https://upload.wikimedia.org/bernabeu-stadium.jpg',
      isPlaceholder: false,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          found: true,
          imageUrl: 'https://upload.wikimedia.org/bernabeu-stadium.jpg',
          latitude: 40.45306,
          longitude: -3.68835,
        }),
      }),
    );
  });

  it('fetches Wikipedia on miss, upserts cache, and returns the image', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Anfield' }] } }))
      .mockResolvedValueOnce(stadiumSummary('Anfield', 'https://upload.wikimedia.org/anfield.jpg'));
    const result = await getStadiumImage('Anfield');
    expect(result).toEqual({
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      isPlaceholder: false,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stadiumNameNormalized: 'anfield' },
        create: expect.objectContaining({
          found: true,
          imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
        }),
      }),
    );
  });

  it('saves found=false and returns a placeholder signal when Wikipedia has nothing valid', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await expect(getStadiumImage('Unknown Ground XYZ')).resolves.toEqual({
      imageUrl: null,
      isPlaceholder: true,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ found: false, imageUrl: null }),
      }),
    );
  });

  it('retries with a stadium suffix after rejecting a person-only search', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(String(url));
      if (decoded.includes('/w/api.php') && decoded.includes('list=search')) {
        if (/\bstadium\b/i.test(decoded)) {
          return jsonResponse({ query: { search: [{ title: 'Bernabéu (stadium)' }] } });
        }
        return jsonResponse({ query: { search: [{ title: 'Santiago Bernabéu' }] } });
      }
      if (decoded.includes('page/summary/')) {
        if (/stadium/i.test(decoded)) {
          return jsonResponse({
            type: 'standard',
            title: 'Bernabéu (stadium)',
            description: 'Stadium in Madrid, Spain',
            originalimage: { source: 'https://upload.wikimedia.org/bernabeu-stadium.jpg' },
            coordinates: { lat: 40.45306, lon: -3.68835 },
          });
        }
        return jsonResponse({
          type: 'standard',
          title: 'Santiago Bernabéu',
          description: 'Spanish footballer (1895–1978)',
          originalimage: { source: 'https://upload.wikimedia.org/person.jpg' },
        });
      }
      return jsonResponse({});
    });
    await expect(getStadiumImage('Santiago Bernabéu')).resolves.toEqual({
      imageUrl: 'https://upload.wikimedia.org/bernabeu-stadium.jpg',
      isPlaceholder: false,
    });
  });

  it('never falls back to a rejected person thumbnail', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(String(url));
      if (decoded.includes('list=search')) {
        return jsonResponse({ query: { search: [{ title: 'Santiago Bernabéu' }] } });
      }
      return jsonResponse({
        type: 'standard',
        title: 'Santiago Bernabéu',
        description: 'Spanish footballer (1895–1978)',
        originalimage: { source: 'https://upload.wikimedia.org/person.jpg' },
      });
    });
    await expect(getStadiumImage('Santiago Bernabéu')).resolves.toEqual({
      imageUrl: null,
      isPlaceholder: true,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ found: false, imageUrl: null }),
      }),
    );
  });

  it('never persists a placeholder URL as found=true', async () => {
    await saveToCache({
      stadiumNameNormalized: 'ghost ground',
      originalName: 'Ghost Ground',
      imageUrl: 'https://90plus.pro/stadium-placeholder.svg',
      thumbnailUrl: null,
      latitude: null,
      longitude: null,
      found: true,
    });
    expect(isPersistedPlaceholderUrl('https://90plus.pro/stadium-placeholder.svg')).toBe(true);
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ found: false, imageUrl: null }),
      }),
    );
  });

  it('still persists a real Bernabéu stadium Wikimedia photo as found=true', async () => {
    const imageUrl =
      'https://upload.wikimedia.org/wikipedia/commons/0/0e/Estadio_Santiago_Bernab%C3%A9u_Madrid.jpg';
    await saveToCache({
      stadiumNameNormalized: 'santiago bernabeu',
      originalName: 'Santiago Bernabéu',
      imageUrl,
      thumbnailUrl: null,
      latitude: 40.453,
      longitude: -3.688,
      found: true,
    });
    expect(isPersistedPlaceholderUrl(imageUrl)).toBe(false);
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ found: true, imageUrl }),
      }),
    );
  });

  it('returns a placeholder signal when Wikipedia fetch throws or times out', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(getStadiumImage('Anfield')).resolves.toEqual({
      imageUrl: null,
      isPlaceholder: true,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ found: false }),
      }),
    );
  });

  it('sends User-Agent on every Wikipedia request in fetchFromWikipedia', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await fetchFromWikipedia('Anfield');
    expect(fetchMock).toHaveBeenCalled();
    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as { headers: Record<string, string> }).headers;
      expect(headers['User-Agent']).toBeTruthy();
    }
  });

  it('resolves a team from team_stadium_map without Wikipedia', async () => {
    prismaMock.teamStadiumMap.findUnique.mockResolvedValue({
      teamNameNormalized: 'liverpool',
      stadiumName: 'Anfield',
    });
    prismaMock.stadiumImage.findUnique.mockResolvedValue({
      stadiumNameNormalized: 'anfield',
      originalName: 'Anfield',
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      thumbnailUrl: null,
      latitude: 53.43,
      longitude: -2.96,
      source: 'wikipedia',
      found: true,
    });
    await expect(getStadiumImage('Liverpool', { isTeamName: true })).resolves.toEqual({
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      isPlaceholder: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parses a team infobox and auto-inserts team_stadium_map', async () => {
    prismaMock.teamStadiumMap.findUnique.mockResolvedValue(null);
    prismaMock.cachedTeam.findFirst.mockResolvedValue(null);
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Liverpool F.C.' }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ parse: { wikitext: { '*': '|ground = [[Anfield]]\n' } } }),
      );
    const stadium = await resolveTeamToStadium('Liverpool');
    expect(stadium).toBe('Anfield');
    expect(prismaMock.teamStadiumMap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamNameNormalized: 'liverpool' },
        create: expect.objectContaining({ stadiumName: 'Anfield' }),
      }),
    );
  });

  it('uses a 365 venue photo only after a successful HEAD', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response);
    const result = await resolveVenueImage({ venueId: 1023, venueName: 'Anfield' });
    expect(result).toEqual({
      imageUrl: scores365VenueImageUrl(1023),
      isPlaceholder: false,
    });
    expect((fetchMock.mock.calls[0][1] as { method?: string }).method).toBe('HEAD');
  });

  it('falls through to Wikipedia/cache when the 365 CDN 404s', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response)
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Anfield' }] } }))
      .mockResolvedValueOnce(stadiumSummary('Anfield', 'https://upload.wikimedia.org/anfield.jpg'));
    const result = await resolveVenueImage({ venueId: 1023, venueName: 'Anfield', fast: true });
    expect(result).toEqual({ imageUrl: null, isPlaceholder: true });
    await waitForUpsert();
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalled();
  });

  it('getStadiumImageFast returns isPlaceholder on miss and warms the cache', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Anfield' }] } }))
      .mockResolvedValueOnce(stadiumSummary('Anfield', 'https://upload.wikimedia.org/anfield.jpg'));
    await expect(getStadiumImageFast('Anfield')).resolves.toEqual({
      imageUrl: null,
      isPlaceholder: true,
    });
    await waitForUpsert();
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalled();
  });

  it('acquires a redis lock before fetching Wikipedia', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    (getRedisClient as jest.Mock).mockReturnValue(redis);
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Anfield' }] } }))
      .mockResolvedValueOnce(stadiumSummary('Anfield', 'https://upload.wikimedia.org/anfield.jpg'));
    await getStadiumImage('Anfield');
    expect(redis.set).toHaveBeenCalledWith('stadium-image:lock:anfield', '1', 'EX', 10, 'NX');
    expect(redis.del).toHaveBeenCalledWith('stadium-image:lock:anfield');
  });

  it('returns a placeholder without Wikipedia when another instance holds the lock', async () => {
    process.env.STADIUM_IMAGE_LOCK_TTL_SEC = '1';
    const redis = {
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
    };
    (getRedisClient as jest.Mock).mockReturnValue(redis);
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    await expect(getStadiumImage('Anfield')).resolves.toEqual({
      imageUrl: null,
      isPlaceholder: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.stadiumImage.upsert).not.toHaveBeenCalled();
  }, 15000);

  it('getFromCache / saveToCache round-trip the unique key', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    await expect(getFromCache('anfield')).resolves.toBeNull();
    await saveToCache({
      stadiumNameNormalized: 'anfield',
      originalName: 'Anfield',
      imageUrl: 'https://example.com/a.jpg',
      thumbnailUrl: null,
      latitude: 53.4,
      longitude: -2.9,
      found: true,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stadiumNameNormalized: 'anfield' } }),
    );
  });
});
