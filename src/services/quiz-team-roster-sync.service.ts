/**
 * Sync TeamInfo + TeamPlayer squads from API-Football.
 * Used by dataRefreshWorker (monthly) and the quiz roster seed script.
 *
 * TeamPlayer is the player entity table the Questions/Quiz dataset is authored
 * over. PlayerInfo is NOT a player registry — it is the chat AI's answer cache
 * (question/answer/fingerprint/model, unique on playerName+queryType+language),
 * written only when a user asks about a player. Squad data therefore populates
 * TeamPlayer; PlayerInfo rows are only back-linked to their club so cached
 * answers can enrich the dataset. Manufacturing PlayerInfo rows out of squad
 * lists would mean inventing Q&A cache entries, which is exactly the fabricated
 * data this pipeline must never produce.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { footballService, isFootballQuotaExhausted } from './football.service';

const ROSTER_TTL_MS = 30 * 24 * 60 * 60_000;

/**
 * How long a failed `ensureQuizEntityDataset()` recovery waits before it is
 * allowed to spend quota on another full roster sync. Without this, every
 * process boot (deploy, restart, crash loop) ran a 25-team sync — enough on its
 * own to drain a 100 requests/day plan and leave the pool permanently empty.
 */
const ENSURE_SYNC_COOLDOWN_MS = 6 * 60 * 60_000;
const ENSURE_SYNC_CONTROL_KEY = 'quiz_roster_ensure_last_attempt';

function currentSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

export type RosterSyncResult =
  /** Squad fetched and written. */
  | { status: 'synced'; teamInfoId: number; playersWritten: number }
  /** Roster still inside its 30-day TTL — no API call was made. */
  | { status: 'fresh'; teamInfoId: number }
  /** API answered, club genuinely has no squad rows. */
  | { status: 'empty'; teamInfoId: number }
  /** Quota exhausted / account suspended — we were never allowed to ask. */
  | { status: 'unavailable' }
  /** Unexpected failure; already logged. */
  | { status: 'error' };

interface ApiSquadPlayer {
  id?: number;
  name?: string;
  position?: string;
  number?: number;
}

/**
 * Upsert TeamInfo + squad snapshot; back-link matching PlayerInfo rows.
 *
 * Respects the 30-day roster TTL: a club whose snapshot is still fresh costs no
 * API request. Pass `force` to refresh regardless (seed scripts).
 */
export async function syncTeamRoster(
  apiTeamId: number,
  teamName: string,
  options: { force?: boolean } = {},
): Promise<RosterSyncResult> {
  try {
    const existing = await prisma.teamInfo.findUnique({
      where: { apiTeamId },
      select: { id: true, expiresAt: true, _count: { select: { players: true } } },
    });

    /*
     * TTL gate. The previous implementation wrote `expiresAt = now + 30d` on
     * every call and never read it back, so the TTL existed on paper only and
     * each quiz-generation recovery re-fetched all 25 squads. A snapshot only
     * counts as fresh if it actually holds players — an expiry stamped on an
     * empty roster is what let the pool stay at zero while looking "cached".
     */
    if (
      !options.force &&
      existing &&
      existing._count.players > 0 &&
      existing.expiresAt.getTime() > Date.now()
    ) {
      return { status: 'fresh', teamInfoId: existing.id };
    }

    /*
     * Create the TeamInfo row if missing, but do NOT stamp a fresh expiry yet.
     * A brand-new row starts already-expired so a fetch that fails (quota,
     * outage) cannot buy this club 30 days of silence with zero players stored.
     * The real TTL is written below, only once a squad has actually landed.
     */
    const teamInfo =
      existing ??
      (await prisma.teamInfo.create({
        data: {
          apiTeamId,
          teamName,
          season: currentSeason(),
          lastFetched: new Date(0),
          expiresAt: new Date(0),
        },
        select: { id: true, expiresAt: true, _count: { select: { players: true } } },
      }));

    const squad = await footballService.getTeamSquadResult(apiTeamId);

    // Quota-blocked is not an empty club: report it so the caller stops the run
    // instead of recording 25 clubs as "checked, no players".
    if (squad.status === 'unavailable') {
      return { status: 'unavailable' };
    }

    // Deduplicate on apiPlayerId — API-Football occasionally repeats an entry,
    // and a duplicate would make the dataset's first-wins dedupe pick at random.
    const byPlayerId = new Map<number, ApiSquadPlayer>();
    for (const p of squad.players as ApiSquadPlayer[]) {
      if (!Number.isInteger(p?.id) || !p?.name?.trim()) continue;
      if (!byPlayerId.has(p.id!)) byPlayerId.set(p.id!, p);
    }
    const players = [...byPlayerId.values()];

    if (players.length === 0) {
      // Genuinely empty upstream. Keep the club's roster untouched rather than
      // wiping a previously good snapshot, and leave the TTL expired so the
      // next run retries.
      return { status: 'empty', teamInfoId: teamInfo.id };
    }

    const squadIds = [...byPlayerId.keys()];

    await prisma.$transaction([
      // This club's previous snapshot.
      prisma.teamPlayer.deleteMany({ where: { teamInfoId: teamInfo.id } }),
      /*
       * Transfers: the same player still sitting in another club's snapshot.
       * buildQuizEntityDataset() dedupes players by apiPlayerId and keeps the
       * first row it sees, so a stale duplicate would attribute the player to
       * their old club. Dropping it here keeps one row per player globally.
       */
      prisma.teamPlayer.deleteMany({
        where: { apiPlayerId: { in: squadIds }, teamInfoId: { not: teamInfo.id } },
      }),
      prisma.teamPlayer.createMany({
        data: players.map((p) => ({
          teamInfoId: teamInfo.id,
          apiPlayerId: p.id!,
          playerName: p.name!.trim(),
          position: p.position?.trim() || 'Unknown',
          jerseyNumber: typeof p.number === 'number' ? p.number : null,
        })),
      }),
      // The squad landed, so the 30-day clock starts now.
      prisma.teamInfo.update({
        where: { id: teamInfo.id },
        data: {
          teamName,
          season: currentSeason(),
          lastFetched: new Date(),
          expiresAt: new Date(Date.now() + ROSTER_TTL_MS),
        },
      }),
    ]);

    /*
     * Back-link cached chat answers for these players to this club. This only
     * touches rows that already exist and whose club is wrong or unset — it
     * never creates PlayerInfo rows and never overwrites their cached answer,
     * fingerprint or refresh metadata.
     */
    await prisma.playerInfo.updateMany({
      where: { apiPlayerId: { in: squadIds }, NOT: { teamId: teamInfo.id } },
      data: { teamId: teamInfo.id },
    });

    return { status: 'synced', teamInfoId: teamInfo.id, playersWritten: players.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[QuizRosterSync] roster sync failed for team ${apiTeamId} — ${msg.slice(0, 120)}`);
    return { status: 'error' };
  }
}

export interface QuizRosterSyncSummary {
  /** Teams that actually gained players on this run. */
  synced: number;
  /** Teams skipped because their snapshot is still inside the 30-day TTL. */
  fresh: number;
  /** Teams the API answered for with no squad rows. */
  empty: number;
  total: number;
  /** The run stopped because upstream is unavailable (quota / suspended). */
  quotaBlocked: boolean;
}

/**
 * Seed quiz rosters from top CachedTeam entries (logo present).
 *
 * `quotaBlocked` says the run stopped because API-Football would not answer —
 * the caller needs that to distinguish "there is no squad data upstream" from
 * "we were not allowed to ask", which otherwise look identical.
 */
export async function syncQuizRostersFromCachedTeams(
  teamLimit = 25,
  options: { force?: boolean } = {},
): Promise<QuizRosterSyncSummary> {
  const teams = await prisma.cachedTeam.findMany({
    where: { logo: { not: null } },
    orderBy: { teamId: 'asc' },
    take: teamLimit,
    select: { teamId: true, name: true },
  });

  const summary: QuizRosterSyncSummary = {
    synced: 0,
    fresh: 0,
    empty: 0,
    total: teams.length,
    quotaBlocked: false,
  };

  /*
   * Deliberately NOT bailing out up front when the breaker is already open.
   * A squad cached inside its 7-day window is served without touching the API,
   * so an exhausted quota does not mean there is nothing to harvest. The loop
   * still stops the moment a club comes back genuinely unavailable, which is
   * what actually protects the quota.
   */
  if (isFootballQuotaExhausted()) {
    logger.warn('[QuizRosterSync] API-Football quota exhausted — cached squads only', {
      teams: teams.length,
    });
  }

  logger.info(`[QuizRosterSync] syncing ${teams.length} cached team(s)...`);

  for (const team of teams) {
    const result = await syncTeamRoster(team.teamId, team.name, options);

    if (result.status === 'synced') summary.synced += 1;
    else if (result.status === 'fresh') summary.fresh += 1;
    else if (result.status === 'empty') summary.empty += 1;
    else if (result.status === 'unavailable') {
      // Every remaining call would be short-circuited upstream and cached as an
      // empty squad, so stop rather than burn the loop.
      logger.warn('[QuizRosterSync] upstream unavailable mid-run — stopping', {
        synced: summary.synced,
        fresh: summary.fresh,
        attempted: teams.indexOf(team) + 1,
        total: teams.length,
      });
      return { ...summary, quotaBlocked: true };
    }
  }

  logger.info(
    `[QuizRosterSync] done — ${summary.synced} synced, ${summary.fresh} still fresh, ${summary.empty} empty of ${teams.length}`,
  );
  return summary;
}

/** Has a failed recovery sync run recently enough that we should not retry? */
async function ensureSyncOnCooldown(): Promise<boolean> {
  try {
    const control = await prisma.refreshControl.findUnique({
      where: { key: ENSURE_SYNC_CONTROL_KEY },
    });
    if (!control?.value) return false;
    const last = new Date(control.value).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last < ENSURE_SYNC_COOLDOWN_MS;
  } catch {
    return false;
  }
}

async function markEnsureSyncAttempt(): Promise<void> {
  const value = new Date().toISOString();
  try {
    await prisma.refreshControl.upsert({
      where: { key: ENSURE_SYNC_CONTROL_KEY },
      create: { key: ENSURE_SYNC_CONTROL_KEY, value },
      update: { value },
    });
  } catch {
    // Best effort — the cooldown is an optimisation, not a correctness gate.
  }
}

/**
 * Make sure the Questions entity dataset can actually be built, syncing rosters
 * only when it cannot.
 *
 * WHY THIS EXISTS
 * ---------------
 * The daily cron regenerated Questions rounds but nothing ever refreshed the
 * entity pool those rounds are built from. `TeamPlayer` was empty, so
 * `buildQuizEntityDataset()` failed its minimum-player gate, the AI generator
 * was never reachable, and every mode fell back to recycling old rows.
 *
 * The check is cheap and conditional: on a healthy day the dataset builds, this
 * returns immediately, and NO API-Football call is made. Recovery syncs are
 * additionally rate-limited (see ENSURE_SYNC_COOLDOWN_MS) so a restart loop
 * cannot turn this safety net into the thing that drains the daily quota.
 */
export async function ensureQuizEntityDataset(teamLimit = 25): Promise<boolean> {
  const { buildQuizEntityDataset } = await import('./quiz-entity-dataset.service');

  const before = await buildQuizEntityDataset();
  if (before.ok) return true;

  if (await ensureSyncOnCooldown()) {
    logger.warn('[QuizRosterSync] dataset insufficient but recovery sync is on cooldown', {
      counts: before.counts,
      cooldownHours: ENSURE_SYNC_COOLDOWN_MS / 3_600_000,
    });
    return false;
  }

  logger.warn('[QuizRosterSync] entity dataset insufficient — syncing rosters before generation', {
    counts: before.counts,
  });

  await markEnsureSyncAttempt();
  const sync = await syncQuizRostersFromCachedTeams(teamLimit);

  const after = await buildQuizEntityDataset();
  if (after.ok) {
    logger.info('[QuizRosterSync] entity dataset restored', {
      players: after.dataset.players.length,
      clubs: after.dataset.clubs.length,
      stadiums: after.dataset.stadiums.length,
    });
    return true;
  }

  // Upstream is unavailable (quota, outage). Questions rounds cannot be
  // authored today; the modes surface their explicit error rather than
  // publishing invented football content. The reason is named so the failure
  // is traceable to the quota rather than looking like an AI problem.
  logger.error('[QuizRosterSync] entity dataset still insufficient after sync', {
    counts: after.counts,
    reason: sync.quotaBlocked
      ? 'QUESTIONS_UPSTREAM_QUOTA_EXHAUSTED'
      : 'QUESTIONS_DATASET_INSUFFICIENT',
    teamsGainingPlayers: sync.synced,
    teamsStillFresh: sync.fresh,
    teamsConsidered: sync.total,
  });
  return false;
}
