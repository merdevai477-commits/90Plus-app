/**
 * Redis-backed live fixture snapshots written by LiveFixtureSync and read by HTTP handlers.
 * Keeps mobile clients on sync-job data instead of stacking HTTP + in-process caches.
 */

import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import {
  FOOTBALL_365_LIVE_FIXTURE_KEY_PREFIX,
  FOOTBALL_365_LIVE_MATCHES_KEY,
  FOOTBALL_API_LIVE_FIXTURE_KEY_PREFIX,
  FOOTBALL_API_LIVE_MATCHES_KEY,
  FOOTBALL_LIVE_MATCHES_KEY,
  FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX,
  FOOTBALL_FIXTURE_TERMINAL_CORRECTION_KEY_PREFIX,
} from '../utils/football-cache-keys.util';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES, FINISHED_STATUSES, TERMINAL_LATCH_STATUSES } from './match-cache.service';
import prisma from '../lib/prisma';
import { asTerminalFinishedFixture } from '../utils/fixture-terminal.util';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';
import { SCORES365_LEAGUE_ID_OFFSET as SYNTHETIC_365_LEAGUE_OFFSET } from '../utils/scores365-league-id.util';

export const FOOTBALL_LIVE_FIXTURE_KEY_PREFIX = 'football:live_fixture:';
export const FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX = 'football:fixture_terminal:';

const LIVE_LIST_TTL_SEC = Math.max(
  70,
  Math.ceil((parseInt(process.env.FOOTBALL_LIVE_SYNC_MS || '5000', 10) || 5_000) / 1000) + 20,
);
const LIVE_FIXTURE_TTL_SEC = LIVE_LIST_TTL_SEC;

/** Snapshot tombstone TTL — short so a corrected-back-to-live fixture can reappear. */
const TERMINAL_FIXTURE_TTL_SEC = 600;
/** Latch TTL — suppress repeat LIVE→FT invalidation for a full day (P1-3). */
const TERMINAL_LATCH_TTL_SEC = 24 * 60 * 60;
/** Max one post-match correction re-invalidate per fixture per 6h. */
const TERMINAL_CORRECTION_TTL_SEC = 6 * 60 * 60;

const LIVE_STATUSES_SET = new Set(LIVE_STATUSES);
const FINISHED_STATUSES_SET = new Set(FINISHED_STATUSES);
const TERMINAL_LATCH_STATUSES_SET = new Set(TERMINAL_LATCH_STATUSES);

/** Redis TTL for the allscores-replaced 365 live list — must outlive the ~20s tick. */
export function scores365LiveListTtlSec(): number {
  const tickMs = parseInt(process.env.SCORES365_ALLSCORES_LIVE_MS || '20000', 10) || 20_000;
  const tickSec = Math.max(1, Math.ceil(tickMs / 1000));
  return Math.max(90, tickSec * 4);
}

function combinedLiveListTtlSec(): number {
  return Math.max(LIVE_LIST_TTL_SEC, scores365LiveListTtlSec());
}

function isScores365OwnedLiveRow(fixture: FixtureFromAPI): boolean {
  const leagueId = fixture?.league?.id;
  if (typeof leagueId === 'number' && leagueId >= SYNTHETIC_365_LEAGUE_OFFSET) return true;
  const id = fixture?.fixture?.id;
  return typeof id === 'number' && isNative365FixtureId(id);
}

const NS_LIKE_STATUSES = new Set(['NS', 'TBD', 'PST']);
/** Force upstream refresh when still NS-like from T−20m through kickoff+3h. */
const NS_KICKOFF_REFRESH_BEFORE_MS = 20 * 60 * 1000;
const NS_KICKOFF_REFRESH_AFTER_MS = 3 * 60 * 60 * 1000;

function fixtureKickoffMs(row: {
  matchDate?: Date | null;
  matchTimestamp?: number | null;
}): number | null {
  if (row.matchTimestamp != null && row.matchTimestamp > 0) {
    return row.matchTimestamp * 1000;
  }
  if (row.matchDate) return row.matchDate.getTime();
  return null;
}

/** NS (or TBD/PST) that is past kickoff or within ~20 min of kickoff — DB short-circuit is unsafe. */
export function isNsNearKickoff(
  status: string | null | undefined,
  matchDate?: Date | null,
  matchTimestamp?: number | null,
  nowMs = Date.now(),
): boolean {
  if (!status || !NS_LIKE_STATUSES.has(status)) return false;
  const kickoffMs = fixtureKickoffMs({ matchDate, matchTimestamp });
  if (kickoffMs == null) return false;
  return (
    nowMs >= kickoffMs - NS_KICKOFF_REFRESH_BEFORE_MS &&
    nowMs <= kickoffMs + NS_KICKOFF_REFRESH_AFTER_MS
  );
}

import {
  getScores365ExperimentConfig,
  getScores365ExperimentFixture,
  isScores365ExperimentEnabled,
  isScores365ExperimentFixture,
  resolveScores365AppLanguage,
} from './scores365-experiment.service';

export type LiveFixtureReadSource = 'redis-live' | 'redis-terminal' | 'db' | 'scores365-experiment' | null;

function liveFixtureKey(fixtureId: number): string {
  return `${FOOTBALL_LIVE_FIXTURE_KEY_PREFIX}${fixtureId}`;
}

function providerLiveFixtureKey(
  provider: 'api-football' | '365',
  fixtureId: number,
): string {
  const prefix =
    provider === 'api-football'
      ? FOOTBALL_API_LIVE_FIXTURE_KEY_PREFIX
      : FOOTBALL_365_LIVE_FIXTURE_KEY_PREFIX;
  return `${prefix}${fixtureId}`;
}

function mergeFixtureLists(...lists: FixtureFromAPI[][]): FixtureFromAPI[] {
  const byId = new Map<number, FixtureFromAPI>();
  for (const list of lists) {
    for (const fixture of list) {
      const id = fixture?.fixture?.id;
      if (id != null && LIVE_STATUSES_SET.has(fixture.fixture?.status?.short ?? '')) {
        byId.set(id, fixture);
      }
    }
  }
  return Array.from(byId.values());
}

function parseFixtureList(raw: string | null): FixtureFromAPI[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as FixtureFromAPI[];
  return Array.isArray(parsed) ? parsed : [];
}

function terminalFixtureKey(fixtureId: number): string {
  return `${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${fixtureId}`;
}

function terminalLatchedKey(fixtureId: number): string {
  return `${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${fixtureId}`;
}

function terminalCorrectionKey(fixtureId: number): string {
  return `${FOOTBALL_FIXTURE_TERMINAL_CORRECTION_KEY_PREFIX}${fixtureId}`;
}

/** True if fixture has been latched as terminal (24h suppress window). */
export async function isTerminalLatched(fixtureId: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !Number.isFinite(fixtureId)) return false;
  try {
    const v = await redis.get(terminalLatchedKey(fixtureId));
    return v != null;
  } catch {
    return false;
  }
}

/**
 * Acquire the one-shot terminal latch (SET NX).
 * Returns true if this caller is the first to latch (should invalidate once).
 * If already latched, optionally allows a correction re-invalidate once per 6h.
 */
export async function tryAcquireTerminalInvalidate(
  fixtureId: number,
): Promise<'first' | 'skip' | 'correction'> {
  const redis = getRedisClient();
  if (!redis) return 'first'; // no Redis → keep prior behavior (invalidate)
  try {
    const acquired = await redis.set(
      terminalLatchedKey(fixtureId),
      '1',
      'EX',
      TERMINAL_LATCH_TTL_SEC,
      'NX',
    );
    if (acquired === 'OK') return 'first';

    const correction = await redis.set(
      terminalCorrectionKey(fixtureId),
      '1',
      'EX',
      TERMINAL_CORRECTION_TTL_SEC,
      'NX',
    );
    if (correction === 'OK') return 'correction';
    return 'skip';
  } catch (err) {
    logger.warn(`[LiveFixtureCache] tryAcquireTerminalInvalidate failed for ${fixtureId}:`, err);
    return 'first';
  }
}

export function isTerminalLatchStatus(status: string | null | undefined): boolean {
  return !!status && TERMINAL_LATCH_STATUSES_SET.has(status);
}

async function suppressTerminalTombstones(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  fixtures: FixtureFromAPI[],
  keepLiveIds?: Set<number>,
): Promise<FixtureFromAPI[]> {
  const ids = [...new Set(fixtures.map((f) => f?.fixture?.id).filter((id): id is number => id != null))];
  if (!ids.length) return fixtures;
  const tombstones = await Promise.all(ids.map((id) => redis.get(terminalFixtureKey(id))));
  const terminalIds = new Set(ids.filter((_id, index) => tombstones[index] != null));
  return fixtures.filter((fixture) => {
    const id = fixture.fixture.id;
    if (keepLiveIds?.has(id)) return true;
    return !terminalIds.has(id);
  });
}

export async function writeLiveFixturesSnapshot(fixtures: FixtureFromAPI[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const [previousApiRaw, scores365Raw] = await Promise.all([
      redis.get(FOOTBALL_API_LIVE_MATCHES_KEY),
      redis.get(FOOTBALL_365_LIVE_MATCHES_KEY),
    ]);
    const previousApi = parseFixtureList(previousApiRaw);
    const currentIds = new Set(
      fixtures.map((fixture) => fixture?.fixture?.id).filter((id): id is number => id != null),
    );
    const pipeline = redis.pipeline();
    pipeline.setex(FOOTBALL_API_LIVE_MATCHES_KEY, LIVE_LIST_TTL_SEC, JSON.stringify(fixtures));
    pipeline.setex(
      FOOTBALL_LIVE_MATCHES_KEY,
      LIVE_LIST_TTL_SEC,
      JSON.stringify(mergeFixtureLists(fixtures, parseFixtureList(scores365Raw))),
    );

    for (const previous of previousApi) {
      const id = previous?.fixture?.id;
      if (id != null && !currentIds.has(id)) {
        pipeline.del(providerLiveFixtureKey('api-football', id));
      }
    }

    for (const fixture of fixtures) {
      const id = fixture?.fixture?.id;
      if (id == null) continue;
      const status = fixture.fixture?.status?.short ?? '';
      if (LIVE_STATUSES_SET.has(status)) {
        void import('../utils/match-status-diag.util').then(({ diagBeforeCacheWrite }) => {
          diagBeforeCacheWrite(id, status, 'redis-live-fixture', 'api-football');
        });
        pipeline.setex(
          providerLiveFixtureKey('api-football', id),
          LIVE_FIXTURE_TTL_SEC,
          JSON.stringify(fixture),
        );
      }
    }

    await pipeline.exec();
  } catch (err) {
    logger.warn('[LiveFixtureCache] writeLiveFixturesSnapshot failed:', err);
  }
}

/**
 * Overlay 365Scores (or other) live rows onto the existing Redis live list without
 * wiping API-Football entries. Removes ids that transitioned to a terminal status.
 */
export async function mergeLiveFixturesIntoRedisSnapshot(incoming: FixtureFromAPI[]): Promise<void> {
  if (!incoming.length) return;
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const [existingRaw, apiRaw] = await Promise.all([
      redis.get(FOOTBALL_365_LIVE_MATCHES_KEY),
      redis.get(FOOTBALL_API_LIVE_MATCHES_KEY),
    ]);
    const existing = parseFixtureList(existingRaw);

    const byId = new Map<number, FixtureFromAPI>();
    for (const fixture of existing) {
      const id = fixture?.fixture?.id;
      if (id != null) byId.set(id, fixture);
    }

    for (const fixture of incoming) {
      const id = fixture?.fixture?.id;
      if (id == null) continue;
      const status = fixture.fixture?.status?.short ?? '';
      if (LIVE_STATUSES_SET.has(status)) {
        byId.set(id, fixture);
      } else {
        byId.delete(id);
        if (FINISHED_STATUSES_SET.has(status)) {
          await writeTerminalFixtureSnapshot(fixture, '365');
        }
      }
    }

    const merged = Array.from(byId.values()).filter((f) =>
      LIVE_STATUSES_SET.has(f?.fixture?.status?.short ?? ''),
    );
    const pipeline = redis.pipeline();
    pipeline.setex(FOOTBALL_365_LIVE_MATCHES_KEY, LIVE_LIST_TTL_SEC, JSON.stringify(merged));
    pipeline.setex(
      FOOTBALL_LIVE_MATCHES_KEY,
      LIVE_LIST_TTL_SEC,
      JSON.stringify(mergeFixtureLists(parseFixtureList(apiRaw), merged)),
    );
    for (const fixture of incoming) {
      const id = fixture?.fixture?.id;
      if (id == null) continue;
      const status = fixture.fixture?.status?.short ?? '';
      if (LIVE_STATUSES_SET.has(status)) {
        void import('../utils/match-status-diag.util').then(({ diagBeforeCacheWrite }) => {
          diagBeforeCacheWrite(id, status, 'redis-365-merge', '365');
        });
        pipeline.setex(
          providerLiveFixtureKey('365', id),
          LIVE_FIXTURE_TTL_SEC,
          JSON.stringify(fixture),
        );
      } else {
        void import('../utils/match-status-diag.util').then(({ diagBeforeCacheWrite }) => {
          diagBeforeCacheWrite(id, status, 'redis-terminal', '365');
        });
        pipeline.del(providerLiveFixtureKey('365', id));
      }
    }
    await pipeline.exec();
  } catch (err) {
    logger.warn('[LiveFixtureCache] mergeLiveFixturesIntoRedisSnapshot failed:', err);
  }
}

/**
 * Replace the 365 live list with the current allscores live set (not a merge).
 * IDs that left the set are tombstoned and dropped; API-Football rows stay intact.
 */
export async function replace365LiveFixturesSnapshot(liveFixtures: FixtureFromAPI[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const incomingLive = liveFixtures
    .filter((fixture) => fixture?.fixture?.id != null)
    .map((fixture) => {
      const short = fixture.fixture?.status?.short ?? '';
      if (LIVE_STATUSES_SET.has(short)) return fixture;
      // allscores already classified this as live (statusGroup 3); do not drop it as FT.
      return {
        ...fixture,
        fixture: {
          ...fixture.fixture,
          status: {
            ...fixture.fixture.status,
            short: 'LIVE',
            long: fixture.fixture.status?.long || 'In Progress',
          },
        },
      };
    });
  const incomingIds = new Set(
    incomingLive.map((fixture) => fixture?.fixture?.id).filter((id): id is number => id != null),
  );
  const ttl = scores365LiveListTtlSec();
  const combinedTtl = combinedLiveListTtlSec();

  try {
    const [existingRaw, apiRaw] = await Promise.all([
      redis.get(FOOTBALL_365_LIVE_MATCHES_KEY),
      redis.get(FOOTBALL_API_LIVE_MATCHES_KEY),
    ]);
    const existing = parseFixtureList(existingRaw);
    const droppedForDb: FixtureFromAPI[] = [];

    for (const previous of existing) {
      const id = previous?.fixture?.id;
      if (id == null || incomingIds.has(id)) continue;
      if (isScores365OwnedLiveRow(previous)) {
        const terminal = asTerminalFinishedFixture(previous);
        await writeTerminalFixtureSnapshot(terminal, '365');
        droppedForDb.push(terminal);
      }
    }

    const pipeline = redis.pipeline();
    pipeline.setex(FOOTBALL_365_LIVE_MATCHES_KEY, ttl, JSON.stringify(incomingLive));
    pipeline.setex(
      FOOTBALL_LIVE_MATCHES_KEY,
      combinedTtl,
      JSON.stringify(mergeFixtureLists(parseFixtureList(apiRaw), incomingLive)),
    );

    for (const previous of existing) {
      const id = previous?.fixture?.id;
      if (id == null || incomingIds.has(id)) continue;
      pipeline.del(providerLiveFixtureKey('365', id));
    }

    for (const fixture of incomingLive) {
      const id = fixture?.fixture?.id;
      if (id == null) continue;
      pipeline.del(terminalFixtureKey(id));
      void import('../utils/match-status-diag.util').then(({ diagBeforeCacheWrite }) => {
        diagBeforeCacheWrite(id, fixture.fixture?.status?.short ?? '', 'redis-365-merge', '365');
      });
      pipeline.setex(providerLiveFixtureKey('365', id), ttl, JSON.stringify(fixture));
    }

    await pipeline.exec();

    if (droppedForDb.length > 0) {
      try {
        await matchCacheService.upsertFixtures(droppedForDb);
      } catch (err) {
        logger.warn('[LiveFixtureCache] replace365 dropped-row upsert failed:', err);
      }
    }
  } catch (err) {
    logger.warn('[LiveFixtureCache] replace365LiveFixturesSnapshot failed:', err);
  }
}

export async function read365LiveFixtureIds(): Promise<number[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    const raw = await redis.get(FOOTBALL_365_LIVE_MATCHES_KEY);
    return parseFixtureList(raw)
      .filter((fixture) => LIVE_STATUSES_SET.has(fixture?.fixture?.status?.short ?? ''))
      .map((fixture) => fixture?.fixture?.id)
      .filter((id): id is number => id != null);
  } catch (err) {
    logger.warn('[LiveFixtureCache] read365LiveFixtureIds failed:', err);
    return [];
  }
}

export async function writeTerminalFixtureSnapshot(
  fixture: FixtureFromAPI,
  provider: 'api-football' | '365' = 'api-football',
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const id = fixture?.fixture?.id;
  if (id == null) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.setex(terminalFixtureKey(id), TERMINAL_FIXTURE_TTL_SEC, JSON.stringify(fixture));
    pipeline.del(providerLiveFixtureKey(provider, id));
    // Remove the legacy per-fixture key during migration without touching the other provider.
    pipeline.del(liveFixtureKey(id));
    await pipeline.exec();

    // P1-3: invalidate detail caches at most once (or once per 6h for corrections).
    const invalidateMode = await tryAcquireTerminalInvalidate(id);
    if (invalidateMode === 'skip') {
      logger.debug(`[LiveFixtureCache] skip repeat LIVE→FT invalidate fixture=${id}`);
      return;
    }
    const reason = invalidateMode === 'correction' ? 'LIVE→FT-correction' : 'LIVE→FT';
    void import('./football-data-cache.service')
      .then(({ footballDataCacheService }) =>
        footballDataCacheService.invalidateFixtureDetailCaches(id, reason),
      )
      .catch((err) =>
        logger.warn(`[LiveFixtureCache] detail invalidate failed for ${id}:`, err),
      );
  } catch (err) {
    logger.warn(`[LiveFixtureCache] writeTerminalFixtureSnapshot failed for ${id}:`, err);
  }
}

export async function readLiveFixturesList(): Promise<FixtureFromAPI[] | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const [legacyRaw, apiRaw, scores365Raw] = await Promise.all([
      redis.get(FOOTBALL_LIVE_MATCHES_KEY),
      redis.get(FOOTBALL_API_LIVE_MATCHES_KEY),
      redis.get(FOOTBALL_365_LIVE_MATCHES_KEY),
    ]);
    if (!legacyRaw && !apiRaw && !scores365Raw) return null;
    // Provider keys override the legacy compatibility snapshot on duplicate ids.
    const merged = mergeFixtureLists(
      parseFixtureList(legacyRaw),
      parseFixtureList(apiRaw),
      parseFixtureList(scores365Raw),
    );
    const keepLiveIds = new Set(
      parseFixtureList(scores365Raw)
        .filter((fixture) => LIVE_STATUSES_SET.has(fixture?.fixture?.status?.short ?? ''))
        .map((fixture) => fixture.fixture.id),
    );
    // Tombstones win over stale provider rows, but not over the current 365 live set.
    return suppressTerminalTombstones(redis, merged, keepLiveIds);
  } catch (err) {
    logger.warn('[LiveFixtureCache] readLiveFixturesList failed:', err);
    return null;
  }
}

export async function readLiveFixtureById(fixtureId: number): Promise<FixtureFromAPI | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const [terminalRaw, scores365Raw, apiRaw, legacyRaw] = await Promise.all([
      redis.get(terminalFixtureKey(fixtureId)),
      redis.get(providerLiveFixtureKey('365', fixtureId)),
      redis.get(providerLiveFixtureKey('api-football', fixtureId)),
      redis.get(liveFixtureKey(fixtureId)),
    ]);
    if (scores365Raw) {
      return JSON.parse(scores365Raw) as FixtureFromAPI;
    }
    if (terminalRaw) {
      const list = await readLiveFixturesList();
      return list?.find((f) => f?.fixture?.id === fixtureId) ?? null;
    }
    const directRaw = apiRaw ?? legacyRaw;
    if (directRaw) {
      return JSON.parse(directRaw) as FixtureFromAPI;
    }

    const list = await readLiveFixturesList();
    if (!list) return null;
    return list.find((f) => f?.fixture?.id === fixtureId) ?? null;
  } catch (err) {
    logger.warn(`[LiveFixtureCache] readLiveFixtureById failed for ${fixtureId}:`, err);
    return null;
  }
}

export async function readTerminalFixtureById(fixtureId: number): Promise<FixtureFromAPI | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(terminalFixtureKey(fixtureId));
    if (!raw) return null;
    return JSON.parse(raw) as FixtureFromAPI;
  } catch (err) {
    logger.warn(`[LiveFixtureCache] readTerminalFixtureById failed for ${fixtureId}:`, err);
    return null;
  }
}

/** Batch-read FT snapshots so calendar rows stuck on NS can pick up terminal scores. */
export async function readTerminalFixturesForIds(
  fixtureIds: number[],
): Promise<FixtureFromAPI[]> {
  const unique = [...new Set(fixtureIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return [];

  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const keys = unique.map((id) => terminalFixtureKey(id));
    const rawRows = await redis.mget(...keys);
    const out: FixtureFromAPI[] = [];
    for (const raw of rawRows) {
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as FixtureFromAPI);
      } catch {
        // skip malformed
      }
    }
    return out;
  } catch (err) {
    logger.warn('[LiveFixtureCache] readTerminalFixturesForIds failed:', err);
    return [];
  }
}

/**
 * Resolve a fixture for HTTP responses without calling API-Football when sync data exists.
 * Near-kickoff NS rows are NOT treated as fresh from DB (avoids up-to-3h stuck NS).
 */
export async function resolveFixtureForClient(
  fixtureId: number,
  language?: string | null,
): Promise<{ fixture: FixtureFromAPI | null; source: LiveFixtureReadSource }> {
  const terminal = await readTerminalFixtureById(fixtureId);
  if (terminal) {
    return { fixture: terminal, source: 'redis-terminal' };
  }

  if (isScores365ExperimentFixture(fixtureId) || isNative365FixtureId(fixtureId)) {
    const experimentFixture = await getScores365ExperimentFixture(
      fixtureId,
      resolveScores365AppLanguage(language),
    );
    if (experimentFixture) {
      return { fixture: experimentFixture, source: 'scores365-experiment' };
    }
  }

  const live = await readLiveFixtureById(fixtureId);
  if (live) {
    return { fixture: live, source: 'redis-live' };
  }

    const dbRow = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
  if (dbRow) {
    const status = dbRow.status;
    const isLive = LIVE_STATUSES_SET.has(status);
    const isFinished = FINISHED_STATUSES_SET.has(status);
    const nearKickoffNs = isNsNearKickoff(status, dbRow.matchDate, dbRow.matchTimestamp);
    const native365 = isNative365FixtureId(fixtureId);
    const updatedRecently =
      dbRow.updatedAt != null &&
      Date.now() - dbRow.updatedAt.getTime() < 3 * 60 * 60 * 1000;

    // NS near/past kickoff: force upstream so clients are not stuck on stale NS for hours.
    if (nearKickoffNs) {
      const refreshed = await forceRefreshFixtureNearKickoff(fixtureId, language);
      if (refreshed) {
        return refreshed;
      }
    } else if (isLive || isFinished || updatedRecently || native365) {
      return {
        fixture: matchCacheService.convertDbMatchToApiFormat(dbRow),
        source: 'db',
      };
    }

    // Upstream miss on near-kickoff NS — still serve DB rather than empty HTTP.
    if (nearKickoffNs || isLive || isFinished || updatedRecently || native365) {
      return {
        fixture: matchCacheService.convertDbMatchToApiFormat(dbRow),
        source: 'db',
      };
    }
  }

  return { fixture: null, source: null };
}

export async function forceRefreshFixtureNearKickoff(
  fixtureId: number,
  language?: string | null,
): Promise<{ fixture: FixtureFromAPI; source: LiveFixtureReadSource } | null> {
  try {
    if (
      (isScores365ExperimentEnabled() && isScores365ExperimentFixture(fixtureId)) ||
      isNative365FixtureId(fixtureId)
    ) {
      const experimentFixture = await getScores365ExperimentFixture(
        fixtureId,
        resolveScores365AppLanguage(language),
      );
      if (experimentFixture) {
        await matchCacheService.upsertFixtures([experimentFixture], { preserveFullData: true });
        logger.info(
          `[LiveFixtureCache] near-kickoff NS refresh fixture=${fixtureId} source=365 status=${experimentFixture.fixture?.status?.short}`,
        );
        return { fixture: experimentFixture, source: 'scores365-experiment' };
      }
    }

    // Native 365 game ids are not API-Football fixtures. A miss here lets the
    // caller serve CachedFixture instead of querying a different provider.
    if (isNative365FixtureId(fixtureId)) {
      return null;
    }

    const { footballService, isFootballQuotaExhausted } = await import('./football.service');
    if (!footballService.isConfigured() || isFootballQuotaExhausted()) {
      logger.warn(
        `[LiveFixtureCache] near-kickoff NS refresh skipped fixture=${fixtureId} reason=quota_or_unconfigured`,
      );
      return null;
    }

    const fresh = await footballService.getFixtureById(fixtureId, { source: 'job' });
    if (!fresh?.fixture?.id) {
      logger.warn(
        `[LiveFixtureCache] near-kickoff NS refresh empty fixture=${fixtureId} reason=upstream_empty`,
      );
      return null;
    }

    await matchCacheService.upsertFixtures([fresh as FixtureFromAPI]);
    const short = fresh.fixture?.status?.short ?? '';
    if (LIVE_STATUSES_SET.has(short)) {
      try {
        const redis = getRedisClient();
        if (redis) {
          await redis.setex(
            providerLiveFixtureKey('api-football', fixtureId),
            LIVE_FIXTURE_TTL_SEC,
            JSON.stringify(fresh),
          );
        }
      } catch {
        // non-fatal
      }
    }
    logger.info(
      `[LiveFixtureCache] near-kickoff NS refresh fixture=${fixtureId} source=api-football status=${short}`,
    );
    return { fixture: fresh as FixtureFromAPI, source: 'db' };
  } catch (err) {
    logger.warn(`[LiveFixtureCache] near-kickoff NS refresh failed fixture=${fixtureId}:`, err);
    return null;
  }
}

/**
 * Live list for clients — prefer sync Redis payload; filter to currently-live statuses.
 */
export async function resolveLiveFixturesForClient(
  language?: string | null,
): Promise<{
  fixtures: FixtureFromAPI[];
  source: 'redis' | 'scores365-experiment' | null;
}> {
  const fromRedis = await readLiveFixturesList();
  let fixtures: FixtureFromAPI[] = [];
  let source: 'redis' | 'scores365-experiment' | null = null;

  if (fromRedis != null) {
    fixtures = fromRedis.filter((f) =>
      LIVE_STATUSES_SET.has(f?.fixture?.status?.short ?? ''),
    );
    source = 'redis';
  }

  const experimentFixture = await getScores365ExperimentFixture(
    getScores365ExperimentConfig().fixtureId,
    resolveScores365AppLanguage(language),
  );
  if (experimentFixture) {
    const short = experimentFixture.fixture?.status?.short ?? '';
    if (LIVE_STATUSES_SET.has(short)) {
      const id = experimentFixture.fixture.id;
      fixtures = fixtures.filter((f) => f.fixture.id !== id);
      fixtures.unshift(experimentFixture);
      source = source ?? 'scores365-experiment';
    }
  }

  if (fixtures.length > 0 && source !== 'redis') {
    const terminalRows = await Promise.all(
      fixtures.map((fixture) => readTerminalFixtureById(fixture.fixture.id)),
    );
    fixtures = fixtures.filter((_fixture, index) => terminalRows[index] == null);
  }

  return { fixtures, source };
}
