/**
 * Redis-backed live fixture snapshots written by LiveFixtureSync and read by HTTP handlers.
 * Keeps mobile clients on sync-job data instead of stacking HTTP + in-process caches.
 */

import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import {
  FOOTBALL_LIVE_MATCHES_KEY,
} from '../utils/football-cache-keys.util';
import { matchCacheService, FixtureFromAPI, LIVE_STATUSES, FINISHED_STATUSES } from './match-cache.service';
import prisma from '../lib/prisma';

export const FOOTBALL_LIVE_FIXTURE_KEY_PREFIX = 'football:live_fixture:';
export const FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX = 'football:fixture_terminal:';

const LIVE_LIST_TTL_SEC = Math.max(
    70,
    Math.ceil((parseInt(process.env.FOOTBALL_LIVE_SYNC_MS || '45000', 10) || 45_000) / 1000) + 20,
);
const LIVE_FIXTURE_TTL_SEC = LIVE_LIST_TTL_SEC;
const TERMINAL_FIXTURE_TTL_SEC = 600;

const LIVE_STATUSES_SET = new Set(LIVE_STATUSES);
const FINISHED_STATUSES_SET = new Set(FINISHED_STATUSES);

import {
  getScores365ExperimentFixture,
  isScores365ExperimentFixture,
} from './scores365-experiment.service';

export type LiveFixtureReadSource = 'redis-live' | 'redis-terminal' | 'db' | 'scores365-experiment' | null;

function liveFixtureKey(fixtureId: number): string {
  return `${FOOTBALL_LIVE_FIXTURE_KEY_PREFIX}${fixtureId}`;
}

function terminalFixtureKey(fixtureId: number): string {
  return `${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${fixtureId}`;
}

export async function writeLiveFixturesSnapshot(fixtures: FixtureFromAPI[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.setex(FOOTBALL_LIVE_MATCHES_KEY, LIVE_LIST_TTL_SEC, JSON.stringify(fixtures));

    for (const fixture of fixtures) {
      const id = fixture?.fixture?.id;
      if (id == null) continue;
      const status = fixture.fixture?.status?.short ?? '';
      if (LIVE_STATUSES_SET.has(status)) {
        pipeline.setex(liveFixtureKey(id), LIVE_FIXTURE_TTL_SEC, JSON.stringify(fixture));
      }
    }

    await pipeline.exec();
  } catch (err) {
    logger.warn('[LiveFixtureCache] writeLiveFixturesSnapshot failed:', err);
  }
}

export async function writeTerminalFixtureSnapshot(fixture: FixtureFromAPI): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const id = fixture?.fixture?.id;
  if (id == null) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.setex(terminalFixtureKey(id), TERMINAL_FIXTURE_TTL_SEC, JSON.stringify(fixture));
    pipeline.del(liveFixtureKey(id));
    await pipeline.exec();
  } catch (err) {
    logger.warn(`[LiveFixtureCache] writeTerminalFixtureSnapshot failed for ${id}:`, err);
  }
}

export async function readLiveFixturesList(): Promise<FixtureFromAPI[] | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(FOOTBALL_LIVE_MATCHES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FixtureFromAPI[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    logger.warn('[LiveFixtureCache] readLiveFixturesList failed:', err);
    return null;
  }
}

export async function readLiveFixtureById(fixtureId: number): Promise<FixtureFromAPI | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(liveFixtureKey(fixtureId));
    if (raw) {
      return JSON.parse(raw) as FixtureFromAPI;
    }

    const listRaw = await redis.get(FOOTBALL_LIVE_MATCHES_KEY);
    if (!listRaw) return null;
    const list = JSON.parse(listRaw) as FixtureFromAPI[];
    if (!Array.isArray(list)) return null;
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

/**
 * Resolve a fixture for HTTP responses without calling API-Football when sync data exists.
 */
export async function resolveFixtureForClient(
  fixtureId: number,
): Promise<{ fixture: FixtureFromAPI | null; source: LiveFixtureReadSource }> {
  if (isScores365ExperimentFixture(fixtureId)) {
    const experimentFixture = await getScores365ExperimentFixture();
    if (experimentFixture) {
      return { fixture: experimentFixture, source: 'scores365-experiment' };
    }
  }

  const live = await readLiveFixtureById(fixtureId);
  if (live) {
    return { fixture: live, source: 'redis-live' };
  }

  const terminal = await readTerminalFixtureById(fixtureId);
  if (terminal) {
    return { fixture: terminal, source: 'redis-terminal' };
  }

  const dbRow = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
  if (dbRow) {
    const status = dbRow.status;
    const isLive = LIVE_STATUSES_SET.has(status);
    const isFinished = FINISHED_STATUSES_SET.has(status);
    const updatedRecently =
      dbRow.updatedAt != null &&
      Date.now() - dbRow.updatedAt.getTime() < 3 * 60 * 60 * 1000;

    if (isLive || isFinished || updatedRecently) {
      return {
        fixture: matchCacheService.convertDbMatchToApiFormat(dbRow),
        source: 'db',
      };
    }
  }

  return { fixture: null, source: null };
}

/**
 * Live list for clients — prefer sync Redis payload; filter to currently-live statuses.
 */
export async function resolveLiveFixturesForClient(): Promise<{
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

  const experimentFixture = await getScores365ExperimentFixture();
  if (experimentFixture) {
    const short = experimentFixture.fixture?.status?.short ?? '';
    if (LIVE_STATUSES_SET.has(short)) {
      const id = experimentFixture.fixture.id;
      fixtures = fixtures.filter((f) => f.fixture.id !== id);
      fixtures.unshift(experimentFixture);
      source = source ?? 'scores365-experiment';
    }
  }

  return { fixtures, source };
}
