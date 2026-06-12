import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import {
  filterWorldCupArticles,
  type NewsLanguage,
  type RawNewsArticle,
} from '../utils/world-cup-news-filter.util';
import type {
  WorldCupNewsArticle,
  WorldCupNewsPage,
  WorldCupNewsResponse,
} from '../types/news.types';
import { registerNewsImageSource } from './news-image-proxy.service';

const NEWS_API_BASE = 'https://newsapi.org/v2';
const BUNDLE_CACHE_KEY = 'news:wc:bundle:v1';
const REFRESH_LOCK_KEY = 'news:wc:refresh:lock';

const SEARCH_QUERY: Record<NewsLanguage, string> = {
  ar: '"كأس العالم 2026" OR مونديال OR "كأس العالم"',
  en: '"World Cup 2026" OR "FIFA World Cup" OR mondial',
};

interface NewsApiResponse {
  status: string;
  totalResults?: number;
  code?: string;
  message?: string;
  articles?: RawNewsArticle[];
}

export interface WorldCupNewsBundle {
  fetchedAt: string;
  expiresAt: string;
  ar: WorldCupNewsArticle[];
  en: WorldCupNewsArticle[];
}

interface CachedBundleEntry {
  data: WorldCupNewsBundle;
  timestamp: number;
  ttl: number;
}

interface QuotaSnapshot {
  dayKey: string;
  used: number;
  budget: number;
  remaining: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFeedSize(): number {
  return parsePositiveInt(process.env.NEWS_FEED_SIZE, 15);
}

function getCacheTtlMs(): number {
  const minutes = parsePositiveInt(process.env.NEWS_CACHE_TTL_MINUTES, 120);
  return minutes * 60 * 1000;
}

function getStaleMaxMs(): number {
  const hours = parsePositiveInt(process.env.NEWS_STALE_MAX_HOURS, 6);
  return hours * 60 * 60 * 1000;
}

function getDailyBudget(): number {
  return parsePositiveInt(process.env.NEWS_DAILY_BUDGET, 90);
}

function getApiKey(): string | null {
  const key = process.env.NEWS_API_KEY?.trim();
  return key || null;
}

function quotaDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function quotaCacheKey(dayKey: string): string {
  return `news:wc:quota:${dayKey}`;
}

function articleId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function normalizeArticle(
  article: RawNewsArticle,
  language: NewsLanguage,
): WorldCupNewsArticle | null {
  const title = (article.title ?? '').trim();
  let url = (article.url ?? '').trim();
  if (!title || !url) return null;

  try {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      url = `https://${url}`;
    }
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      url = parsed.toString();
    }
  } catch {
    return null;
  }

  const id = articleId(url);
  const originalImage = article.urlToImage?.trim() || null;

  return {
    id,
    title,
    description: article.description?.trim() || null,
    url,
    imageUrl: originalImage,
    source: article.source?.name?.trim() || 'Unknown',
    publishedAt: article.publishedAt ?? new Date(0).toISOString(),
    language,
  };
}

async function attachProxiedImages(articles: WorldCupNewsArticle[]): Promise<void> {
  await Promise.all(
    articles.map(async (article) => {
      if (!article.imageUrl) return;
      const proxied = await registerNewsImageSource(article.id, article.imageUrl);
      if (proxied) article.imageUrl = proxied;
    }),
  );
}

async function readQuota(): Promise<QuotaSnapshot> {
  const dayKey = quotaDayKey();
  const budget = getDailyBudget();
  const used = (await redisCacheService.get<number>(quotaCacheKey(dayKey))) ?? 0;
  return {
    dayKey,
    used,
    budget,
    remaining: Math.max(0, budget - used),
  };
}

async function consumeQuota(units: number): Promise<boolean> {
  const budget = getDailyBudget();
  const dayKey = quotaDayKey();
  const key = quotaCacheKey(dayKey);
  const used = (await redisCacheService.get<number>(key)) ?? 0;

  if (used + units > budget) {
    logger.warn(
      `📰 News API daily budget reached (${used}/${budget}). Skipping upstream refresh.`,
    );
    return false;
  }

  await redisCacheService.set(key, used + units, 48 * 60 * 60 * 1000);
  return true;
}

async function fetchLanguageFeed(language: NewsLanguage, feedSize: number): Promise<WorldCupNewsArticle[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NEWS_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    q: SEARCH_QUERY[language],
    language,
    sortBy: 'publishedAt',
    pageSize: String(Math.min(feedSize * 2, 100)),
    page: '1',
    apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${NEWS_API_BASE}/everything?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    const payload = (await response.json()) as NewsApiResponse;

    if (!response.ok || payload.status !== 'ok') {
      const message =
        payload.message ||
        payload.code ||
        `News API request failed (${response.status})`;
      throw new Error(message);
    }

    return filterWorldCupArticles(payload.articles ?? [], language)
      .map((article) => normalizeArticle(article, language))
      .filter((article): article is WorldCupNewsArticle => article != null)
      .slice(0, feedSize);
  } finally {
    clearTimeout(timeout);
  }
}

let refreshInFlight: Promise<WorldCupNewsBundle | null> | null = null;

async function acquireRefreshLock(): Promise<boolean> {
  const existing = await redisCacheService.get<number>(REFRESH_LOCK_KEY);
  if (existing) return false;
  await redisCacheService.set(REFRESH_LOCK_KEY, Date.now(), 90_000);
  return true;
}

async function releaseRefreshLock(): Promise<void> {
  await redisCacheService.del(REFRESH_LOCK_KEY);
}

async function loadBundle(): Promise<{ bundle: WorldCupNewsBundle; fresh: boolean } | null> {
  const entry = await redisCacheService.get<CachedBundleEntry>(BUNDLE_CACHE_KEY);
  if (!entry?.data) return null;

  const ageMs = Date.now() - entry.timestamp;
  const fresh = ageMs < entry.ttl;
  const staleOk = ageMs < getStaleMaxMs();

  if (fresh || staleOk) {
    return { bundle: entry.data, fresh };
  }

  return null;
}

async function saveBundle(bundle: WorldCupNewsBundle): Promise<void> {
  const ttlMs = getCacheTtlMs();
  await redisCacheService.set(
    BUNDLE_CACHE_KEY,
    {
      data: bundle,
      timestamp: Date.now(),
      ttl: ttlMs,
    },
    ttlMs + getStaleMaxMs(),
  );
}

/**
 * Only path that calls News API. Uses 2 requests (ar + en) per refresh.
 */
export async function refreshWorldCupNewsBundle(options?: {
  force?: boolean;
}): Promise<WorldCupNewsBundle | null> {
  if (!getApiKey()) return null;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const feedSize = getFeedSize();

    if (!options?.force) {
      const existing = await loadBundle();
      if (existing?.fresh) {
        return existing.bundle;
      }
    }

    const lockAcquired = await acquireRefreshLock();
    if (!lockAcquired) {
      const existing = await loadBundle();
      return existing?.bundle ?? null;
    }

    try {
      if (!options?.force) {
        const existing = await loadBundle();
        if (existing?.fresh) {
          return existing.bundle;
        }
      }

      const allowed = await consumeQuota(2);
      if (!allowed) {
        const existing = await loadBundle();
        return existing?.bundle ?? null;
      }

      const [ar, en] = await Promise.all([
        fetchLanguageFeed('ar', feedSize),
        fetchLanguageFeed('en', feedSize),
      ]);

      await attachProxiedImages([...ar, ...en]);

      const { fetchProxiedNewsImage } = await import('./news-image-proxy.service');
      const warmIds = [...new Set([...ar, ...en].map((a) => a.id))].slice(0, 6);
      void Promise.allSettled(warmIds.map((id) => fetchProxiedNewsImage(id)));

      const fetchedAt = new Date().toISOString();
      const bundle: WorldCupNewsBundle = {
        fetchedAt,
        expiresAt: new Date(Date.now() + getCacheTtlMs()).toISOString(),
        ar,
        en,
      };

      await saveBundle(bundle);
      logger.info(`📰 World Cup news refreshed (ar=${ar.length}, en=${en.length})`);
      return bundle;
    } catch (error) {
      logger.error('World Cup news refresh failed:', error);
      const existing = await loadBundle();
      return existing?.bundle ?? null;
    } finally {
      await releaseRefreshLock();
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function paginateArticles(
  articles: WorldCupNewsArticle[],
  page: number,
  pageSize: number,
): WorldCupNewsPage {
  const start = (page - 1) * pageSize;
  const slice = articles.slice(start, start + pageSize);
  return {
    total: articles.length,
    page,
    pageSize,
    articles: slice,
  };
}

function buildResponseSlice(
  bundle: WorldCupNewsBundle,
  language: NewsLanguage | 'all',
  page: number,
  pageSize: number,
): WorldCupNewsResponse {
  if (language === 'ar') {
    return { ar: paginateArticles(bundle.ar, page, pageSize) };
  }
  if (language === 'en') {
    return { en: paginateArticles(bundle.en, page, pageSize) };
  }
  return {
    ar: paginateArticles(bundle.ar, page, pageSize),
    en: paginateArticles(bundle.en, page, pageSize),
  };
}

export class WorldCupNewsService {
  static isConfigured(): boolean {
    return Boolean(getApiKey());
  }

  static getCacheTtlMinutes(): number {
    return parsePositiveInt(process.env.NEWS_CACHE_TTL_MINUTES, 120);
  }

  static resolvePageSize(raw?: string | string[]): number {
    const parsed = parseInt(Array.isArray(raw) ? raw[0] : raw || '', 10);
    const feedSize = getFeedSize();
    if (!Number.isFinite(parsed) || parsed < 1) return feedSize;
    return Math.min(parsed, feedSize);
  }

  static resolvePage(raw?: string | string[]): number {
    const parsed = parseInt(Array.isArray(raw) ? raw[0] : raw || '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(parsed, 5);
  }

  static resolveLanguage(raw?: string | string[]): NewsLanguage | 'all' {
    const value = (Array.isArray(raw) ? raw[0] : raw || 'all').toLowerCase();
    if (value === 'ar' || value === 'en') return value;
    return 'all';
  }

  /**
   * Read path — never calls News API directly. Cron/startup owns refresh.
   */
  static async getWorldCupNews(options: {
    language?: NewsLanguage | 'all';
    page?: number;
    pageSize?: number;
  }): Promise<{
    data: WorldCupNewsResponse;
    cached: boolean;
    stale: boolean;
    fetchedAt: string;
    expiresAt: string;
    provider: 'newsapi.org';
    quota: QuotaSnapshot;
  }> {
    const language = options.language ?? 'all';
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? getFeedSize();
    const quota = await readQuota();

    let loaded = await loadBundle();
    if (!loaded) {
      const refreshed = await refreshWorldCupNewsBundle();
      if (refreshed) {
        loaded = { bundle: refreshed, fresh: true };
      }
    }

    if (!loaded) {
      return {
        data: {},
        cached: false,
        stale: false,
        fetchedAt: new Date(0).toISOString(),
        expiresAt: new Date(0).toISOString(),
        provider: 'newsapi.org',
        quota,
      };
    }

    await attachProxiedImages([...loaded.bundle.ar, ...loaded.bundle.en]);

    return {
      data: buildResponseSlice(loaded.bundle, language, page, pageSize),
      cached: true,
      stale: !loaded.fresh,
      fetchedAt: loaded.bundle.fetchedAt,
      expiresAt: loaded.bundle.expiresAt,
      provider: 'newsapi.org',
      quota: await readQuota(),
    };
  }
}

export async function warmWorldCupNewsCache(): Promise<void> {
  if (!WorldCupNewsService.isConfigured()) return;
  await refreshWorldCupNewsBundle();
}

export function getWorldCupNewsCronSchedule(): string {
  const configured = process.env.NEWS_REFRESH_CRON?.trim();
  return configured || '0 */2 * * *';
}
