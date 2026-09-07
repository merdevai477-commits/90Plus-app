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

import { getPlaceholderUrl } from '../../config/stadium-image.config';
import { scores365VenueImageUrl } from '../../utils/scores365-match-info.util';
import {
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

const PLACEHOLDER = getPlaceholderUrl();

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
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
    process.env.WIKIPEDIA_LANG = 'en';
    process.env.WIKIPEDIA_USER_AGENT = '90Plus-test/1.0 (https://90plus.pro; test@90plus.pro)';
  });

  it('parses Wikipedia summary originalimage with thumbnail fallback', () => {
    expect(
      parseWikipediaSummaryImage({
        originalimage: { source: 'https://upload.wikimedia.org/anfield.jpg' },
        thumbnail: { source: 'https://upload.wikimedia.org/anfield-thumb.jpg' },
        coordinates: { lat: 53.43, lon: -2.96 },
      }),
    ).toMatchObject({
      imageUrl: 'https://upload.wikimedia.org/anfield.jpg',
      thumbnailUrl: 'https://upload.wikimedia.org/anfield-thumb.jpg',
      latitude: 53.43,
      longitude: -2.96,
    });
    expect(
      parseWikipediaSummaryImage({
        thumbnail: { source: 'https://upload.wikimedia.org/only-thumb.jpg' },
      }),
    ).toMatchObject({ imageUrl: 'https://upload.wikimedia.org/only-thumb.jpg' });
    expect(parseWikipediaSummaryImage({ type: 'disambiguation' }).imageUrl).toBeNull();
  });

  it('extracts Ground/Stadium from infobox wikitext', () => {
    expect(
      extractInfoboxStadium('{{Infobox football club\n|ground = [[Anfield]]\n|capacity = 61276\n}}'),
    ).toBe('Anfield');
    expect(extractInfoboxStadium('| stadium = [[Estadio Santiago Bernabéu|Bernabéu]]')).toBe(
      'Estadio Santiago Bernabéu',
    );
    expect(extractInfoboxStadium('| ملعب = [[ستاد القاهرة الدولي]]')).toBe('ستاد القاهرة الدولي');
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
    const url = await getStadiumImage('Anfield');
    expect(url).toBe(PLACEHOLDER);
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
    await expect(getStadiumImage('Anfield')).resolves.toBe('https://upload.wikimedia.org/anfield.jpg');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches Wikipedia on miss, upserts cache, and returns the image', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ query: { search: [{ title: 'Anfield' }] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          originalimage: { source: 'https://upload.wikimedia.org/anfield.jpg' },
          thumbnail: { source: 'https://upload.wikimedia.org/anfield-thumb.jpg' },
        }),
      );
    const url = await getStadiumImage('Anfield');
    expect(url).toBe('https://upload.wikimedia.org/anfield.jpg');
    expect(fetchMock).toHaveBeenCalled();
    const ua = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers['User-Agent'];
    expect(ua).toContain('90Plus');
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

  it('saves found=false and returns the placeholder when Wikipedia has nothing', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const url = await getStadiumImage('Unknown Ground XYZ');
    expect(url).toBe(PLACEHOLDER);
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ found: false, imageUrl: null }),
      }),
    );
  });

  it('returns the placeholder when Wikipedia fetch throws or times out', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(getStadiumImage('Anfield')).resolves.toBe(PLACEHOLDER);
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
      latitude: null,
      longitude: null,
      source: 'wikipedia',
      found: true,
    });
    const url = await getStadiumImage('Liverpool', { isTeamName: true });
    expect(url).toBe('https://upload.wikimedia.org/anfield.jpg');
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
      )
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Anfield' }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ originalimage: { source: 'https://upload.wikimedia.org/anfield.jpg' } }),
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

  it('uses a 365 venue id and never calls Wikipedia', async () => {
    const url = await resolveVenueImage({ venueId: 1023, venueName: 'Anfield' });
    expect(url).toBe(scores365VenueImageUrl(1023));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.stadiumImage.findUnique).not.toHaveBeenCalled();
  });

  it('getStadiumImageFast returns the placeholder on miss and warms the cache', async () => {
    prismaMock.stadiumImage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ query: { search: [{ title: 'Anfield' }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ originalimage: { source: 'https://upload.wikimedia.org/anfield.jpg' } }),
      );
    const url = await getStadiumImageFast('Anfield');
    expect(url).toBe(PLACEHOLDER);
    await flushStadiumImageWarm();
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalled();
  });

  it('getFromCache / saveToCache round-trip the unique key', async () => {
    prismaMock.stadiumImage.findUnique.mockResolvedValue(null);
    await expect(getFromCache('anfield')).resolves.toBeNull();
    await saveToCache({
      stadiumNameNormalized: 'anfield',
      originalName: 'Anfield',
      imageUrl: 'https://example.com/a.jpg',
      thumbnailUrl: null,
      latitude: null,
      longitude: null,
      found: true,
    });
    expect(prismaMock.stadiumImage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stadiumNameNormalized: 'anfield' } }),
    );
  });
});
