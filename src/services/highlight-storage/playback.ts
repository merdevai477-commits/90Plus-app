/** Prefer a verified owned URL, then the original external URL. */
export function resolveHighlightPlayback(input: {
  originalUrl: string;
  ownedUrl: string | null;
  verified: boolean;
}): { url: string; playbackUrls: string[] } {
  const original = input.originalUrl.trim();
  const owned = input.ownedUrl?.trim() || '';
  if (input.verified && owned && owned !== original) {
    return { url: owned, playbackUrls: [owned, original].filter(Boolean) };
  }
  return { url: original, playbackUrls: original ? [original] : [] };
}

export function storageKeyForAsset(input: {
  fixtureId: number | null;
  checksum: string;
  contentType: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const fixture = input.fixtureId ?? 0;
  const ext = input.contentType.includes('mpegurl') || input.contentType.includes('mp2t') ? 'm3u8' : 'mp4';
  return `football/${year}/${month}/fixtures/${fixture}/assets/${input.checksum}.${ext}`;
}
