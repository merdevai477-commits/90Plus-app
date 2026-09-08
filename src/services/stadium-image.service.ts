/**
 * Stadium image resolver: DB cache first, Wikipedia only on miss.
 * 365 venue photos take priority at the match-details glue layer (`resolveVenueImage`).
 */

import prisma from '../lib/prisma';
import { getPlaceholderUrl, getStadiumImageConfig, isPersistedPlaceholderUrl } from '../config/stadium-image.config';
import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import { scores365VenueImageUrl } from '../utils/scores365-match-info.util';
import { normalizeStadiumName } from '../utils/stadium-name.util';
import { isValidStadiumWikipediaSummary } from '../utils/wikipedia-stadium-validation.util';

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
  description?: string | null;
  type?: string | null;
};

export type StadiumImageLookup = {
  imageUrl: string | null;
  isPlaceholder: boolean;
};

export type GetStadiumImageOptions = {
  isTeamName?: boolean;
  country?: string | null;
};

const PLACEHOLDER_LOOKUP: StadiumImageLookup = { imageUrl: null, isPlaceholder: true };

const STADIUM_QUERY_OVERRIDES: Record<string, string> = {
  'spotify camp nou': 'Camp Nou',
  'signal iduna park': 'Westfalenstadion',
  'signal iduna park (dortmund)': 'Westfalenstadion',
  'etihad stadium': 'City of Manchester Stadium',
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
const inflight = new Map<string, Promise<StadiumImageLookup>>();

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
    description?: string;
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
    description: typeof row.description === 'string' ? row.description : null,
    type: typeof row.type === 'string' ? row.type : null,
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

async function fetchValidatedStadiumSummary(lang: string, title: string): Promise<WikipediaImageResult | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const json = await wikipediaFetch(url);
  if (!json) return null;
  const parsed = parseWikipediaSummaryImage(json);
  const row = json as { type?: string; description?: string; title?: string };
  const valid = isValidStadiumWikipediaSummary({
    type: row.type ?? parsed.type,
    title: parsed.pageTitle ?? title,
    description: typeof row.description === 'string' ? row.description : parsed.description,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  });
  if (!valid) return null;
  if (!parsed.imageUrl || isPersistedPlaceholderUrl(parsed.imageUrl)) return null;
  return {
    ...parsed,
    lang,
    pageTitle: parsed.pageTitle ?? title,
    description: typeof row.description === 'string' ? row.description : parsed.description,
  };
}

export function buildWikipediaStadiumQueries(stadiumName: string): string[] {
  const { original, stripped, normalized } = normalizeStadiumName(stadiumName);
  const queries: string[] = [];
  const push = (value: string) => {
    const next = value.replace(/\s+/g, ' ').trim();
    if (!next) return;
    if (queries.some((row) => row.toLowerCase() === next.toLowerCase())) return;
    queries.push(next);
  };
  const override = STADIUM_QUERY_OVERRIDES[normalized] || STADIUM_QUERY_OVERRIDES[stripped];
  if (override) push(override);
  push(original);
  const noParen = original.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (noParen) push(noParen);
  if (stripped) push(stripped);
  if (!/\bstadium\b/i.test(original)) push(`${original} stadium`);
  if (stripped && stripped.toLowerCase() !== original.toLowerCase()) {
    push(`${stripped} stadium`);
  }
  return queries;
}

async function fetchWikipediaEdition(lang: string, stadiumName: string): Promise<WikipediaImageResult | null> {
  const queries = buildWikipediaStadiumQueries(stadiumName);
  const seen = new Set<string>();
  for (const query of queries) {
    const hits = await searchWikipedia(lang, query);
    for (const hit of hits.slice(0, 5)) {
      const key = hit.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const summary = await fetchValidatedStadiumSummary(lang, hit.title);
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
  const placeholderUrl = isPersistedPlaceholderUrl(row.imageUrl);
  if (row.found && (placeholderUrl || !row.imageUrl)) {
    logger.error('stadium-image refused to persist placeholder as found=true', {
      stadiumNameNormalized: row.stadiumNameNormalized,
      imageUrl: row.imageUrl,
    });
  }
  const found = row.found && Boolean(row.imageUrl) && !placeholderUrl;
  const imageUrl = found ? row.imageUrl : null;
  const thumbnailUrl = found ? row.thumbnailUrl : null;
  try {
    await prisma.stadiumImage.upsert({
      where: { stadiumNameNormalized: row.stadiumNameNormalized },
      create: {
        stadiumNameNormalized: row.stadiumNameNormalized,
        originalName: row.originalName,
        imageUrl,
        thumbnailUrl,
        latitude: found ? row.latitude : null,
        longitude: found ? row.longitude : null,
        found,
        source: row.source ?? 'wikipedia',
      },
      update: {
        originalName: row.originalName,
        imageUrl,
        thumbnailUrl,
        latitude: found ? row.latitude : null,
        longitude: found ? row.longitude : null,
        found,
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

function lookupFromCache(row: StadiumImageCacheRow): StadiumImageLookup {
  if (row.found && row.imageUrl && !isPersistedPlaceholderUrl(row.imageUrl)) {
    return { imageUrl: row.imageUrl, isPlaceholder: false };
  }
  return PLACEHOLDER_LOOKUP;
}

function coalesceInflight(
  key: string,
  work: () => Promise<StadiumImageLookup>,
): Promise<StadiumImageLookup> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = work().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withStadiumImageLock(
  normalized: string,
  work: () => Promise<StadiumImageLookup>,
): Promise<StadiumImageLookup> {
  return coalesceInflight(`stad:${normalized}`, async () => {
    const redis = getRedisClient();
    const lockKey = `stadium-image:lock:${normalized}`;
    const ttlSec = getStadiumImageConfig().lockTtlSec;
    let acquired = !redis;
    if (redis) {
      try {
        const ok = await redis.set(lockKey, '1', 'EX', ttlSec, 'NX');
        acquired = ok === 'OK';
      } catch (error) {
        logger.warn('stadium-image redis lock failed; fetching locally', {
          error: error instanceof Error ? error.message : String(error),
        });
        acquired = true;
      }
    }
    if (!acquired) {
      const deadline = Date.now() + ttlSec * 1000;
      while (Date.now() < deadline) {
        const cached = await getFromCache(normalized);
        if (cached) return lookupFromCache(cached);
        await sleep(250);
      }
      const cached = await getFromCache(normalized);
      return cached ? lookupFromCache(cached) : PLACEHOLDER_LOOKUP;
    }
    try {
      const cached = await getFromCache(normalized);
      if (cached) return lookupFromCache(cached);
      return await work();
    } finally {
      if (redis) {
        try {
          await redis.del(lockKey);
        } catch {
          /* ignore */
        }
      }
    }
  });
}

async function resolveAndCacheStadium(
  stadiumName: string,
  options?: GetStadiumImageOptions,
): Promise<StadiumImageLookup> {
  const names = normalizeStadiumName(stadiumName);
  if (!names.normalized) return PLACEHOLDER_LOOKUP;
  const cached = await getFromCache(names.normalized);
  if (cached) {
    recordCache(true);
    return lookupFromCache(cached);
  }
  recordCache(false);
  return withStadiumImageLock(names.normalized, async () => {
    const wiki = await fetchFromWikipedia(names.original || stadiumName, { country: options?.country });
    const found = Boolean(wiki.imageUrl) && !isPersistedPlaceholderUrl(wiki.imageUrl);
    await saveToCache({
      stadiumNameNormalized: names.normalized,
      originalName: names.original || stadiumName,
      imageUrl: found ? wiki.imageUrl : null,
      thumbnailUrl: found ? wiki.thumbnailUrl : null,
      latitude: found ? wiki.latitude : null,
      longitude: found ? wiki.longitude : null,
      found,
      source: 'wikipedia',
    });
    return found && wiki.imageUrl
      ? { imageUrl: wiki.imageUrl, isPlaceholder: false }
      : PLACEHOLDER_LOOKUP;
  });
}

export async function getStadiumImage(
  input: string,
  options?: GetStadiumImageOptions,
): Promise<StadiumImageLookup> {
  try {
    let stadiumName = String(input ?? '').trim();
    if (!stadiumName) return PLACEHOLDER_LOOKUP;
    if (options?.isTeamName) {
      const resolved = await resolveTeamToStadium(stadiumName, { country: options.country });
      if (!resolved) return PLACEHOLDER_LOOKUP;
      stadiumName = resolved;
    }
    return resolveAndCacheStadium(stadiumName, options);
  } catch (error) {
    logger.warn('stadium-image lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return PLACEHOLDER_LOOKUP;
  }
}

function warmStadiumImage(input: string, options?: GetStadiumImageOptions): void {
  void getStadiumImage(input, options).catch((error) => {
    logger.warn('stadium-image warmup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Highlights path: cache-only. On miss, return a placeholder signal and fill Wikipedia in the background.
 */
export async function getStadiumImageFast(
  input: string,
  options?: GetStadiumImageOptions,
): Promise<StadiumImageLookup> {
  try {
    let stadiumName = String(input ?? '').trim();
    if (!stadiumName) return PLACEHOLDER_LOOKUP;
    if (options?.isTeamName) {
      const mapped = await lookupTeamStadiumFromDb(stadiumName);
      if (!mapped) {
        recordCache(false);
        warmStadiumImage(stadiumName, options);
        return PLACEHOLDER_LOOKUP;
      }
      stadiumName = mapped;
    }
    const names = normalizeStadiumName(stadiumName);
    if (!names.normalized) return PLACEHOLDER_LOOKUP;
    const cached = await getFromCache(names.normalized);
    if (cached) {
      recordCache(true);
      return lookupFromCache(cached);
    }
    recordCache(false);
    warmStadiumImage(stadiumName, { ...options, isTeamName: false });
    return PLACEHOLDER_LOOKUP;
  } catch (error) {
    logger.warn('stadium-image fast lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return PLACEHOLDER_LOOKUP;
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
}): Promise<StadiumImageLookup> {
  const name = (options.venueName ?? '').trim();
  if (name) {
    const { normalized } = normalizeStadiumName(name);
    const cached = await getFromCache(normalized);
    if (cached) {
      recordCache(true);
      return lookupFromCache(cached);
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
    return { imageUrl: from365, isPlaceholder: false };
  }

  if (!name) return PLACEHOLDER_LOOKUP;
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
