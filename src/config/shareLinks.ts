/**
 * Public HTTPS base for share landing pages (/, /reels/:id, /@username).
 * Served by this backend at the root — not under /api.
 */
export const DEFAULT_SHARE_BASE_URL =
  'https://90plus-app-production-1808.up.railway.app';

export function resolveShareBaseUrl(envValue?: string): string {
  const raw = (envValue ?? DEFAULT_SHARE_BASE_URL).trim().replace(/\/$/, '');
  return raw || DEFAULT_SHARE_BASE_URL;
}

export const SHARE_BASE_URL = resolveShareBaseUrl(process.env.SHARE_BASE_URL);

export function shareUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SHARE_BASE_URL}${normalized}`;
}
