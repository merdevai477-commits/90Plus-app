/**
 * Client-side privacy filter for diagnostics payloads. The server enforces a
 * strict per-type schema as well; this filter guarantees that a hook passing
 * the wrong object by mistake (a whole fixture, a URL, user text) can never
 * put it in the upload queue.
 */

const SAFE_TEXT = /^[\w .:|+\-/()#@,]*$/;
/** URL- or email-shaped strings are refused even when every character is allowed. */
const LOOKS_IDENTIFYING = /:\/\/|@[\w-]+\.|www\./i;
const MAX_STRING = 96;
const MAX_ARRAY = 8;
const MAX_RECORD_KEYS = 64;
const SAFE_KEY = /^[\w\-:.]{1,48}$/;

function safeScalar(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    return value.length <= MAX_STRING && SAFE_TEXT.test(value) && !LOOKS_IDENTIFYING.test(value) ? value : undefined;
  }
  return undefined;
}

function safeRecord(value: object): Record<string, number | boolean> | undefined {
  const out: Record<string, number | boolean> = {};
  let keys = 0;
  for (const [key, inner] of Object.entries(value)) {
    if (!SAFE_KEY.test(key)) continue;
    if (typeof inner === 'boolean' || (typeof inner === 'number' && Number.isFinite(inner))) {
      out[key] = inner;
      keys += 1;
      if (keys >= MAX_RECORD_KEYS) break;
    }
  }
  return keys > 0 ? out : undefined;
}

/**
 * Keeps finite numbers, booleans, null, short identifier-like strings, short
 * arrays of those, and flat records of numbers or booleans. Everything else
 * (nested objects, long or free-form strings, functions) is dropped.
 */
export function sanitizeDiagData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (!SAFE_KEY.test(key)) continue;
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY).map(safeScalar).filter((item) => item !== undefined);
      if (items.length) out[key] = items;
      continue;
    }
    if (value && typeof value === 'object') {
      const record = safeRecord(value);
      if (record) out[key] = record;
      continue;
    }
    const scalar = safeScalar(value);
    if (scalar !== undefined) out[key] = scalar;
  }
  return out;
}

/**
 * The only match data diagnostics ever send: `status|elapsed|extra|home-away`.
 */
export function fixtureSignature(input: {
  status?: string | null;
  elapsed?: number | null;
  extra?: number | null;
  home?: number | null;
  away?: number | null;
}): string {
  const status = (input.status ?? '').replace(/[^\w]/g, '').slice(0, 8) || 'NA';
  const part = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value) ? 'null' : String(Math.trunc(value));
  return `${status}|${part(input.elapsed)}|${part(input.extra)}|${part(input.home)}-${part(input.away)}`;
}

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic per-fixture sampling: the same fixture is either always in or
 * always out for a session, so sampled traces stay complete end to end.
 */
export function shouldSampleFixture(fixtureId: number | string, rate: number, salt: string): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return hash32(`${salt}:${fixtureId}`) % 10_000 < rate * 10_000;
}
