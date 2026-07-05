import { Match } from '../components/Matches/matchCardUtils';
import { Image } from 'expo-image';
import { getCountryFlagUri } from './countryFlagUri';

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
  const list = Array.from(urls).slice(0, 40);
  if (list.length > 0) {
    Image.prefetch(list, 'memory-disk').catch(() => {});
  }
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
  if (unique.length > 0) {
    Image.prefetch(unique, 'memory-disk').catch(() => {});
  }
}

/** Prefetch team/league logos + fast country flags after matches load. */
export function prefetchMatchAssets(matches: Match[]): void {
  if (matches.length === 0) return;

  const urls = new Set<string>();
  for (const m of matches) {
    if (m.homeTeam?.logo) urls.add(m.homeTeam.logo);
    if (m.awayTeam?.logo) urls.add(m.awayTeam.logo);
    if (m.league?.logo) urls.add(m.league.logo);
    const flagUri = getCountryFlagUri(m.league?.country ?? '', m.league?.countryFlag);
    if (flagUri) urls.add(flagUri);
  }

  const list = Array.from(urls).slice(0, 180);
  if (list.length > 0) {
    Image.prefetch(list, 'memory-disk').catch(() => {});
  }
}
