/**
 * Stadium-image pipeline tunables. Read from env at call time so tests can override.
 */

const DEFAULT_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Football_pitch_pv.jpg/1280px-Football_pitch_pv.jpg';

const DEFAULT_USER_AGENT =
  '90Plus/1.0 (https://90plus.pro; stadium-images@90plus.pro)';

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getStadiumImageConfig(): {
  lang: string;
  userAgent: string;
  placeholderUrl: string;
  timeoutMs: number;
} {
  const lang = (process.env.WIKIPEDIA_LANG || 'en').trim().toLowerCase() || 'en';
  const userAgent = (process.env.WIKIPEDIA_USER_AGENT || DEFAULT_USER_AGENT).trim() || DEFAULT_USER_AGENT;
  const placeholderUrl =
    (process.env.STADIUM_IMAGE_PLACEHOLDER_URL || DEFAULT_PLACEHOLDER).trim() || DEFAULT_PLACEHOLDER;
  return {
    lang,
    userAgent,
    placeholderUrl,
    timeoutMs: envInt('WIKIPEDIA_FETCH_TIMEOUT_MS', 5000, 1000, 15000),
  };
}

export function getPlaceholderUrl(): string {
  return getStadiumImageConfig().placeholderUrl;
}
