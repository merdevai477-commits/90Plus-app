/**
 * player_info — persistent cache of full Captain AI player answers.
 *
 * Flow:
 * 1. User asks about a player (UCL career or season stats).
 * 2. Lookup by normalized playerName + queryType + language.
 * 3. If fresh → return stored answer instantly (no API, no LLM).
 * 4. If stale → compare API fingerprint; if unchanged extend TTL, else regenerate.
 */

import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  detectPlayerInfoQuery,
  fetchPlayerUclCareerDossier,
  fetchPlayerStatsRow,
  type PlayerInfoQueryType,
} from './chat-football-tools.service';

const TTL_HOURS_UCL = Number(process.env.PLAYER_INFO_TTL_HOURS_UCL ?? 168);
const TTL_HOURS_STATS = Number(process.env.PLAYER_INFO_TTL_HOURS_STATS ?? 24);
const FINGERPRINT_CHECK_HOURS = Number(process.env.PLAYER_INFO_FINGERPRINT_CHECK_HOURS ?? 24);

export type { PlayerInfoQueryType };

export interface PlayerInfoLookup {
  playerName: string;
  queryType: PlayerInfoQueryType;
  language: string;
}

export interface PlayerInfoHit {
  answer: string;
  usedModel: string | null;
  source: 'db_instant' | 'db_refreshed_ttl';
  answeredOn: Date;
  hits: number;
}

function normalizePlayerKey(name: string): string {
  return name.trim().toLowerCase();
}

function ttlMs(queryType: PlayerInfoQueryType): number {
  const hours =
    queryType === 'ucl_career'
      ? TTL_HOURS_UCL
      : TTL_HOURS_STATS;
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return safe * 60 * 60_000;
}

function fingerprintCheckMs(): number {
  const hours =
    Number.isFinite(FINGERPRINT_CHECK_HOURS) && FINGERPRINT_CHECK_HOURS > 0
      ? FINGERPRINT_CHECK_HOURS
      : 24;
  return hours * 60 * 60_000;
}

export function hashApiContext(context: string): string {
  return createHash('sha256').update(context).digest('hex');
}

/** Fetch current API block used to detect data drift (no LLM). */
export async function fetchPlayerApiContext(
  playerName: string,
  queryType: PlayerInfoQueryType,
): Promise<{ context: string; apiPlayerId?: number; displayName?: string } | null> {
  if (queryType === 'ucl_career') {
    const context = await fetchPlayerUclCareerDossier(playerName);
    if (!context) return null;
    const row = await fetchPlayerStatsRow(playerName);
    return {
      context,
      apiPlayerId: row?.apiPlayerId,
      displayName: row?.aliases?.find((a) => !/[\u0600-\u06FF]/.test(a)),
    };
  }

  const row = await fetchPlayerStatsRow(playerName);
  if (!row?.aiResponse) return null;
  return {
    context: row.aiResponse,
    apiPlayerId: row.apiPlayerId,
    displayName: row.aliases?.[0],
  };
}

function needsFingerprintCheck(refreshedAt: Date): boolean {
  return Date.now() - refreshedAt.getTime() >= fingerprintCheckMs();
}

/**
 * Resolve a cached player answer. Returns null on miss or when API data changed
 * (caller should regenerate via LLM + savePlayerInfoAnswer).
 */
export async function resolvePlayerInfoAnswer(
  lookup: PlayerInfoLookup,
): Promise<PlayerInfoHit | null> {
  const playerKey = normalizePlayerKey(lookup.playerName);

  try {
    const row = await prisma.playerInfo.findUnique({
      where: {
        playerName_queryType_language: {
          playerName: playerKey,
          queryType: lookup.queryType,
          language: lookup.language,
        },
      },
    });

    if (!row || !row.answer?.trim()) return null;

    const now = new Date();
    const stillValid = row.expiresAt > now;

    if (stillValid && !needsFingerprintCheck(row.refreshedAt)) {
      prisma.playerInfo
        .update({
          where: { id: row.id },
          data: { hits: { increment: 1 } },
        })
        .catch(() => {});

      return {
        answer: row.answer,
        usedModel: row.usedModel,
        source: 'db_instant',
        answeredOn: row.answeredOn,
        hits: row.hits + 1,
      };
    }

    const freshApi = await fetchPlayerApiContext(lookup.playerName, lookup.queryType);
    if (!freshApi) {
      if (stillValid) {
        return {
          answer: row.answer,
          usedModel: row.usedModel,
          source: 'db_instant',
          answeredOn: row.answeredOn,
          hits: row.hits,
        };
      }
      return null;
    }

    const freshFp = hashApiContext(freshApi.context);
    if (freshFp === row.apiFingerprint) {
      const expiresAt = new Date(Date.now() + ttlMs(lookup.queryType as PlayerInfoQueryType));
      await prisma.playerInfo.update({
        where: { id: row.id },
        data: {
          refreshedAt: now,
          expiresAt,
          hits: { increment: 1 },
          apiContext: freshApi.context.slice(0, 120_000),
        },
      });

      return {
        answer: row.answer,
        usedModel: row.usedModel,
        source: 'db_refreshed_ttl',
        answeredOn: row.answeredOn,
        hits: row.hits + 1,
      };
    }

    logger.info(
      `[PlayerInfo] API drift for ${playerKey}/${lookup.queryType} — regenerating answer`,
    );
    return null;
  } catch (err) {
    logger.warn('[PlayerInfo] lookup failed:', err);
    return null;
  }
}

export async function savePlayerInfoAnswer(params: {
  lookup: PlayerInfoLookup;
  question: string;
  answer: string;
  apiContext: string;
  usedModel: string | null;
  apiPlayerId?: number;
  displayName?: string;
}): Promise<void> {
  const { lookup, question, answer, apiContext, usedModel, apiPlayerId, displayName } =
    params;
  if (!answer || answer.trim().length < 16 || !apiContext?.trim()) return;

  const playerKey = normalizePlayerKey(lookup.playerName);
  const expiresAt = new Date(Date.now() + ttlMs(lookup.queryType));

  try {
    await prisma.playerInfo.upsert({
      where: {
        playerName_queryType_language: {
          playerName: playerKey,
          queryType: lookup.queryType,
          language: lookup.language,
        },
      },
      create: {
        playerName: playerKey,
        displayName: displayName ?? lookup.playerName,
        apiPlayerId: apiPlayerId ?? null,
        queryType: lookup.queryType,
        language: lookup.language,
        questionSample: question.slice(0, 2000),
        answer,
        apiFingerprint: hashApiContext(apiContext),
        apiContext: apiContext.slice(0, 120_000),
        usedModel,
        answeredOn: new Date(),
        refreshedAt: new Date(),
        expiresAt,
      },
      update: {
        displayName: displayName ?? undefined,
        apiPlayerId: apiPlayerId ?? undefined,
        questionSample: question.slice(0, 2000),
        answer,
        apiFingerprint: hashApiContext(apiContext),
        apiContext: apiContext.slice(0, 120_000),
        usedModel,
        refreshedAt: new Date(),
        expiresAt,
      },
    });
  } catch (err) {
    logger.warn('[PlayerInfo] save failed:', err);
  }
}

export { detectPlayerInfoQuery };
