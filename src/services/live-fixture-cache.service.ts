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
} from '../utils/football-cache-keys.util';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES, FINISHED_STATUSES } from './match-cache.service';
import prisma from '../lib/prisma';

export const FOOTBALL_LIVE_FIXTURE_KEY_PREFIX = 'football:live_fixture:';
export const FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX = 'football:fixture_terminal:';

const LIVE_LIST_TTL_SEC = Math.max(
    70,
    Math.ceil((parseInt(process.env.FOOTBALL_LIVE_SYNC_MS || '5000', 10) || 5_000) / 1000) + 20,
);
const LIVE_FIXTURE_TTL_SEC = LIVE_LIST_TTL_SEC;
const TERMINAL_FIXTURE_TTL_SEC = 600;

const LIVE_STATUSES_SET = new Set(LIVE_STATUSES);
const FINISHED_STATUSES_SET = new Set(FINISHED_STATUSES);
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
  SCORES365_LEAGUE_ID_OFFSET,
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

async function suppressTerminalTombstones(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  fixtures: FixtureFromAPI[],
): Promise<FixtureFromAPI[]> {
  const ids = [...new Set(fixtures.map((f) => f?.fixture?.id).filter((id): id is number => id != null))];
  if (!ids.length) return fixtures;
  const tombstones = await Promise.all(ids.map((id) => redis.get(terminalFixtureKey(id))));
  const terminalIds = new Set(ids.filter((_id, index) => tombstones[index] != null));
  return fixtures.filter((fixture) => !terminalIds.has(fixture.fixture.id));
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
        pipeline.setex(
          providerLiveFixtureKey('365', id),
          LIVE_FIXTURE_TTL_SEC,
          JSON.stringify(fixture),
        );
      } else {
        pipeline.del(providerLiveFixtureKey('365', id));
      }
    }
    await pipeline.exec();
  } catch (err) {
    logger.warn('[LiveFixtureCache] mergeLiveFixturesIntoRedisSnapshot failed:', err);
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
    // Drop stale detail bundles so FT clients do not keep serving LIVE-TTL lineups/events/stats.
    void import('./football-data-cache.service')
      .then(({ footballDataCacheService }) =>
        footballDataCacheService.invalidateFixtureDetailCaches(id, 'LIVE→FT'),
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
    // A terminal observation from either provider wins over stale live rows
    // left in the other provider's snapshot until its TTL expires.
    return suppressTerminalTombstones(redis, merged);
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
    if (terminalRaw) return null;
    const directRaw = scores365Raw ?? apiRaw ?? legacyRaw;
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

  if (isScores365ExperimentFixture(fixtureId)) {
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
    const updatedRecently =
      dbRow.updatedAt != null &&
      Date.now() - dbRow.updatedAt.getTime() < 3 * 60 * 60 * 1000;

    // NS near/past kickoff: force upstream so clients are not stuck on stale NS for hours.
    if (nearKickoffNs) {
      const refreshed = await forceRefreshFixtureNearKickoff(fixtureId, language);
      if (refreshed) {
        return refreshed;
      }
    } else if (isLive || isFinished || updatedRecently) {
      return {
        fixture: matchCacheService.convertDbMatchToApiFormat(dbRow),
        source: 'db',
      };
    }

    // Upstream miss on near-kickoff NS — still serve DB rather than empty HTTP.
    if (nearKickoffNs || isLive || isFinished || updatedRecently) {
      return {
        fixture: matchCacheService.convertDbMatchToApiFormat(dbRow),
        source: 'db',
      };
    }
  }

  return { fixture: null, source: null };
}

async function forceRefreshFixtureNearKickoff(
  fixtureId: number,
  language?: string | null,
): Promise<{ fixture: FixtureFromAPI; source: LiveFixtureReadSource } | null> {
  try {
    if (isScores365ExperimentEnabled() && isScores365ExperimentFixture(fixtureId)) {
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

  if (isScores365ExperimentEnabled()) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 1);
    const syntheticRows = await prisma.cachedFixture.findMany({
      where: {
        leagueId: { gte: SCORES365_LEAGUE_ID_OFFSET },
        status: { in: LIVE_STATUSES },
        matchDate: { gte: since },
      },
      take: 80,
      orderBy: { matchDate: 'asc' },
    });
    if (syntheticRows.length > 0) {
      const byId = new Map<number, FixtureFromAPI>();
      for (const f of fixtures) {
        const id = f?.fixture?.id;
        if (id != null) byId.set(id, f);
      }
      for (const row of syntheticRows) {
        const converted = matchCacheService.convertDbMatchToApiFormat(row);
        const short = converted.fixture?.status?.short ?? '';
        if (!LIVE_STATUSES_SET.has(short)) continue;
        if (!byId.has(row.fixtureId)) {
          byId.set(row.fixtureId, converted);
        }
      }
      fixtures = Array.from(byId.values());
      source = source ?? 'scores365-experiment';
    }
  }

  if (fixtures.length > 0) {
    const terminalRows = await Promise.all(
      fixtures.map((fixture) => readTerminalFixtureById(fixture.fixture.id)),
    );
    fixtures = fixtures.filter((_fixture, index) => terminalRows[index] == null);
  }

  return { fixtures, source };
}
