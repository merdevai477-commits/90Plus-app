/**
 * Caps how many times a repeating log signature is forwarded to Sentry.
 *
 * Console logging is unchanged. This only decides whether `Sentry.capture*`
 * should run, so one empty fixture (or one 404 path) cannot exhaust the
 * monthly event quota.
 */

export const SENTRY_REPORT_WINDOW_MS = 60 * 60 * 1000;
export const SENTRY_WARN_MAX_PER_SIGNATURE = 3;
export const SENTRY_ERROR_MAX_PER_SIGNATURE = 5;
/** Hard backstop across all signatures so a wide fan-out cannot burn the quota. */
export const SENTRY_GLOBAL_MAX_PER_WINDOW = 40;

type Bucket = { count: number; windowStart: number };

const signatureBuckets = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, windowStart: 0 };

const MAX_TRACKED_SIGNATURES = 2_000;

export function fingerprintSentryMessage(
  level: 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>,
): string {
  const fixtureFromMsg = String(message).match(/fixture[=:]?\s*(\d+)/i)?.[1];
  const metaFixture = metadata?.fixtureId ?? metadata?.fixture;
  const fixture =
    fixtureFromMsg ??
    (typeof metaFixture === 'number' || typeof metaFixture === 'string'
      ? String(metaFixture)
      : '');
  const path = typeof metadata?.path === 'string' ? metadata.path : '';
  const template = String(message)
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{4,}\b/gi, '#id')
    .replace(/\b\d{4,}\b/g, '#n')
    .replace(/\d{4}-\d{2}-\d{2}T[^\s]+/g, '#ts')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return [level, template, fixture && `fx=${fixture}`, path && `path=${path}`]
    .filter(Boolean)
    .join('|');
}

function resetIfStale(bucket: Bucket, now: number): Bucket {
  if (!bucket.windowStart || now - bucket.windowStart >= SENTRY_REPORT_WINDOW_MS) {
    return { count: 0, windowStart: now };
  }
  return bucket;
}

function pruneExpired(now: number): void {
  if (signatureBuckets.size < MAX_TRACKED_SIGNATURES) return;
  for (const [key, bucket] of signatureBuckets) {
    if (now - bucket.windowStart >= SENTRY_REPORT_WINDOW_MS) {
      signatureBuckets.delete(key);
    }
  }
  if (signatureBuckets.size >= MAX_TRACKED_SIGNATURES) {
    signatureBuckets.clear();
  }
}

/**
 * Returns true when this log should be forwarded to Sentry.
 * Always safe to call — never throws.
 */
export function allowSentryReport(
  level: 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>,
): boolean {
  const now = Date.now();
  pruneExpired(now);

  globalBucket = resetIfStale(globalBucket, now);
  if (globalBucket.count >= SENTRY_GLOBAL_MAX_PER_WINDOW) {
    return false;
  }

  const key = fingerprintSentryMessage(level, message, metadata);
  const perSignatureMax =
    level === 'error' ? SENTRY_ERROR_MAX_PER_SIGNATURE : SENTRY_WARN_MAX_PER_SIGNATURE;
  const current = resetIfStale(signatureBuckets.get(key) ?? { count: 0, windowStart: now }, now);
  if (current.count >= perSignatureMax) {
    signatureBuckets.set(key, current);
    return false;
  }

  current.count += 1;
  signatureBuckets.set(key, current);
  globalBucket.count += 1;
  return true;
}

/** Test-only: wipe in-memory counters. */
export function __resetSentryReportLimiterForTests(): void {
  signatureBuckets.clear();
  globalBucket = { count: 0, windowStart: 0 };
}
