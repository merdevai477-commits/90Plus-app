/**
 * chat-voice-quota.service.ts
 *
 * Server-side daily quota for voice → text transcription.
 *
 * Usage is counted from the `chat_voice_operations` ledger (never from a
 * mutable counter), inside a transaction that holds a per-user row lock on
 * `chat_voice_usage` (taken by an upsert, so the first request creates it). That makes "check remaining + reserve one unit" atomic:
 * concurrent requests for the same user queue on the lock, so they can never
 * reserve more units than the limit allows.
 *
 * Lifecycle of one operation (one idempotency key):
 *   RESERVED  → COMMITTED  (non-empty transcript; the only state that is billed)
 *   RESERVED  → RELEASED   (provider error / empty transcript; not billed)
 *   RESERVED  → TIMED_OUT  (ambiguous provider timeout; not billed, recorded)
 * A RESERVED row older than the reservation TTL stops counting, so a crashed
 * request can never pin a unit forever. Commit/release are conditional on
 * (id, attempt, status = RESERVED), so each takes effect at most once and a
 * stale request cannot touch a newer attempt's reservation.
 *
 * Window policy mirrors the message quota: a rolling 24h window anchored at
 * the first voice use after the previous window expired. Unlimited chat users
 * (CHAT_UNLIMITED_USER_IDS) are also unlimited for voice.
 */

import { prisma } from '../lib/prisma';
import { isChatUnlimitedUser } from './chat.service';

export type VoiceOperationStatus = 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'TIMED_OUT';

const WINDOW_MS = 24 * 60 * 60 * 1000;
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
  dailyLimit: number;
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
    dailyLimit: readPositiveInt('VOICE_DAILY_LIMIT', 5),
    maxSeconds,
    serverMaxSeconds: maxSeconds + readPositiveInt('VOICE_SERVER_GRACE_SECONDS', 5),
    reservationTtlMs: readPositiveInt('VOICE_RESERVATION_TTL_MS', 120_000),
  };
}

export interface VoiceQuota {
  limit: number;
  remaining: number;
  used: number;
  unlimited: boolean;
  /** When the current window ends; null when no window is open. */
  resetAt: Date | null;
}

export type ReserveResult =
  | { kind: 'reserved'; operationId: string; attempt: number; quota: VoiceQuota }
  | { kind: 'cached'; transcript: string; quota: VoiceQuota }
  | { kind: 'in_progress'; quota: VoiceQuota }
  | { kind: 'exhausted'; quota: VoiceQuota };

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
  limit: number,
  used: number,
  unlimited: boolean,
  windowStart: Date | null,
): VoiceQuota {
  return {
    limit,
    used: unlimited ? 0 : used,
    remaining: unlimited ? limit : Math.max(0, limit - used),
    unlimited,
    resetAt: windowStart ? new Date(windowStart.getTime() + WINDOW_MS) : null,
  };
}

/** Read-only snapshot for /chat/limit and the transcribe precheck. */
export async function getVoiceQuota(userId: string, now: Date = new Date()): Promise<VoiceQuota> {
  const { dailyLimit, reservationTtlMs } = getVoiceQuotaConfig();
  const unlimited = isChatUnlimitedUser(userId);
  if (unlimited) return buildQuota(dailyLimit, 0, true, null);

  const usage = await prisma.chatVoiceUsage.findUnique({ where: { userId } });
  if (!usage || isWindowExpired(usage.windowStart, now)) {
    return buildQuota(dailyLimit, 0, false, null);
  }
  const used = await prisma.chatVoiceOperation.count({
    where: countableWhere(userId, usage.windowStart, now, reservationTtlMs),
  });
  return buildQuota(dailyLimit, used, false, usage.windowStart);
}

/**
 * Atomically reserve one voice unit for `idempotencyKey`. A key that already
 * committed returns its transcript instead of reserving again.
 */
export async function reserveVoiceUnit(
  userId: string,
  idempotencyKey: string,
  now: Date = new Date(),
): Promise<ReserveResult> {
  const { dailyLimit, reservationTtlMs } = getVoiceQuotaConfig();
  const unlimited = isChatUnlimitedUser(userId);

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

    const countUsed = () =>
      tx.chatVoiceOperation.count({
        where: countableWhere(userId, windowStart, now, reservationTtlMs),
      });

    const existing = await tx.chatVoiceOperation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing?.status === 'COMMITTED') {
      return {
        kind: 'cached' as const,
        transcript: existing.transcript ?? '',
        quota: buildQuota(dailyLimit, await countUsed(), unlimited, windowStart),
      };
    }
    if (
      existing?.status === 'RESERVED' &&
      existing.updatedAt.getTime() > now.getTime() - reservationTtlMs
    ) {
      return {
        kind: 'in_progress' as const,
        quota: buildQuota(dailyLimit, await countUsed(), unlimited, windowStart),
      };
    }

    const used = await countUsed();
    if (!unlimited && used >= dailyLimit) {
      return {
        kind: 'exhausted' as const,
        quota: buildQuota(dailyLimit, used, false, windowStart),
      };
    }

    const op = existing
      ? await tx.chatVoiceOperation.update({
          where: { id: existing.id },
          data: {
            status: 'RESERVED',
            attempt: existing.attempt + 1,
            windowStart,
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
            createdAt: now,
            updatedAt: now,
          },
        });

    return {
      kind: 'reserved' as const,
      operationId: op.id,
      attempt: op.attempt,
      quota: buildQuota(dailyLimit, used + 1, unlimited, windowStart),
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

/** Bill the reservation. Returns false if it was already settled or superseded. */
export function commitVoiceUnit(operationId: string, attempt: number, transcript: string) {
  return settle(operationId, attempt, { status: 'COMMITTED', transcript });
}

/** Give the unit back after a confirmed failure. */
export function releaseVoiceUnit(operationId: string, attempt: number, failureCode: string) {
  return settle(operationId, attempt, { status: 'RELEASED', failureCode });
}

/** The provider may or may not have processed the audio; record it without billing the user. */
export function markVoiceTimedOut(operationId: string, attempt: number) {
  return settle(operationId, attempt, { status: 'TIMED_OUT', failureCode: 'provider_timeout' });
}
