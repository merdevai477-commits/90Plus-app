/**
 * Stadium image resolver: DB cache first, Wikipedia only on miss.
 * 365 venue photos take priority at the match-details glue layer (`resolveVenueImage`).
 */

import prisma from '../lib/prisma';
import { getPlaceholderUrl, getStadiumImageConfig } from '../config/stadium-image.config';
import { logger } from '../utils/logger';
import { scores365VenueImageUrl } from '../utils/scores365-match-info.util';
import { normalizeStadiumName } from '../utils/stadium-name.util';

export type StadiumImageCacheRow = {
  stadiumNameNormalized: string;
  originalName: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  found: boolean;
};

export type WikipediaImageResult = {
  imageUrl: string | null;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  pageTitle?: string;
  lang?: string;
};

export type GetStadiumImageOptions = {
  isTeamName?: boolean;
  country?: string | null;
};

const COUNTRY_WIKI_LANG: Record<string, string> = {
  egypt: 'ar',
  'saudi arabia': 'ar',
  uae: 'ar',
  'united arab emirates': 'ar',
  qatar: 'ar',
  morocco: 'ar',
  algeria: 'ar',
  tunisia: 'ar',
  iraq: 'ar',
  jordan: 'ar',
  kuwait: 'ar',
  bahrain: 'ar',
  oman: 'ar',
  yemen: 'ar',
  lebanon: 'ar',
  syria: 'ar',
  palestine: 'ar',
  libya: 'ar',
  sudan: 'ar',
  mauritania: 'ar',
  spain: 'es',
  mexico: 'es',
  argentina: 'es',
  chile: 'es',
  colombia: 'es',
  peru: 'es',
  uruguay: 'es',
  ecuador: 'es',
  venezuela: 'es',
  paraguay: 'es',
  bolivia: 'es',
  'costa rica': 'es',
  honduras: 'es',
  panama: 'es',
  germany: 'de',
  austria: 'de',
  france: 'fr',
  senegal: 'fr',
  cameroon: 'fr',
  mali: 'fr',
  'ivory coast': 'fr',
  "côte d'ivoire": 'fr',
  "cote d'ivoire": 'fr',
  portugal: 'pt',
  brazil: 'pt',
  italy: 'it',
  turkey: 'tr',
  netherlands: 'nl',
  russia: 'ru',
  japan: 'ja',
  'south korea': 'ko',
  korea: 'ko',
  poland: 'pl',
  'czech republic': 'cs',
  czechia: 'cs',
  greece: 'el',
};

const HIT_MISS_LOG_EVERY = 50;
let cacheHits = 0;
let cacheMisses = 0;
const inflight = new Map<string, Promise<string>>();

export function wikipediaLangForCountry(country?: string | null): string | null {
  const c = (country ?? '').trim().toLowerCase();
  if (!c) return null;
  return COUNTRY_WIKI_LANG[c] ?? null;
}

export function parseWikipediaSummaryImage(summary: unknown): WikipediaImageResult {
  const empty: WikipediaImageResult = {
    imageUrl: null,
    thumbnailUrl: null,
    latitude: null,
    longitude: null,
  };
  if (!summary || typeof summary !== 'object') return empty;
  const row = summary as {
    type?: string;
    originalimage?: { source?: string };
    thumbnail?: { source?: string };
    coordinates?: { lat?: number; lon?: number; longitude?: number };
    title?: string;
  };
  if (row.type === 'disambiguation') return empty;
  const original = typeof row.originalimage?.source === 'string' ? row.originalimage.source.trim() : '';
  const thumb = typeof row.thumbnail?.source === 'string' ? row.thumbnail.source.trim() : '';
  const imageUrl = original || thumb || null;
  const lat = row.coordinates?.lat;
  const lon = row.coordinates?.lon ?? row.coordinates?.longitude;
  return {
    imageUrl,
    thumbnailUrl: thumb || null,
    latitude: typeof lat === 'number' && Number.isFinite(lat) ? lat : null,
    longitude: typeof lon === 'number' && Number.isFinite(lon) ? lon : null,
    pageTitle: typeof row.title === 'string' ? row.title : undefined,
  };
}

export function extractInfoboxStadium(wikitext: string): string | null {
  if (!wikitext) return null;
  const patterns = [
    /\|\s*(?:ground|stadium|home_stadium|venue|home)\s*=\s*([^\n]+)/gi,
    /\|\s*ملعب\s*=\s*([^\n]+)/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(wikitext)) !== null) {
      const cleaned = cleanInfoboxValue(match[1] ?? '');
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function cleanInfoboxValue(raw: string): string | null {
  let val = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!val || /^[\s<(]+$/.test(val)) return null;
  const link = val.match(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/);
  if (link?.[1]) {
    val = link[1];
  } else {
    val = val.replace(/\{\{[^}]*\}\}/g, ' ').replace(/\[\[|\]\]/g, '');
  }
  val = val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (val.length < 2 || /^https?:/i.test(val)) return null;
  return val;
}

function wikiAbortSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function wikipediaFetch(url: string): Promise<unknown | null> {
  const { userAgent, timeoutMs } = getStadiumImageConfig();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Api-User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: wikiAbortSignal(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.warn('stadium-image Wikipedia request failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

type WikiSearchHit = { title: string };

function parseSearchHits(payload: unknown): WikiSearchHit[] {
  const list = (payload as { query?: { search?: Array<{ title?: string }> } })?.query?.search;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => ({ title: typeof row?.title === 'string' ? row.title.trim() : '' }))
    .filter((row) => row.title.length > 0);
}

async function searchWikipedia(lang: string, query: string): Promise<WikiSearchHit[]> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&format=json&utf8=1&srlimit=5&origin=*`;
  return parseSearchHits(await wikipediaFetch(url));
}

async function fetchSummary(lang: string, title: string): Promise<WikipediaImageResult | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const json = await wikipediaFetch(url);
  if (!json) return null;
  const parsed = parseWikipediaSummaryImage(json);
  if (!parsed.imageUrl) return null;
  return { ...parsed, lang, pageTitle: parsed.pageTitle ?? title };
}

async function fetchWikipediaEdition(lang: string, stadiumName: string): Promise<WikipediaImageResult | null> {
  const { original, stripped } = normalizeStadiumName(stadiumName);
  const queries = [original];
  if (stripped && stripped !== original.toLowerCase()) {
    queries.push(`${stripped} stadium`);
  }
  const seen = new Set<string>();
  for (const query of queries) {
    if (!query.trim()) continue;
    const hits = await searchWikipedia(lang, query);
    for (const hit of hits) {
      const key = hit.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const summary = await fetchSummary(lang, hit.title);
      if (summary?.imageUrl) return summary;
    }
  }
  return null;
}

export async function fetchFromWikipedia(
  name: string,
  options?: { country?: string | null },
): Promise<WikipediaImageResult> {
  const empty: WikipediaImageResult = {
    imageUrl: null,
    thumbnailUrl: null,
    latitude: null,
    longitude: null,
  };
  const trimmed = name.trim();
  if (!trimmed) return empty;
  const primary = getStadiumImageConfig().lang;
  const local = wikipediaLangForCountry(options?.country);
  const langs = [primary];
  if (local && local !== primary) langs.push(local);
  for (const lang of langs) {
    try {
      const result = await fetchWikipediaEdition(lang, trimmed);
      if (result?.imageUrl) return result;
    } catch (error) {
      logger.warn('stadium-image Wikipedia edition failed', {
        lang,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return empty;
}

function recordCache(hit: boolean): void {
  if (hit) cacheHits += 1;
  else cacheMisses += 1;
  const total = cacheHits + cacheMisses;
  if (total > 0 && total % HIT_MISS_LOG_EVERY === 0) {
    const ratio = cacheHits / total;
    logger.info('stadium-image cache hit/miss', {
      hits: cacheHits,
      misses: cacheMisses,
      ratio: Number(ratio.toFixed(3)),
    });
  }
}

export async function getFromCache(normalized: string): Promise<StadiumImageCacheRow | null> {
  const key = normalized.trim();
  if (!key) return null;
  try {
    const row = await prisma.stadiumImage.findUnique({
      where: { stadiumNameNormalized: key },
    });
    if (!row) return null;
    return {
      stadiumNameNormalized: row.stadiumNameNormalized,
      originalName: row.originalName,
      imageUrl: row.imageUrl,
      thumbnailUrl: row.thumbnailUrl,
      latitude: row.latitude,
      longitude: row.longitude,
      source: row.source,
      found: row.found,
    };
  } catch (error) {
    logger.warn('stadium-image cache read failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function saveToCache(row: {
  stadiumNameNormalized: string;
  originalName: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  found: boolean;
  source?: string;
}): Promise<void> {
  try {
    await prisma.stadiumImage.upsert({
      where: { stadiumNameNormalized: row.stadiumNameNormalized },
      create: {
        stadiumNameNormalized: row.stadiumNameNormalized,
        originalName: row.originalName,
        imageUrl: row.imageUrl,
        thumbnailUrl: row.thumbnailUrl,
        latitude: row.latitude,
        longitude: row.longitude,
        found: row.found,
        source: row.source ?? 'wikipedia',
      },
      update: {
        originalName: row.originalName,
        imageUrl: row.imageUrl,
        thumbnailUrl: row.thumbnailUrl,
        latitude: row.latitude,
        longitude: row.longitude,
        found: row.found,
        source: row.source ?? 'wikipedia',
      },
    });
  } catch (error) {
    logger.warn('stadium-image cache write failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function lookupTeamStadiumFromDb(teamName: string): Promise<string | null> {
  const { normalized, original } = normalizeStadiumName(teamName);
  if (!normalized) return null;
  try {
    const mapped = await prisma.teamStadiumMap.findUnique({
      where: { teamNameNormalized: normalized },
    });
    const fromMap = mapped?.stadiumName?.trim();
    if (fromMap) return fromMap;
  } catch (error) {
    logger.warn('stadium-image team map read failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    const team = await prisma.cachedTeam.findFirst({
      where: { name: { equals: original, mode: 'insensitive' } },
      select: { venueName: true },
    });
    const venue = team?.venueName?.trim();
    if (venue) {
      await saveTeamStadiumMap(normalized, venue);
      return venue;
    }
  } catch (error) {
    logger.warn('stadium-image CachedTeam venue lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

async function saveTeamStadiumMap(teamNameNormalized: string, stadiumName: string): Promise<void> {
  try {
    await prisma.teamStadiumMap.upsert({
      where: { teamNameNormalized },
      create: { teamNameNormalized, stadiumName },
      update: { stadiumName },
    });
  } catch (error) {
    logger.warn('stadium-image team map write failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchTeamStadiumFromWikipedia(
  teamName: string,
  country?: string | null,
): Promise<string | null> {
  const { original } = normalizeStadiumName(teamName);
  const primary = getStadiumImageConfig().lang;
  const local = wikipediaLangForCountry(country);
  const langs = [primary];
  if (local && local !== primary) langs.push(local);
  for (const lang of langs) {
    try {
      const hits = await searchWikipedia(lang, original);
      const title = hits[0]?.title;
      if (!title) continue;
      const url =
        `https://${lang}.wikipedia.org/w/api.php` +
        `?action=parse&page=${encodeURIComponent(title)}&prop=wikitext` +
        `&format=json&redirects=1&utf8=1&origin=*`;
      const payload = await wikipediaFetch(url);
      const wikitext =
        (payload as { parse?: { wikitext?: { ['*']?: string } | string } })?.parse?.wikitext;
      const text = typeof wikitext === 'string' ? wikitext : wikitext?.['*'] ?? '';
      const stadium = extractInfoboxStadium(text);
      if (stadium) return stadium;
    } catch (error) {
      logger.warn('stadium-image team infobox parse failed', {
        lang,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}

export async function resolveTeamToStadium(
  teamName: string,
  options?: { country?: string | null },
): Promise<string | null> {
  const fromDb = await lookupTeamStadiumFromDb(teamName);
  if (fromDb) return fromDb;
  const fromWiki = await fetchTeamStadiumFromWikipedia(teamName, options?.country);
  if (!fromWiki) return null;
  const { normalized } = normalizeStadiumName(teamName);
  if (normalized) await saveTeamStadiumMap(normalized, fromWiki);
  return fromWiki;
}

function imageUrlFromCache(row: StadiumImageCacheRow): string {
  if (row.found && row.imageUrl) return row.imageUrl;
  return getPlaceholderUrl();
}

function coalesceInflight(key: string, work: () => Promise<string>): Promise<string> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = work().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

export async function getStadiumImage(
  input: string,
  options?: GetStadiumImageOptions,
): Promise<string> {
  const placeholder = getPlaceholderUrl();
  try {
    let stadiumName = String(input ?? '').trim();
    if (!stadiumName) return placeholder;
    if (options?.isTeamName) {
      const resolved = await resolveTeamToStadium(stadiumName, { country: options.country });
      if (!resolved) return placeholder;
      stadiumName = resolved;
    }
    const names = normalizeStadiumName(stadiumName);
    if (!names.normalized) return placeholder;
    const cached = await getFromCache(names.normalized);
    if (cached) {
      recordCache(true);
      return imageUrlFromCache(cached);
    }
    recordCache(false);
    const wiki = await fetchFromWikipedia(names.original || stadiumName, { country: options?.country });
    const found = Boolean(wiki.imageUrl);
    await saveToCache({
      stadiumNameNormalized: names.normalized,
      originalName: names.original || stadiumName,
      imageUrl: wiki.imageUrl,
      thumbnailUrl: wiki.thumbnailUrl,
      latitude: wiki.latitude,
      longitude: wiki.longitude,
      found,
      source: 'wikipedia',
    });
    return wiki.imageUrl || placeholder;
  } catch (error) {
    logger.warn('stadium-image lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return placeholder;
  }
}

function warmStadiumImage(input: string, options?: GetStadiumImageOptions): void {
  const { normalized } = normalizeStadiumName(input);
  const key = `${options?.isTeamName ? 'team' : 'stad'}:${normalized || input.trim().toLowerCase()}`;
  void coalesceInflight(key, () => getStadiumImage(input, options)).catch((error) => {
    logger.warn('stadium-image warmup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Highlights path: cache-only. On miss, return the placeholder and fill Wikipedia in the background.
 */
export async function getStadiumImageFast(
  input: string,
  options?: GetStadiumImageOptions,
): Promise<string> {
  const placeholder = getPlaceholderUrl();
  try {
    let stadiumName = String(input ?? '').trim();
    if (!stadiumName) return placeholder;
    if (options?.isTeamName) {
      const mapped = await lookupTeamStadiumFromDb(stadiumName);
      if (!mapped) {
        recordCache(false);
        warmStadiumImage(stadiumName, options);
        return placeholder;
      }
      stadiumName = mapped;
    }
    const names = normalizeStadiumName(stadiumName);
    if (!names.normalized) return placeholder;
    const cached = await getFromCache(names.normalized);
    if (cached) {
      recordCache(true);
      return imageUrlFromCache(cached);
    }
    recordCache(false);
    warmStadiumImage(stadiumName, { ...options, isTeamName: false });
    return placeholder;
  } catch (error) {
    logger.warn('stadium-image fast lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return placeholder;
  }
}

async function probeImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: wikiAbortSignal(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 365 CDN first when the photo actually exists (HEAD 200). Constructed venue
 * URLs often 404 — those must fall through to Wikipedia/cache.
 */
export async function resolveVenueImage(options: {
  venueId?: number | null;
  venueName?: string | null;
  country?: string | null;
  fast?: boolean;
}): Promise<string> {
  const name = (options.venueName ?? '').trim();
  if (name) {
    const { normalized } = normalizeStadiumName(name);
    const cached = await getFromCache(normalized);
    if (cached) {
      recordCache(true);
      return imageUrlFromCache(cached);
    }
  }

  const from365 = scores365VenueImageUrl(options.venueId);
  if (from365 && (await probeImageUrl(from365))) {
    if (name) {
      const names = normalizeStadiumName(name);
      if (names.normalized) {
        void saveToCache({
          stadiumNameNormalized: names.normalized,
          originalName: names.original || name,
          imageUrl: from365,
          thumbnailUrl: from365,
          latitude: null,
          longitude: null,
          found: true,
          source: 'scores365',
        });
      }
    }
    return from365;
  }

  if (!name) return getPlaceholderUrl();
  if (options.fast === false) {
    return getStadiumImage(name, { country: options.country });
  }
  return getStadiumImageFast(name, { country: options.country });
}

export function resetStadiumImageTestState(): void {
  cacheHits = 0;
  cacheMisses = 0;
  inflight.clear();
}

export async function flushStadiumImageWarm(): Promise<void> {
  const pending = [...inflight.values()];
  if (pending.length === 0) return;
  await Promise.allSettled(pending);
}

export { getPlaceholderUrl };
export { normalizeStadiumName };
