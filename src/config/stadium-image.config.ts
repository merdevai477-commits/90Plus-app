/**
 * Stadium-image pipeline tunables. Read from env at call time so tests can override.
 *
 * The miss path must return `{ imageUrl: null, isPlaceholder: true }` — never a
 * photograph of a real stadium. STADIUM_IMAGE_PLACEHOLDER_URL is only a last-resort
 * branded asset URL if a caller still needs a non-null href; it is never persisted
 * as found=true.
 */

const DEFAULT_PLACEHOLDER = 'https://90plus.pro/stadium-placeholder.svg';

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
  lockTtlSec: number;
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
    lockTtlSec: envInt('STADIUM_IMAGE_LOCK_TTL_SEC', 10, 1, 30),
  };
}

export function getPlaceholderUrl(): string {
  return getStadiumImageConfig().placeholderUrl;
}

export function isPersistedPlaceholderUrl(url?: string | null): boolean {
  const value = (url ?? '').trim();
  if (!value) return false;
  if (/Football_pitch_pv/i.test(value)) return true;
  if (/\/stadium-placeholder\.svg(\?|$)/i.test(value)) return true;
  const configured = getPlaceholderUrl();
  if (value === configured && !/upload\.wikimedia\.org/i.test(value)) return true;
  return false;
}
