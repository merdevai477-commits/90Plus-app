/**
 * dataRefreshWorker — proactive background refresh for player_info / TeamInfo.
 *
 * Keeps cached Captain AI player answers fresh WITHOUT waiting for users.
 * Three independent cron schedules, each fully isolated:
 *
 *   A. Weekly  (Mon 04:00 UTC) — recent form: last 5 fixtures + season stats.
 *   B. Monthly (1st 03:00 UTC) — season stats + trophies + TeamInfo rosters.
 *   C. 100-day (checked daily 02:00 UTC) — transfer data + team re-linking.
 *
 * Safety contract:
 *   - Every schedule body is wrapped in try/catch and NEVER throws.
 *   - Per-player work runs through pLimit(3) (bounded concurrency).
 *   - All API access goes through footballService (Redis-cached) — no direct
 *     API-Football calls.
 *   - A per-schedule `isRunning` guard prevents overlapping runs.
 *   - player_info (Postgres) is the source of truth for answers; the worker
 *     never writes Redis directly, so Redis/DB cannot diverge.
 */

import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { footballService } from './../services/football.service';
import {
  fetchPlayerApiContext,
  hashApiContext,
  regeneratePlayerInfoAnswer,
  type PlayerInfoQueryType,
} from '../services/player-info-cache.service';
import { pLimit } from './concurrency.util';

const CONCURRENCY = 3;
const WEEKLY_TTL_MS = 7 * 24 * 60 * 60_000;
const MONTHLY_TTL_MS = 30 * 24 * 60 * 60_000;
const TRANSFERS_INTERVAL_DAYS = 100;
const TRANSFERS_CONTROL_KEY = 'transfers_last_run';

/** API-Football season year: July+ rolls over to the new season. */
function currentSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

function shortErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 120);
}

// Per-schedule overlap guards.
const isRunning = { weekly: false, monthly: false, transfers: false };

interface RefreshTargetRow {
  id: string;
  playerName: string;
  displayName: string | null;
  apiPlayerId: number | null;
  queryType: string;
  language: string;
  apiFingerprint: string;
}

/**
 * Core single-row refresh: re-pull the authoritative API context, compare the
 * fingerprint, and either extend the TTL (data unchanged) or regenerate the
 * answer (data drifted). Returns true on a successful refresh, false on skip.
 */
async function refreshPlayerRow(
  row: RefreshTargetRow,
  refreshType: 'weekly' | 'monthly',
  ttlMs: number,
): Promise<boolean> {
  const queryType = row.queryType as PlayerInfoQueryType;

  // Warm recent fixtures for weekly form (cached via fetchFromApi).
  if (refreshType === 'weekly' && row.apiPlayerId) {
    try {
      await footballService.fetchFromApi('/fixtures', { player: row.apiPlayerId, last: 5 });
    } catch {
      /* non-fatal — the stats context below is what we fingerprint */
    }
  }

  // Monthly also warms trophies (used by the UCL dossier context).
  if (refreshType === 'monthly' && row.apiPlayerId) {
    try {
      await footballService.getPlayerTrophies(row.apiPlayerId);
    } catch {
      /* non-fatal */
    }
  }

  const fresh = await fetchPlayerApiContext(row.playerName, queryType);
  if (!fresh?.context) {
    // No API data right now (down / quota / not found) → skip, keep old answer.
    return false;
  }

  const freshFp = hashApiContext(fresh.context);
  const expiresAt = new Date(Date.now() + ttlMs);

  if (freshFp === row.apiFingerprint) {
    // Data unchanged → just extend the TTL and tag the refresh.
    await prisma.playerInfo.update({
      where: { id: row.id },
      data: {
        refreshedAt: new Date(),
        expiresAt,
        lastRefreshType: refreshType,
        apiContext: fresh.context.slice(0, 120_000),
        ...(fresh.apiPlayerId ? { apiPlayerId: fresh.apiPlayerId } : {}),
      },
    });
    return true;
  }

  // Data drifted → regenerate the answer from the fresh context.
  const newAnswer = await regeneratePlayerInfoAnswer(
    { playerName: row.playerName, queryType, language: row.language },
    fresh.context,
  );
  if (!newAnswer) {
    // Regeneration failed → skip (do NOT update fingerprint so we retry later).
    return false;
  }

  await prisma.playerInfo.update({
    where: { id: row.id },
    data: {
      answer: newAnswer,
      apiFingerprint: freshFp,
      apiContext: fresh.context.slice(0, 120_000),
      refreshedAt: new Date(),
      expiresAt,
      lastRefreshType: refreshType,
      ...(fresh.apiPlayerId ? { apiPlayerId: fresh.apiPlayerId } : {}),
    },
  });
  return true;
}

// ============================================================
// Schedule A — Weekly (Mon 04:00 UTC): recent form / season stats
// ============================================================
async function runWeeklyRefresh(): Promise<void> {
  if (isRunning.weekly) {
    logger.warn('[Worker][weekly] previous run still active — skipping');
    return;
  }
  isRunning.weekly = true;
  try {
    const rows = await prisma.playerInfo.findMany({
      where: { queryType: 'season_stats' },
      orderBy: [{ refreshPriority: 'asc' }, { accessCount: 'desc' }],
      select: {
        id: true,
        playerName: true,
        displayName: true,
        apiPlayerId: true,
        queryType: true,
        language: true,
        apiFingerprint: true,
      },
    });

    logger.info(`[Worker][weekly] started — ${rows.length} players queued`);
    if (rows.length === 0) return;

    const limit = pLimit(CONCURRENCY);
    let refreshed = 0;

    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          const label = row.displayName ?? row.playerName;
          const startedAt = Date.now();
          try {
            const ok = await refreshPlayerRow(row, 'weekly', WEEKLY_TTL_MS);
            if (ok) {
              refreshed += 1;
              logger.info(`[Worker][weekly] ✅ ${label} refreshed in ${Date.now() - startedAt}ms`);
            } else {
              logger.info(`[Worker][weekly] ⚠️ skip: ${label} — no fresh data`);
            }
          } catch (err) {
            logger.warn(`[Worker][weekly] ⚠️ skip: ${label} — ${shortErr(err)}`);
          }
        }),
      ),
    );

    logger.info(`[Worker][weekly] done — ${refreshed}/${rows.length} refreshed`);
  } catch (err) {
    logger.error('[Worker][weekly] fatal (recovered):', err);
  } finally {
    isRunning.weekly = false;
  }
}

// ============================================================
// Schedule B — Monthly (1st 03:00 UTC): season stats + trophies + rosters
// ============================================================
async function runMonthlyRefresh(): Promise<void> {
  if (isRunning.monthly) {
    logger.warn('[Worker][monthly] previous run still active — skipping');
    return;
  }
  isRunning.monthly = true;
  try {
    const rows = await prisma.playerInfo.findMany({
      where: { queryType: { in: ['season_stats', 'ucl_career'] } },
      orderBy: [{ refreshPriority: 'asc' }, { accessCount: 'desc' }],
      select: {
        id: true,
        playerName: true,
        displayName: true,
        apiPlayerId: true,
        queryType: true,
        language: true,
        apiFingerprint: true,
      },
    });

    logger.info(`[Worker][monthly] started — ${rows.length} players queued`);

    const limit = pLimit(CONCURRENCY);
    let refreshed = 0;

    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          const label = row.displayName ?? row.playerName;
          const startedAt = Date.now();
          try {
            const ok = await refreshPlayerRow(row, 'monthly', MONTHLY_TTL_MS);
            if (ok) {
              refreshed += 1;
              logger.info(`[Worker][monthly] ✅ ${label} refreshed in ${Date.now() - startedAt}ms`);
            } else {
              logger.info(`[Worker][monthly] ⚠️ skip: ${label} — no fresh data`);
            }
          } catch (err) {
            logger.warn(`[Worker][monthly] ⚠️ skip: ${label} — ${shortErr(err)}`);
          }
        }),
      ),
    );

    logger.info(`[Worker][monthly] done — ${refreshed}/${rows.length} refreshed`);

    // Refresh team rosters + link players (additive, isolated).
    await syncTeamRosters();
  } catch (err) {
    logger.error('[Worker][monthly] fatal (recovered):', err);
  } finally {
    isRunning.monthly = false;
  }
}

/**
 * Resolve a player's current API team id from their season statistics.
 * Returns null when unavailable (down / quota / no club data).
 */
async function resolvePlayerTeam(
  apiPlayerId: number,
): Promise<{ apiTeamId: number; teamName: string } | null> {
  try {
    const rows = await footballService.getPlayerStatistics(apiPlayerId, currentSeason());
    const stats = rows?.[0]?.statistics ?? [];
    const withTeam = stats.find((s: any) => s?.team?.id);
    if (!withTeam?.team?.id) return null;
    return { apiTeamId: withTeam.team.id, teamName: withTeam.team.name ?? `Team ${withTeam.team.id}` };
  } catch {
    return null;
  }
}

/**
 * Upsert a TeamInfo + its TeamPlayer squad, then back-link any PlayerInfo rows
 * whose apiPlayerId appears in the squad. Returns the TeamInfo id (or null).
 *
 * Players in PlayerInfo who are NOT in the current squad keep their row but are
 * NOT linked here; Schedule C (transfers) is the authoritative source for
 * teamId changes when a player leaves.
 */
async function syncTeamRoster(apiTeamId: number, teamName: string): Promise<number | null> {
  try {
    const expiresAt = new Date(Date.now() + MONTHLY_TTL_MS);
    const teamInfo = await prisma.teamInfo.upsert({
      where: { apiTeamId },
      create: {
        apiTeamId,
        teamName,
        season: currentSeason(),
        lastFetched: new Date(),
        expiresAt,
      },
      update: {
        teamName,
        season: currentSeason(),
        lastFetched: new Date(),
        expiresAt,
      },
    });

    const squadRows = await footballService.getTeamSquad(apiTeamId);
    const squad = squadRows?.[0]?.players ?? [];
    if (!Array.isArray(squad) || squad.length === 0) return teamInfo.id;

    // Replace the roster snapshot atomically.
    await prisma.$transaction([
      prisma.teamPlayer.deleteMany({ where: { teamInfoId: teamInfo.id } }),
      prisma.teamPlayer.createMany({
        data: squad
          .filter((p: any) => p?.id && p?.name)
          .map((p: any) => ({
            teamInfoId: teamInfo.id,
            apiPlayerId: p.id,
            playerName: p.name,
            position: p.position ?? 'Unknown',
            jerseyNumber: typeof p.number === 'number' ? p.number : null,
          })),
      }),
    ]);

    // Back-link PlayerInfo rows that belong to this squad.
    const squadIds = squad.map((p: any) => p?.id).filter((id: any): id is number => Number.isInteger(id));
    if (squadIds.length > 0) {
      await prisma.playerInfo.updateMany({
        where: { apiPlayerId: { in: squadIds } },
        data: { teamId: teamInfo.id },
      });
    }

    return teamInfo.id;
  } catch (err) {
    logger.warn(`[Worker][monthly] ⚠️ roster sync failed for team ${apiTeamId} — ${shortErr(err)}`);
    return null;
  }
}

/** Discover the distinct teams referenced by cached players, then sync each. */
async function syncTeamRosters(): Promise<void> {
  try {
    const players = await prisma.playerInfo.findMany({
      where: { apiPlayerId: { not: null } },
      select: { apiPlayerId: true },
      distinct: ['apiPlayerId'],
    });

    const teamMap = new Map<number, string>();
    const limit = pLimit(CONCURRENCY);

    await Promise.all(
      players.map((p) =>
        limit(async () => {
          if (!p.apiPlayerId) return;
          const team = await resolvePlayerTeam(p.apiPlayerId);
          if (team) teamMap.set(team.apiTeamId, team.teamName);
        }),
      ),
    );

    logger.info(`[Worker][monthly] roster sync — ${teamMap.size} team(s) to refresh`);

    const teamLimit = pLimit(CONCURRENCY);
    let synced = 0;
    await Promise.all(
      Array.from(teamMap.entries()).map(([apiTeamId, teamName]) =>
        teamLimit(async () => {
          const id = await syncTeamRoster(apiTeamId, teamName);
          if (id) synced += 1;
        }),
      ),
    );

    logger.info(`[Worker][monthly] roster sync done — ${synced}/${teamMap.size} teams`);
  } catch (err) {
    logger.warn('[Worker][monthly] ⚠️ roster discovery failed —', shortErr(err));
  }
}

// ============================================================
// Schedule C — Every 100 days (checked daily 02:00 UTC): transfers
// ============================================================
function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (24 * 60 * 60_000);
}

async function runTransfersRefresh(): Promise<void> {
  if (isRunning.transfers) return;
  isRunning.transfers = true;
  try {
    const control = await prisma.refreshControl.findUnique({
      where: { key: TRANSFERS_CONTROL_KEY },
    });

    if (control?.value) {
      const lastRun = new Date(control.value);
      if (!Number.isNaN(lastRun.getTime()) && daysSince(lastRun) < TRANSFERS_INTERVAL_DAYS) {
        // Not due yet — silent (this check runs daily).
        return;
      }
    }

    const rows = await prisma.playerInfo.findMany({
      where: { apiPlayerId: { not: null } },
      orderBy: [{ refreshPriority: 'asc' }, { accessCount: 'desc' }],
      select: {
        id: true,
        playerName: true,
        displayName: true,
        apiPlayerId: true,
        teamId: true,
      },
      distinct: ['apiPlayerId'],
    });

    logger.info(`[Worker][100day] started — ${rows.length} players queued`);

    const limit = pLimit(CONCURRENCY);
    let refreshed = 0;

    await Promise.all(
      rows.map((row) =>
        limit(async () => {
          const label = row.displayName ?? row.playerName;
          const startedAt = Date.now();
          try {
            if (!row.apiPlayerId) return;
            const transfers = await footballService.getTransfers({ player: row.apiPlayerId });
            const history = transfers?.[0]?.transfers ?? [];
            if (!Array.isArray(history) || history.length === 0) {
              logger.info(`[Worker][100day] ⚠️ skip: ${label} — no transfer data`);
              return;
            }

            // Most recent transfer = newest date.
            const latest = [...history].sort(
              (a: any, b: any) => new Date(b?.date ?? 0).getTime() - new Date(a?.date ?? 0).getTime(),
            )[0];
            const inTeam = latest?.teams?.in;
            if (!inTeam?.id) return;

            // Map current teamId → apiTeamId to detect a real change.
            const currentTeam = row.teamId
              ? await prisma.teamInfo.findUnique({
                  where: { id: row.teamId },
                  select: { apiTeamId: true },
                })
              : null;

            if (currentTeam?.apiTeamId === inTeam.id) {
              // No change.
              return;
            }

            const expiresAt = new Date(Date.now() + MONTHLY_TTL_MS);
            const teamInfo = await prisma.teamInfo.upsert({
              where: { apiTeamId: inTeam.id },
              create: {
                apiTeamId: inTeam.id,
                teamName: inTeam.name ?? `Team ${inTeam.id}`,
                season: currentSeason(),
                lastFetched: new Date(),
                expiresAt,
              },
              update: { teamName: inTeam.name ?? undefined },
            });

            await prisma.playerInfo.updateMany({
              where: { apiPlayerId: row.apiPlayerId },
              data: { teamId: teamInfo.id, lastRefreshType: '100day' },
            });

            refreshed += 1;
            logger.info(
              `[Worker][100day] ✅ ${label} → ${inTeam.name ?? inTeam.id} in ${Date.now() - startedAt}ms`,
            );
          } catch (err) {
            logger.warn(`[Worker][100day] ⚠️ skip: ${label} — ${shortErr(err)}`);
          }
        }),
      ),
    );

    await prisma.refreshControl.upsert({
      where: { key: TRANSFERS_CONTROL_KEY },
      create: { key: TRANSFERS_CONTROL_KEY, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });

    logger.info(`[Worker][100day] done — ${refreshed}/${rows.length} re-linked`);
  } catch (err) {
    logger.error('[Worker][100day] fatal (recovered):', err);
  } finally {
    isRunning.transfers = false;
  }
}

/**
 * Register the three refresh schedules. Safe to call once at startup after the
 * DB connection is confirmed; no-op effects until each cron fires.
 */
export function startDataRefreshWorker(): void {
  if (!footballService.isConfigured()) {
    logger.warn('[Worker] Football API not configured — data refresh worker disabled');
    return;
  }

  // A — Weekly: every Monday at 04:00 UTC.
  cron.schedule('0 4 * * 1', () => {
    void runWeeklyRefresh();
  });

  // B — Monthly: 1st of the month at 03:00 UTC.
  cron.schedule('0 3 1 * *', () => {
    void runMonthlyRefresh();
  });

  // C — Transfers: checked daily at 02:00 UTC, executes only every 100 days.
  cron.schedule('0 2 * * *', () => {
    void runTransfersRefresh();
  });

  logger.info(
    '[Worker] data refresh schedules registered — weekly (Mon 04:00), monthly (1st 03:00), transfers (daily 02:00 / every 100d)',
  );
}
