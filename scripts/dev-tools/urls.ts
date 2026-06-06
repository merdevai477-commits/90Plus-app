/**
 * URL constants for dev/test scripts.
 * Users see 90plus.pro — Railway direct URL is team-only (debug / bypass Cloudflare).
 */
export const PUBLIC_SITE_URL = 'https://90plus.pro';
export const PUBLIC_API_URL = 'https://90plus.pro/api';

/** Direct Railway deployment — internal use only, not shown in the app */
export const RAILWAY_INTERNAL_ORIGIN = 'https://90plus-app-production-1808.up.railway.app';
export const RAILWAY_INTERNAL_API_URL = `${RAILWAY_INTERNAL_ORIGIN}/api`;

/** Default target for scripts; override with API_URL or INTERNAL_API_URL */
export function getScriptApiBase(): string {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/api\/?$/, '');
  }
  if (process.env.INTERNAL_API_URL) {
    return process.env.INTERNAL_API_URL.replace(/\/api\/?$/, '');
  }
  return PUBLIC_SITE_URL;
}

export function getScriptApiUrl(): string {
  const base = getScriptApiBase();
  return base.endsWith('/api') ? base : `${base.replace(/\/$/, '')}/api`;
}
