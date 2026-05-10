/**
 * Default placeholder values used across the profile UI when the user has
 * not yet supplied their own details. Each screen falls back to these when
 * the corresponding field on the user object is empty.
 */

/** Shown before the user picks a country (the global emoji). */
export const DEFAULT_COUNTRY_FLAG = '🌍';

/** Default placeholder on the FIFA card position slot. */
export const DEFAULT_POSITION = 'ST';

/** Defaults for the FIFA card player stats (age/height/weight/foot). */
export const DEFAULT_STATS = {
  age: '—',
  height: '—',
  weight: '—',
  foot: 'R' as 'R' | 'L' | 'B',
} as const;

export type DefaultStats = typeof DEFAULT_STATS;
