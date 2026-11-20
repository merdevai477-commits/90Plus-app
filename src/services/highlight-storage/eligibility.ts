import { isIP } from 'net';
import { lookup } from 'dns/promises';

export const INGESTION_STATUSES = [
  'EXTERNAL_ONLY',
  'PENDING_INGESTION',
  'DOWNLOADING',
  'UPLOADING',
  'VERIFIED',
  'FAILED',
  'UNAVAILABLE',
  'QUARANTINED',
] as const;

export type IngestionStatus = (typeof INGESTION_STATUSES)[number];

const TRANSITIONS: Record<IngestionStatus, readonly IngestionStatus[]> = {
  EXTERNAL_ONLY: ['EXTERNAL_ONLY'],
  PENDING_INGESTION: ['DOWNLOADING', 'FAILED', 'EXTERNAL_ONLY', 'PENDING_INGESTION'],
  DOWNLOADING: ['UPLOADING', 'VERIFIED', 'FAILED', 'UNAVAILABLE', 'DOWNLOADING'],
  UPLOADING: ['VERIFIED', 'FAILED', 'UPLOADING'],
  VERIFIED: ['VERIFIED'],
  FAILED: ['PENDING_INGESTION', 'DOWNLOADING', 'FAILED', 'QUARANTINED'],
  UNAVAILABLE: ['PENDING_INGESTION', 'UNAVAILABLE'],
  QUARANTINED: ['QUARANTINED'],
};

export function canTransitionIngestion(from: IngestionStatus, to: IngestionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertIngestionTransition(from: IngestionStatus, to: IngestionStatus): void {
  if (!canTransitionIngestion(from, to)) {
    throw new Error(`INVALID_TRANSITION:${from}->${to}`);
  }
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com']);
const BLOCKED_HOSTS = new Set(['streama.in', 'x.com', 'twitter.com']);

export function videoStorageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VIDEO_STORAGE_ENABLED === 'true';
}

export function allowedHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.VIDEO_STORAGE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
}

export function maxFileBytes(env: NodeJS.ProcessEnv = process.env): number {
  const mb = Number(env.VIDEO_STORAGE_MAX_FILE_SIZE_MB || '80');
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 80;
  return Math.floor(safe * 1024 * 1024);
}

/** Streamin watch pages become the CDN MP4 before eligibility and download. */
export function canonicalizeHighlightSource(pageUrl: string): string {
  const trimmed = pageUrl.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'streamin.link' || host === 'streamin.me' || host.endsWith('.streamin.link') || host.endsWith('.streamin.me')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
      if (/^[a-z0-9]+$/i.test(id)) return `https://c-cdn.streamin.top/uploads/${id}.mp4`;
    }
  } catch {
    return trimmed;
  }
  return trimmed.split('#')[0];
}

export function hostAllowed(hostname: string, hosts: string[]): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export type Eligibility =
  | { ok: true; url: string }
  | { ok: false; status: 'EXTERNAL_ONLY'; code: string };

export function classifySourceUrl(rawUrl: string, env: NodeJS.ProcessEnv = process.env): Eligibility {
  const url = canonicalizeHighlightSource(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: 'EXTERNAL_ONLY', code: 'INVALID_URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, status: 'EXTERNAL_ONLY', code: 'UNSUPPORTED_SCHEME' };
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (YOUTUBE_HOSTS.has(host) || [...YOUTUBE_HOSTS].some((item) => host.endsWith(`.${item}`))) {
    return { ok: false, status: 'EXTERNAL_ONLY', code: 'YOUTUBE_EXCLUDED' };
  }
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, status: 'EXTERNAL_ONLY', code: 'UNSUPPORTED_HOST' };
  }
  const direct = /\.(mp4|m3u8)(?:$|\?)/i.test(`${parsed.pathname}${parsed.search}`);
  if (!direct) return { ok: false, status: 'EXTERNAL_ONLY', code: 'NOT_DIRECT_FILE' };
  if (!videoStorageEnabled(env)) return { ok: false, status: 'EXTERNAL_ONLY', code: 'STORAGE_DISABLED' };
  const hosts = allowedHosts(env);
  if (!hosts.length || !hostAllowed(host, hosts)) {
    return { ok: false, status: 'EXTERNAL_ONLY', code: 'HOST_NOT_ALLOWLISTED' };
  }
  return { ok: true, url };
}

export function isPrivateAddress(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^::ffff:/, '');
  if (value === '::1' || value === '0.0.0.0') return true;
  if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
  if (value.startsWith('10.') || value.startsWith('127.') || value.startsWith('169.254.') || value.startsWith('192.168.')) {
    return true;
  }
  const parts = value.split('.').map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => part >= 0 && part <= 255)) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }
  return false;
}

export async function assertPublicHttpUrl(
  rawUrl: string,
  resolveHost: typeof lookup = lookup,
): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('UNSUPPORTED_SCHEME');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('SSRF_BLOCKED');
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('SSRF_BLOCKED');
    return parsed;
  }
  const records = await resolveHost(host, { all: true });
  if (!records.length) throw new Error('SSRF_BLOCKED');
  for (const record of records) {
    if (isPrivateAddress(record.address)) throw new Error('SSRF_BLOCKED');
  }
  return parsed;
}
