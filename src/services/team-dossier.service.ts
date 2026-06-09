/**
 * DB-first Team / Club dossier for chat context injection.
 *
 * Strategy (quota-aware, Free-Plan friendly):
 *   1. Resolve the club name → apiTeamId (team-name-resolver, alias-dict first).
 *   2. Read cached squad/team rows from team_info + team_player (populated by the
 *      data-refresh worker) → tagged `source: cache`.
 *   3. Fill live gaps via API-Football (Redis-cached at the football.service
 *      layer): last-5 fixtures, current league position, head coach → `source: api`.
 *   4. Assemble a labeled block. Missing pieces are shown as "unavailable" — we
 *      never invent results, positions, or coaches.
 *
 * Additive: brand new file.
 */

import { footballService } from './football.service';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { resolveTeamId } from './team-name-resolver.service';
import { redisCacheService } from './redis-cache.service';
import { footballMetrics } from '../utils/football-metrics';

export type TeamDossierSource = 'api' | 'cache' | 'unavailable';

export interface TeamDossierResult {
  block: string;
  source: TeamDossierSource;
  apiTeamId: number;
}

const TEAM_DOSSIER_TTL_MS = 3 * 60 * 60_000; // ~3h
const TEAM_DOSSIER_NS = 'football:team:';

function currentFootballSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

function resultLetter(
  isHome: boolean,
  goalsHome: number | null,
  goalsAway: number | null,
): string {
  if (goalsHome == null || goalsAway == null) return '?';
  const my = isHome ? goalsHome : goalsAway;
  const opp = isHome ? goalsAway : goalsHome;
  if (my > opp) return 'W';
  if (my < opp) return 'L';
  return 'D';
}

/** Build the team dossier context block, or null when the team can't be resolved. */
export async function fetchTeamDossierContext(
  rawName: string,
  opts?: { allowSearch?: boolean },
): Promise<TeamDossierResult | null> {
  if (!footballService.isConfigured()) return null;

  const resolved = await resolveTeamId(rawName, { allowSearch: opts?.allowSearch !== false });
  if (!resolved) return null;

  const teamId = resolved.apiTeamId;
  const redisKey = `${TEAM_DOSSIER_NS}${teamId}`;

  // Dossier-level Redis cache (separate namespace from football:* proxy keys).
  const cached = await redisCacheService.get<TeamDossierResult>(redisKey);
  if (cached) {
    footballMetrics.recordCacheHit();
    logger.info(`[DossierCache] team HIT ${redisKey}`);
    return cached;
  }
  footballMetrics.recordCacheMiss();
  logger.info(`[DossierCache] team MISS ${redisKey}`);

  const season = currentFootballSeason();
  let usedApi = false;
  let usedCache = false;

  const lines: string[] = [`Team: ${resolved.englishName} (API id ${teamId})`];

  // ── 1. DB-first squad/team info (source: cache) ──────────────────────────
  let leagueIdFromDb: number | null = null;
  try {
    const teamInfo = await prisma.teamInfo.findUnique({
      where: { apiTeamId: teamId },
      include: { players: { take: 8 } },
    });
    if (teamInfo) {
      usedCache = true;
      lines.push(`source: cache | Squad snapshot season ${teamInfo.season}`);
      if (teamInfo.players.length) {
        const notable = teamInfo.players
          .slice(0, 8)
          .map((p) => `${p.playerName}${p.position ? ` (${p.position})` : ''}`)
          .join(', ');
        lines.push(`Notable players (cache): ${notable}`);
      }
    }
  } catch (err) {
    logger.warn(
      '[TeamDossier] team_info read failed:',
      err instanceof Error ? err.message : err,
    );
  }

  // ── 2. Last-5 fixtures (source: api) — also reveals the domestic league id ──
  try {
    const fixtures = await footballService.getFixtures({ team: teamId, last: 5 });
    if (Array.isArray(fixtures) && fixtures.length) {
      usedApi = true;
      const leagueCount = new Map<number, number>();
      const recent = fixtures.map((f: any) => {
        const home = f.teams?.home;
        const away = f.teams?.away;
        const isHome = home?.id === teamId;
        const opp = isHome ? away?.name : home?.name;
        const gh = f.goals?.home ?? null;
        const ga = f.goals?.away ?? null;
        const lid = f.league?.id;
        if (typeof lid === 'number') leagueCount.set(lid, (leagueCount.get(lid) ?? 0) + 1);
        const res = resultLetter(isHome, gh, ga);
        return `${res} vs ${opp ?? '—'} (${gh ?? '?'}-${ga ?? '?'})`;
      });
      lines.push(`source: api | Last ${recent.length} results: ${recent.join(' | ')}`);

      // Most-frequent league among recent fixtures ≈ domestic league.
      let bestLid: number | null = null;
      let bestCount = 0;
      for (const [lid, c] of leagueCount) {
        if (c > bestCount) {
          bestCount = c;
          bestLid = lid;
        }
      }
      leagueIdFromDb = bestLid;
    } else {
      lines.push('source: unavailable | Recent results: not available');
    }
  } catch (err) {
    logger.warn(
      '[TeamDossier] fixtures lookup failed:',
      err instanceof Error ? err.message : err,
    );
    lines.push('source: unavailable | Recent results: not available');
  }

  // ── 3. Current league position (source: api) ─────────────────────────────
  if (leagueIdFromDb != null) {
    try {
      const { flat } = await footballService.getStandingsParsed(leagueIdFromDb, season);
      const myRow = (flat ?? []).find((r: any) => r.team?.id === teamId);
      if (myRow) {
        usedApi = true;
        const leagueName = myRow.group ?? '';
        lines.push(
          `source: api | League position: ${myRow.rank ?? '—'}${
            leagueName ? ` (${leagueName})` : ''
          } — P${myRow.all?.played ?? '—'} Pts ${myRow.points ?? '—'} GD ${myRow.goalsDiff ?? '—'}`,
        );
      } else {
        lines.push('source: unavailable | League position: not available');
      }
    } catch (err) {
      logger.warn(
        '[TeamDossier] standings lookup failed:',
        err instanceof Error ? err.message : err,
      );
      lines.push('source: unavailable | League position: not available');
    }
  } else {
    lines.push('source: unavailable | League position: not available');
  }

  // ── 4. Head coach (source: api) ──────────────────────────────────────────
  try {
    const coaches = await footballService.getTeamCoaches(teamId);
    const current = (coaches ?? []).find((c: any) =>
      (c.career ?? []).some((career: any) => career.team?.id === teamId && !career.end),
    );
    const coach = current ?? (coaches ?? [])[0];
    if (coach?.name) {
      usedApi = true;
      lines.push(`source: api | Head coach: ${coach.name}`);
    } else {
      lines.push('source: unavailable | Head coach: not available');
    }
  } catch (err) {
    logger.warn(
      '[TeamDossier] coaches lookup failed:',
      err instanceof Error ? err.message : err,
    );
    lines.push('source: unavailable | Head coach: not available');
  }

  const source: TeamDossierSource = usedApi ? 'api' : usedCache ? 'cache' : 'unavailable';

  const block = [
    `=== TEAM DOSSIER: ${resolved.englishName} ===`,
    ...lines,
    '',
    'NOTE: Use ONLY the figures above. Items marked "unavailable" have no verified data — do not invent them.',
  ].join('\n');

  const result: TeamDossierResult = { block, source, apiTeamId: teamId };
  // Only persist dossiers that actually carry data (don't cache empty shells).
  if (source !== 'unavailable') {
    await redisCacheService.set(redisKey, result, TEAM_DOSSIER_TTL_MS);
  }
  return result;
}
