/**
 * Persistent (Postgres) cache for a single player's stats block.
 *
 * Replaces the in-memory player cache for chat football context so repeated
 * questions about the same player survive restarts and are served instantly.
 *
 * Key = englishName + season + statType + competition. Stores both the raw
 * stat payload (statValue) and the formatted AI context block (aiResponse).
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const DEFAULT_TTL_HOURS = Number(process.env.PLAYER_STATS_CACHE_TTL_HOURS ?? 24);
const LIVE_TTL_HOURS = Number(process.env.PLAYER_STATS_CACHE_TTL_LIVE_HOURS ?? 1);

export interface PlayerStatsFetchResult {
  /** Formatted block injected into the AI system prompt. */
  aiResponse: string;
  /** Raw structured payload (stored as JSON for future use / debugging). */
  statValue: unknown;
  apiPlayerId?: number;
  aliases?: string[];
}

export interface CachedPlayerStats extends PlayerStatsFetchResult {
  cached: boolean;
  expiresAt: Date;
}

function ttlMs(isLive: boolean): number {
  const hours = isLive ? LIVE_TTL_HOURS : DEFAULT_TTL_HOURS;
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return safe * 60 * 60_000;
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Return cached stats if fresh, otherwise run `fetcher`, persist, and return.
 * On any DB error we fall back to the fetcher so chat never breaks.
 */
export async function getCachedOrFetch(params: {
  playerName: string;
  statType: string;
  competition: string | null;
  season: string;
  questionAsked: string;
  isLive?: boolean;
  noCache?: boolean;
  fetcher: () => Promise<PlayerStatsFetchResult | null>;
}): Promise<CachedPlayerStats | null> {
  const {
    playerName,
    statType,
    competition,
    season,
    questionAsked,
    isLive = false,
    noCache = false,
    fetcher,
  } = params;

  const nameKey = normalizeKeyPart(playerName);
  const statKey = normalizeKeyPart(statType) || 'general';
  const compKey = normalizeKeyPart(competition);

  // ─── Read cache ────────────────────────────────────────────────────────────
  if (!noCache) {
    try {
      const now = new Date();
      const rows = await prisma.playerStatsCache.findMany({
        where: {
          playerName: nameKey,
          statType: statKey,
          season,
          competition: compKey || null,
          expiresAt: { gt: now },
        },
        orderBy: { fetchedAt: 'desc' },
        take: 1,
      });
      const hit = rows[0];
      if (hit) {
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`[PlayerStats] Cache HIT: ${nameKey} ${statKey} ${season}`);
        }
        return {
          aiResponse: hit.aiResponse,
          statValue: hit.statValue,
          apiPlayerId: hit.apiPlayerId ?? undefined,
          aliases: hit.playerAliases,
          cached: true,
          expiresAt: hit.expiresAt,
        };
      }
    } catch (err) {
      logger.warn(
        '[PlayerStats] cache read failed (continuing to fetch):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ─── Fetch fresh ────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[PlayerStats] Fetching: ${playerName} season ${season}`);
  }
  const fresh = await fetcher();
  if (!fresh) return null;

  const expiresAt = new Date(Date.now() + ttlMs(isLive));

  // ─── Write cache (best-effort, never blocks the answer) ─────────────────────
  if (!noCache) {
    try {
      await prisma.playerStatsCache.create({
        data: {
          playerName: nameKey,
          playerAliases: fresh.aliases ?? [],
          apiPlayerId: fresh.apiPlayerId ?? null,
          competition: compKey || null,
          season,
          statType: statKey,
          statValue: (fresh.statValue ?? {}) as object,
          aiResponse: fresh.aiResponse,
          questionAsked: questionAsked.slice(0, 2000),
          expiresAt,
        },
      });
    } catch (err) {
      logger.warn(
        '[PlayerStats] cache write failed (non-fatal):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    aiResponse: fresh.aiResponse,
    statValue: fresh.statValue,
    apiPlayerId: fresh.apiPlayerId,
    aliases: fresh.aliases,
    cached: false,
    expiresAt,
  };
}

/** Best-effort purge of expired rows (callable from a cron if desired). */
export async function purgeExpiredPlayerStats(): Promise<number> {
  try {
    const res = await prisma.playerStatsCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return res.count;
  } catch (err) {
    logger.warn(
      '[PlayerStats] purge failed:',
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}
