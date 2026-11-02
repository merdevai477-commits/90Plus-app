import { Image } from 'expo-image';
import type { ImagePrefetchOptions } from 'expo-image';

/**
 * Prefetches each URL with its own native call. Given several URLs, expo-image's
 * Android prefetch settles one promise from multiple Glide threads; two failures
 * at once settle it twice and crash the app ("JavaCallback was already settled").
 */
export function prefetchImages(
  urls: readonly string[],
  cachePolicy?: ImagePrefetchOptions['cachePolicy'],
): Promise<void> {
  return Promise.all(urls.map((url) => Image.prefetch(url, cachePolicy).catch(() => false))).then(
    () => undefined,
  );
}
