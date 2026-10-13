/**
 * chat-voice-quota.service.ts
 *
 * Server-side daily allowance of voice → text transcription time.
 *
 * The allowance is a duration (VOICE_DAILY_SECONDS, default 150s = 2:30), not
 * a number of recordings. Every operation in the `chat_voice_operations`
 * ledger carries the milliseconds it charges, measured by the server from the
 * decoded audio — never a client-supplied value. Usage is the sum of those
 * charges (never a mutable counter), computed inside a transaction that holds
 * a per-user row lock on `chat_voice_usage` (taken by an upsert, so the first
 * request creates it). That makes "check remaining + reserve this duration"
 * atomic: concurrent requests for the same user queue on the lock, so together
 * they can never reserve more time than the allowance.
 *
 * Accounting unit: integer milliseconds, rounded to the nearest ms. A 10s clip
 * costs 10s; nothing is rounded up to a whole second or minute. Clients get
 * whole seconds, floored, so they never see more time than is really left.
 * The allowance counts as used up once less than one minimum recording
 * (1s) remains, which is exactly when the reported remaining seconds hit 0.
 *
 * Lifecycle of one operation (one idempotency key):
 *   RESERVED  → COMMITTED  (non-empty transcript; the only state that is charged)
 *   RESERVED  → RELEASED   (provider error / empty transcript; not charged)
 *   RESERVED  → TIMED_OUT  (ambiguous provider timeout; not charged, recorded)
 * A RESERVED row older than the reservation TTL stops counting, so a crashed
 * request can never pin time forever. Commit/release are conditional on
 * (id, attempt, status = RESERVED), so each takes effect at most once and a
 * stale request cannot touch a newer attempt's reservation.
 *
 * Window policy mirrors the message quota: a rolling 24h window anchored at
 * the first voice use after the previous window expired. It has its own
 * anchor — sharing the message window would let voice use open or move the
 * message window. Unlimited chat users (CHAT_UNLIMITED_USER_IDS) are also
 * unlimited for voice.
 *
 * Operations recorded before durations were tracked have durationMs = 0, so
 * they neither inflate nor refund anyone's new allowance.
 */

import { prisma } from '../lib/prisma';
import { isChatUnlimitedUser } from './chat.service';

export type VoiceOperationStatus = 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'TIMED_OUT';

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Shortest recording the app accepts; below this much time left, voice is used up. */
export const MIN_VOICE_RECORDING_MS = 1_000;
/**
 * The app stops recording at the time left by its own clock; the decoded clip
 * can run a few audio frames longer. Within this margin the clip is charged
 * only what is left, so the allowance is never exceeded and the user isn't
 * refused over encoder padding.
 */
const OVERRUN_TOLERANCE_MS = 1_000;
/**
 * Same-user requests queue on the row lock; Prisma's 2s default start budget
 * turns a burst into errors. A request that still can't start fails without
 * reserving anything.
 */
const RESERVE_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export interface VoiceQuotaConfig {
  /** Daily allowance of transcribed audio. */
  dailyMs: number;
  /** Recording cap the app enforces. */
  maxSeconds: number;
  /** Hard cap the server enforces on the decoded audio (app cap + grace). */
  serverMaxSeconds: number;
  /** A RESERVED operation older than this no longer counts against the quota. */
  reservationTtlMs: number;
}

/** Read per call so env changes apply on the next backend restart without an app release. */
export function getVoiceQuotaConfig(): VoiceQuotaConfig {
  const maxSeconds = readPositiveInt('VOICE_MAX_SECONDS', 30);
  return {
    dailyMs: readPositiveInt('VOICE_DAILY_SECONDS', 150) * 1000,
    maxSeconds,
    serverMaxSeconds: maxSeconds + readPositiveInt('VOICE_SERVER_GRACE_SECONDS', 5),
    reservationTtlMs: readPositiveInt('VOICE_RESERVATION_TTL_MS', 120_000),
  };
}

export interface VoiceQuota {
  limitMs: number;
  usedMs: number;
  remainingMs: number;
  /** True once less than one minimum recording is left (never for unlimited users). */
  exhausted: boolean;
  unlimited: boolean;
  /** When the current window ends; null when no window is open. */
  resetAt: Date | null;
}

export type ReserveResult =
  | { kind: 'reserved'; operationId: string; attempt: number; chargedMs: number; quota: VoiceQuota }
  | { kind: 'cached'; transcript: string; quota: VoiceQuota }
  | { kind: 'in_progress'; quota: VoiceQuota }
  | { kind: 'exhausted'; quota: VoiceQuota }
  /** Time is left, but less than this clip needs. */
  | { kind: 'insufficient'; quota: VoiceQuota };

function isWindowExpired(windowStart: Date, now: Date): boolean {
  return now.getTime() - windowStart.getTime() >= WINDOW_MS;
}

function countableWhere(userId: string, windowStart: Date, now: Date, ttlMs: number) {
  return {
    userId,
    windowStart,
    OR: [
      { status: 'COMMITTED' },
      { status: 'RESERVED', updatedAt: { gt: new Date(now.getTime() - ttlMs) } },
    ],
  };
}

function buildQuota(
  limitMs: number,
  usedMs: number,
  unlimited: boolean,
  windowStart: Date | null,
): VoiceQuota {
  const remainingMs = unlimited ? limitMs : Math.max(0, limitMs - usedMs);
  return {
    limitMs,
    usedMs: unlimited ? 0 : usedMs,
    remainingMs,
    exhausted: !unlimited && remainingMs < MIN_VOICE_RECORDING_MS,
    unlimited,
    resetAt: windowStart ? new Date(windowStart.getTime() + WINDOW_MS) : null,
  };
}

type UsageReader = Pick<typeof prisma, 'chatVoiceOperation'>;

async function sumUsedMs(
  db: UsageReader,
  userId: string,
  windowStart: Date,
  now: Date,
  ttlMs: number,
): Promise<number> {
  const agg = await db.chatVoiceOperation.aggregate({
    where: countableWhere(userId, windowStart, now, ttlMs),
    _sum: { durationMs: true },
  });
  return agg._sum.durationMs ?? 0;
}

/** Read-only snapshot for /chat/limit and the transcribe precheck. */
export async function getVoiceQuota(userId: string, now: Date = new Date()): Promise<VoiceQuota> {
  const { dailyMs, reservationTtlMs } = getVoiceQuotaConfig();
  if (isChatUnlimitedUser(userId)) return buildQuota(dailyMs, 0, true, null);

  const usage = await prisma.chatVoiceUsage.findUnique({ where: { userId } });
  if (!usage || isWindowExpired(usage.windowStart, now)) {
    return buildQuota(dailyMs, 0, false, null);
  }
  const usedMs = await sumUsedMs(prisma, userId, usage.windowStart, now, reservationTtlMs);
  return buildQuota(dailyMs, usedMs, false, usage.windowStart);
}

/**
 * Atomically reserve `durationMs` of voice time for `idempotencyKey`. A key
 * that already committed returns its transcript instead of reserving again.
 */
export async function reserveVoiceDuration(
  userId: string,
  idempotencyKey: string,
  durationMs: number,
  now: Date = new Date(),
): Promise<ReserveResult> {
  const { dailyMs, reservationTtlMs } = getVoiceQuotaConfig();
  const unlimited = isChatUnlimitedUser(userId);
  const requestedMs = Math.max(0, Math.round(durationMs));

  return prisma.$transaction(async (tx) => {
    // ON CONFLICT DO UPDATE row-locks the usage row until commit, like SELECT … FOR UPDATE.
    const locked = await tx.$queryRaw<{ windowStart: Date }[]>`
      INSERT INTO "chat_voice_usage" ("userId", "windowStart", "updatedAt")
      VALUES (${userId}, ${now}, ${now})
      ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "windowStart"`;

    let windowStart = new Date(locked[0].windowStart);
    if (isWindowExpired(windowStart, now)) {
      windowStart = now;
      await tx.chatVoiceUsage.update({ where: { userId }, data: { windowStart } });
    }

    const usedMs = await sumUsedMs(tx, userId, windowStart, now, reservationTtlMs);
    const quotaWith = (extraMs: number) => buildQuota(dailyMs, usedMs + extraMs, unlimited, windowStart);

    const existing = await tx.chatVoiceOperation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing?.status === 'COMMITTED') {
      return { kind: 'cached' as const, transcript: existing.transcript ?? '', quota: quotaWith(0) };
    }
    if (
      existing?.status === 'RESERVED' &&
      existing.updatedAt.getTime() > now.getTime() - reservationTtlMs
    ) {
      return { kind: 'in_progress' as const, quota: quotaWith(0) };
    }

    const current = quotaWith(0);
    if (current.exhausted) return { kind: 'exhausted' as const, quota: current };
    if (!unlimited && requestedMs > current.remainingMs + OVERRUN_TOLERANCE_MS) {
      return { kind: 'insufficient' as const, quota: current };
    }
    const chargedMs = unlimited ? requestedMs : Math.min(requestedMs, current.remainingMs);

    const op = existing
      ? await tx.chatVoiceOperation.update({
          where: { id: existing.id },
          data: {
            status: 'RESERVED',
            attempt: existing.attempt + 1,
            windowStart,
            durationMs: chargedMs,
            transcript: null,
            failureCode: null,
            updatedAt: now,
          },
        })
      : await tx.chatVoiceOperation.create({
          data: {
            userId,
            idempotencyKey,
            status: 'RESERVED',
            windowStart,
            durationMs: chargedMs,
            createdAt: now,
            updatedAt: now,
          },
        });

    return {
      kind: 'reserved' as const,
      operationId: op.id,
      attempt: op.attempt,
      chargedMs,
      quota: quotaWith(chargedMs),
    };
  }, RESERVE_TX_OPTIONS);
}

async function settle(
  operationId: string,
  attempt: number,
  data: { status: VoiceOperationStatus; transcript?: string; failureCode?: string },
): Promise<boolean> {
  const res = await prisma.chatVoiceOperation.updateMany({
    where: { id: operationId, attempt, status: 'RESERVED' },
    data,
  });
  return res.count === 1;
}

/** Charge the reserved duration. Returns false if it was already settled or superseded. */
export function commitVoiceOperation(operationId: string, attempt: number, transcript: string) {
  return settle(operationId, attempt, { status: 'COMMITTED', transcript });
}

/** Give the reserved time back after a confirmed failure. */
export function releaseVoiceOperation(operationId: string, attempt: number, failureCode: string) {
  return settle(operationId, attempt, { status: 'RELEASED', failureCode });
}

/** The provider may or may not have processed the audio; record it without charging the user. */
export function markVoiceTimedOut(operationId: string, attempt: number) {
  return settle(operationId, attempt, { status: 'TIMED_OUT', failureCode: 'provider_timeout' });
}

/** Whole seconds for clients, floored so the app never offers time that isn't there. */
export function voiceQuotaResponseFields(quota: VoiceQuota) {
  return {
    voiceRemainingSeconds: quota.exhausted ? 0 : Math.floor(quota.remainingMs / 1000),
    voiceLimitSeconds: Math.floor(quota.limitMs / 1000),
    voiceResetAt: quota.resetAt ? quota.resetAt.toISOString() : null,
  };
}
