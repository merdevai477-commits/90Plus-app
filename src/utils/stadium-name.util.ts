const NOISE_WORDS = new Set([
  'stadium',
  'stadia',
  'stadion',
  'stade',
  'estadio',
  'stadio',
  'arena',
  'park',
  'grounds',
  'ground',
  'field',
  'centre',
  'center',
  'ملعب',
  'استاد',
  'ستاد',
]);

export type NormalizedStadiumName = {
  /** Trimmed original (display / Wikipedia search). */
  original: string;
  /** Lowercase, collapsed spaces, diacritics stripped — cache key. */
  normalized: string;
  /** `normalized` without common venue-type tokens (fuzzy match). */
  stripped: string;
};

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

function tokenizeNoiseKey(token: string): string {
  return stripDiacritics(token)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Normalize a raw stadium (or team) name for cache keys and fuzzy matching.
 * Keeps `original` for display / upstream search.
 */
export function normalizeStadiumName(raw: string | null | undefined): NormalizedStadiumName {
  const original = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = stripDiacritics(original).toLowerCase().replace(/\s+/g, ' ').trim();
  const stripped = normalized
    .split(' ')
    .filter((token) => {
      const key = tokenizeNoiseKey(token);
      return key.length > 0 && !NOISE_WORDS.has(key);
    })
    .join(' ')
    .trim();
  return {
    original,
    normalized,
    stripped: stripped || normalized,
  };
}
