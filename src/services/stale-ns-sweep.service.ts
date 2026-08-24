/**
 * Safety sweep for fixtures stuck in NS/TBD/PST after the near-kickoff
 * refresh window (kickoff+3h) has closed. Reuses forceRefreshFixtureNearKickoff.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { withSyncLeaderLease } from './football-sync-leader.service';
import { forceRefreshFixtureNearKickoff } from './live-fixture-cache.service';
import { isScores365ExperimentEnabled } from './scores365-experiment.service';

const WORKER = 'StaleNsSweep';
/** Only truly "not started" stuck rows — exclude PST/CANC/etc. (valid terminal-ish states). */
const NS_LIKE = new Set(['NS', 'TBD']);
const BATCH_SIZE = Math.max(
  5,
  Math.min(parseInt(process.env.STALE_NS_SWEEP_BATCH || '30', 10) || 30, 50),
);
const CONCURRENCY = Math.max(
  1,
  Math.min(parseInt(process.env.SCORES365_SYNTHETIC_LIVE_CONCURRENCY || '4', 10) || 4, 12),
);

let running = false;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

export async function sweepStaleNsFixtures(): Promise<{
  found: number;
  corrected: number;
  stillNs: number;
}> {
  if (!isScores365ExperimentEnabled()) {
    return { found: 0, corrected: 0, stillNs: 0 };
  }

  const now = Date.now();
  const olderThan = new Date(now - 3 * 60 * 60 * 1000);
  const newerThan = new Date(now - 24 * 60 * 60 * 1000);

  const rows = await prisma.cachedFixture.findMany({
    where: {
      status: { in: ['NS', 'TBD'] },
      matchDate: { lt: olderThan, gt: newerThan },
    },
    select: { fixtureId: true, status: true, matchDate: true },
    orderBy: { matchDate: 'asc' },
    take: BATCH_SIZE,
  });

  const found = rows.length;
  if (!found) {
    logger.debug(`[${WORKER}] found=0 corrected=0 stillNs=0`);
    return { found: 0, corrected: 0, stillNs: 0 };
  }

  const outcomes = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    try {
      const refreshed = await forceRefreshFixtureNearKickoff(row.fixtureId, 'en');
      const short = refreshed?.fixture?.fixture?.status?.short ?? null;
      if (short && !NS_LIKE.has(short)) {
        return 'corrected' as const;
      }
      // Upsert may have written even if returned status still NS-like — re-read DB.
      const db = await prisma.cachedFixture.findUnique({
        where: { fixtureId: row.fixtureId },
        select: { status: true },
      });
      if (db?.status && !NS_LIKE.has(db.status)) {
        return 'corrected' as const;
      }
      return 'stillNs' as const;
    } catch (err: unknown) {
      logger.warn(
        `[${WORKER}] refresh failed fixture=${row.fixtureId}:`,
        (err as Error)?.message,
      );
      return 'stillNs' as const;
    }
  });

  const corrected = outcomes.filter((o) => o === 'corrected').length;
  const stillNs = outcomes.filter((o) => o === 'stillNs').length;
  logger.info(`[${WORKER}] found=${found} corrected=${corrected} stillNs=${stillNs}`);
  return { found, corrected, stillNs };
}

async function runStaleNsSweepTick(): Promise<void> {
  if (running) {
    logger.debug(`[${WORKER}] previous tick still running — skipping`);
    return;
  }
  running = true;
  try {
    const lease = await withSyncLeaderLease(
      'stale-ns-sweep',
      async ({ signal }) => {
        signal.throwIfAborted();
        return sweepStaleNsFixtures();
      },
      { ttlSec: 120 },
    );
    if (!lease.acquired) {
      logger.debug(`[${WORKER}] distributed lease busy — skipping`);
    }
  } catch (err: unknown) {
    logger.error(`[${WORKER}] tick fatal (recovered):`, (err as Error)?.message);
  } finally {
    running = false;
  }
}

/** Start cron: every 10 minutes. */
export function startStaleNsSweepWorker(): void {
  if (!isScores365ExperimentEnabled()) {
    logger.info(`[${WORKER}] disabled (SCORES365_EXPERIMENT_ENABLED=false)`);
    return;
  }

  const cronExpr = process.env.STALE_NS_SWEEP_CRON?.trim() || '*/10 * * * *';
  cron.schedule(cronExpr, () => {
    void runStaleNsSweepTick();
  });

  // Light boot delay — avoid stacking with other startup syncs.
  const startupDelayMs = Math.max(
    20_000,
    parseInt(process.env.STALE_NS_SWEEP_STARTUP_DELAY_MS || '45000', 10) || 45_000,
  );
  setTimeout(() => {
    void runStaleNsSweepTick();
  }, startupDelayMs);

  logger.info(`[${WORKER}] started — cron="${cronExpr}" batch=${BATCH_SIZE} concurrency=${CONCURRENCY}`);
}
