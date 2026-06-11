import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';

const IMAGE_SOURCE_PREFIX = 'news:wc:img:src:';
const IMAGE_DATA_PREFIX = 'news:wc:img:data:';
const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;

interface CachedImagePayload {
  contentType: string;
  data: string;
  timestamp: number;
  ttl: number;
}

function isAllowedImageUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function buildNewsImageProxyPath(articleId: string): string {
  return `/api/news/image/${articleId}`;
}

export async function registerNewsImageSource(
  articleId: string,
  sourceUrl: string | null | undefined,
): Promise<string | null> {
  const trimmed = sourceUrl?.trim();
  if (!trimmed || !isAllowedImageUrl(trimmed)) return null;

  await redisCacheService.set(
    `${IMAGE_SOURCE_PREFIX}${articleId}`,
    trimmed,
    IMAGE_CACHE_TTL_MS,
  );

  return buildNewsImageProxyPath(articleId);
}

export async function fetchProxiedNewsImage(
  articleId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!/^[a-f0-9]{16}$/i.test(articleId)) return null;

  const cacheKey = `${IMAGE_DATA_PREFIX}${articleId}`;
  const cached = await redisCacheService.get<CachedImagePayload>(cacheKey);
  if (cached?.data && Date.now() - cached.timestamp < cached.ttl) {
    return {
      buffer: Buffer.from(cached.data, 'base64'),
      contentType: cached.contentType || 'image/jpeg',
    };
  }

  const sourceUrl = await redisCacheService.get<string>(`${IMAGE_SOURCE_PREFIX}${articleId}`);
  if (!sourceUrl || !isAllowedImageUrl(sourceUrl)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const origin = new URL(sourceUrl).origin;
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; 90PlusNews/1.0; +https://90plus.pro/news)',
        Referer: `${origin}/`,
      },
    });

    if (!response.ok) {
      logger.warn(`News image upstream ${response.status} for ${articleId}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_BYTES) {
      return null;
    }

    const buffer = Buffer.from(arrayBuffer);
    await redisCacheService.set(
      cacheKey,
      {
        contentType,
        data: buffer.toString('base64'),
        timestamp: Date.now(),
        ttl: IMAGE_CACHE_TTL_MS,
      },
      IMAGE_CACHE_TTL_MS,
    );

    return { buffer, contentType };
  } catch (error) {
    logger.warn(`News image fetch failed for ${articleId}:`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
