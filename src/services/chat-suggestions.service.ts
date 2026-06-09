/**
 * chat-suggestions — teammate follow-up suggestions for Captain AI.
 *
 * After a player question resolves, surface up to 3 teammates the user is
 * likely to ask about next. Ranking:
 *   Priority 1: teammate already has cached data in player_info (instant answer)
 *   Priority 2: highest accessCount (most-queried by users)
 *
 * Purely additive and best-effort — returns [] on any miss or failure.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface ChatSuggestion {
  name: string;
  query: string;
}

const MAX_SUGGESTIONS = 3;

function buildQuery(name: string, language: string): string {
  return language === 'ar' ? `إيه إحصائيات ${name}؟` : `What are ${name}'s stats?`;
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Find up to 3 teammate suggestions for a cached player.
 *
 * @param opts.apiPlayerId  API-Football id of the asked player (preferred lookup)
 * @param opts.teamId       Optional TeamInfo id when already known
 * @param opts.playerName   Asked player's name (fallback lookup + exclusion)
 * @param opts.language     "ar" | "en" — query template language
 * @param opts.excludeName  The asked player's name, excluded from results
 */
export async function getTeamSuggestions(opts: {
  apiPlayerId?: number;
  teamId?: number;
  playerName?: string;
  language: string;
  excludeName?: string;
}): Promise<ChatSuggestion[]> {
  const { language } = opts;
  let { apiPlayerId } = opts;
  const excludeName = opts.excludeName ?? opts.playerName;

  try {
    // 1. Resolve the player's TeamInfo (via explicit teamId, apiPlayerId, or name).
    let teamId = opts.teamId ?? null;

    if ((!teamId || !apiPlayerId) && (apiPlayerId || opts.playerName)) {
      const playerRow = await prisma.playerInfo.findFirst({
        where: apiPlayerId
          ? { apiPlayerId }
          : { playerName: normalizeKey(opts.playerName ?? '') },
        select: { teamId: true, apiPlayerId: true },
      });
      teamId = teamId ?? playerRow?.teamId ?? null;
      apiPlayerId = apiPlayerId ?? playerRow?.apiPlayerId ?? undefined;
    }

    if (!teamId) return [];

    // 2. Pull the team roster.
    const roster = await prisma.teamPlayer.findMany({
      where: { teamInfoId: teamId },
      select: { apiPlayerId: true, playerName: true },
    });
    if (roster.length === 0) return [];

    const excludeKey = excludeName ? normalizeKey(excludeName) : null;
    const candidates = roster.filter(
      (p) => p.apiPlayerId !== apiPlayerId && (!excludeKey || normalizeKey(p.playerName) !== excludeKey),
    );
    if (candidates.length === 0) return [];

    // 3. Find which teammates already have cached data + their accessCount.
    const candidateIds = candidates.map((c) => c.apiPlayerId);
    const cached = await prisma.playerInfo.findMany({
      where: { apiPlayerId: { in: candidateIds } },
      select: { apiPlayerId: true, accessCount: true, hits: true, displayName: true },
    });

    const cachedById = new Map<number, { score: number; displayName: string | null }>();
    for (const row of cached) {
      if (row.apiPlayerId == null) continue;
      const score = Math.max(row.accessCount ?? 0, row.hits ?? 0);
      const existing = cachedById.get(row.apiPlayerId);
      if (!existing || score > existing.score) {
        cachedById.set(row.apiPlayerId, { score, displayName: row.displayName });
      }
    }

    // 4. Rank: cached-first, then by access score.
    const ranked = candidates
      .map((c) => {
        const meta = cachedById.get(c.apiPlayerId);
        return {
          name: meta?.displayName?.trim() || c.playerName,
          hasCache: !!meta,
          score: meta?.score ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.hasCache !== b.hasCache) return a.hasCache ? -1 : 1;
        return b.score - a.score;
      });

    // Dedupe by name and take the top N.
    const seen = new Set<string>();
    const out: ChatSuggestion[] = [];
    for (const r of ranked) {
      const key = normalizeKey(r.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: r.name, query: buildQuery(r.name, language) });
      if (out.length >= MAX_SUGGESTIONS) break;
    }

    return out;
  } catch (err) {
    logger.warn('[ChatSuggestions] lookup failed:', err);
    return [];
  }
}
