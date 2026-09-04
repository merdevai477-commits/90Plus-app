import { Match } from '../components/Matches/matchCardUtils';
import { Image } from 'expo-image';
import { getCountryFlagUri } from './countryFlagUri';

/**
 * Warming dozens of images at once starves the concurrent data requests on the
 * same connection pool, so a lineups screen ends up waiting on headshots.
 */
const PREFETCH_BATCH_SIZE = 8;

function prefetchInBatches(urls: string[]): void {
  if (urls.length === 0) return;
  void (async () => {
    for (let i = 0; i < urls.length; i += PREFETCH_BATCH_SIZE) {
      await Image.prefetch(urls.slice(i, i + PREFETCH_BATCH_SIZE), 'memory-disk').catch(() => {});
      if (i + PREFETCH_BATCH_SIZE < urls.length) {
        await new Promise<void>((r) => setTimeout(r, 50));
      }
    }
  })();
}

/** Prefetch team logos on the Home screen match carousel. */
export function prefetchHomeMatchLogos(
  matches: ReadonlyArray<{ homeLogo?: string; awayLogo?: string }>,
): void {
  if (matches.length === 0) return;
  const urls = new Set<string>();
  for (const m of matches) {
    if (m.homeLogo) urls.add(m.homeLogo);
    if (m.awayLogo) urls.add(m.awayLogo);
  }
  prefetchInBatches(Array.from(urls).slice(0, 40));
}

export function prefetchVideoThumbnails(thumbnails: string[]): void {
  const list = thumbnails.filter(Boolean).slice(0, 12);
  if (list.length > 0) {
    Image.prefetch(list, 'memory-disk').catch(() => {});
  }
}

/**
 * Warm the disk cache with a batch of image URLs (player/coach photos, etc.)
 * so they render in a snap when their tab/section opens. Silently deduped,
 * capped, and non-blocking.
 */
export function prefetchImageUrls(urls: Array<string | null | undefined>, cap = 60): void {
  const unique = Array.from(
    new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 0)),
  ).slice(0, cap);
  prefetchInBatches(unique);
}

/** Prefetch team/league logos + fast country flags after matches load.
 * Prefer logos from the first matches (usually on-screen) and batch so we
 * don't saturate the network fighting visible Image renders. */
export function prefetchMatchAssets(matches: Match[]): void {
  if (matches.length === 0) return;

  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url?: string | null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  // First ~24 fixtures ≈ early FlashList viewport + a little ahead.
  for (const m of matches.slice(0, 24)) {
    push(m.homeTeam?.logo);
    push(m.awayTeam?.logo);
    push(m.league?.logo);
    push(getCountryFlagUri(m.league?.country ?? '', m.league?.countryFlag));
  }

  prefetchInBatches(urls.slice(0, 64));
}
