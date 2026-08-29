/**
 * Signed session tokens for the /AsS review desk.
 *
 * Cookie value is `sessionId.hmac`. Session records live in Redis when
 * available, otherwise an in-process Map (single-instance fallback).
 * A hard cap (`ASS_MAX_SESSIONS`, default 3) keeps the shared login from
 * spreading across an unbounded number of browsers.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getRedisClient } from '../lib/redis';

const COOKIE_NAME = 'ass_sid';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_KEY_PREFIX = 'ass:session:';
const INDEX_KEY = 'ass:sessions';

export { COOKIE_NAME as ASS_COOKIE_NAME, SESSION_TTL_SECONDS as ASS_SESSION_TTL_SECONDS };

export function isAssConfigured(): boolean {
  return Boolean(process.env.ASS_USERNAME?.trim() && process.env.ASS_PASSWORD && process.env.ASS_SESSION_SECRET);
}

export function getAssUsername(): string {
  return (process.env.ASS_USERNAME ?? '').trim();
}

function sessionSecret(): string {
  const secret = process.env.ASS_SESSION_SECRET;
  if (!secret) throw new Error('ASS_NOT_CONFIGURED');
  return secret;
}

function maxSessions(): number {
  const n = Number.parseInt(process.env.ASS_MAX_SESSIONS ?? '3', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 3;
}

function timingEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/** Accept `@90plus` and `90plus` against an env value that may include `@`. */
export function credentialsMatch(username: string, password: string): boolean {
  if (!isAssConfigured()) return false;
  const expectedUser = getAssUsername();
  const expectedPass = process.env.ASS_PASSWORD ?? '';
  const raw = username.trim();
  const candidates = raw.startsWith('@') ? [raw] : [raw, `@${raw}`];
  const userOk = candidates.some((c) => timingEqual(c, expectedUser));
  return userOk && timingEqual(password, expectedPass);
}

function sign(sessionId: string): string {
  const hmac = crypto.createHmac('sha256', sessionSecret()).update(sessionId).digest('hex');
  return `${sessionId}.${hmac}`;
}

function parseToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const sessionId = token.slice(0, dot);
  const hmac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', sessionSecret()).update(sessionId).digest('hex');
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sessionId;
}

type SessionRecord = { id: string; createdAt: number };

const memorySessions = new Map<string, SessionRecord>();

async function saveSession(record: SessionRecord): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(
      SESSION_KEY_PREFIX + record.id,
      JSON.stringify(record),
      'EX',
      SESSION_TTL_SECONDS,
    );
    await redis.zadd(INDEX_KEY, record.createdAt, record.id);
    await redis.expire(INDEX_KEY, SESSION_TTL_SECONDS);
    return;
  }
  memorySessions.set(record.id, record);
}

async function loadSession(id: string): Promise<SessionRecord | null> {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(SESSION_KEY_PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionRecord;
    } catch {
      return null;
    }
  }
  return memorySessions.get(id) ?? null;
}

async function deleteSession(id: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(SESSION_KEY_PREFIX + id);
    await redis.zrem(INDEX_KEY, id);
    return;
  }
  memorySessions.delete(id);
}

async function evictOldestIfNeeded(): Promise<void> {
  const cap = maxSessions();
  const redis = getRedisClient();
  if (redis) {
    const ids = await redis.zrange(INDEX_KEY, 0, -1);
    if (ids.length < cap) return;
    const overflow = ids.length - cap + 1;
    const doomed = ids.slice(0, overflow);
    for (const id of doomed) await deleteSession(id);
    return;
  }
  if (memorySessions.size < cap) return;
  const sorted = [...memorySessions.values()].sort((a, b) => a.createdAt - b.createdAt);
  const overflow = memorySessions.size - cap + 1;
  for (const rec of sorted.slice(0, overflow)) memorySessions.delete(rec.id);
}

export async function createAssSession(): Promise<string> {
  if (!isAssConfigured()) throw new Error('ASS_NOT_CONFIGURED');
  await evictOldestIfNeeded();
  const id = crypto.randomBytes(24).toString('hex');
  await saveSession({ id, createdAt: Date.now() });
  return sign(id);
}

export async function verifyAssSession(token: string | undefined): Promise<boolean> {
  if (!isAssConfigured()) return false;
  try {
    const id = parseToken(token);
    if (!id) return false;
    const rec = await loadSession(id);
    return Boolean(rec);
  } catch (err: any) {
    logger.warn('[AsS] verify session failed:', err?.message);
    return false;
  }
}

export async function destroyAssSession(token: string | undefined): Promise<void> {
  try {
    const id = parseToken(token);
    if (id) await deleteSession(id);
  } catch {
    /* ignore */
  }
}

const loginHits = new Map<string, { count: number; resetAt: number }>();

/** Returns true if this IP is still allowed to attempt login. */
export function consumeLoginAttempt(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 12;
  const row = loginHits.get(ip);
  if (!row || row.resetAt < now) {
    loginHits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  return true;
}
