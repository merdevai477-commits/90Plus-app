import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { isHighlightCoverageFixture } from './highlight-coverage';
import {
  isFinishedHighlightStatus,
  pickGoals,
  pickSummaries,
  resolveReadStatus,
  shouldPrioritizeHighlight,
  type HighlightReadStatus,
  type PublicHighlight,
  type StoredHighlightClip,
} from './highlightly.policy';

export interface FixtureHighlightsResult {
  status: HighlightReadStatus;
  summary: PublicHighlight | null;
  summaries: PublicHighlight[];
  goals: PublicHighlight[];
  checkedAt: string | null;
}

const EMPTY: FixtureHighlightsResult = {
  status: 'not_finished',
  summary: null,
  summaries: [],
  goals: [],
  checkedAt: null,
};

/**
 * Reads stored clips only. Highlightly is never called from this path.
 */
export async function getFixtureHighlights(
  fixtureId: number,
  now = new Date(),
): Promise<FixtureHighlightsResult> {
  const fixture = await prisma.cachedFixture.findUnique({
    where: { fixtureId },
    select: {
      status: true,
      matchDate: true,
      leagueName: true,
      leagueCountry: true,
      homeTeamName: true,
      awayTeamName: true,
    },
  });
  if (!fixture || !isFinishedHighlightStatus(fixture.status)) return EMPTY;

  const [clips, sync] = await Promise.all([
    prisma.matchHighlight.findMany({
      where: { fixtureId },
      select: {
        highlightlyId: true,
        category: true,
        type: true,
        title: true,
        description: true,
        url: true,
        embedUrl: true,
        imgUrl: true,
        source: true,
      },
    }),
    prisma.fixtureHighlightSync.findUnique({ where: { fixtureId } }),
  ]);

  const stored = clips as StoredHighlightClip[];
  const summaries = pickSummaries(stored);
  const summary = summaries[0] ?? null;
  const goals = pickGoals(stored);
  const covered = isHighlightCoverageFixture(fixture);
  if (!covered && summary == null && goals.length === 0) {
    return { status: 'unavailable', summary: null, summaries: [], goals: [], checkedAt: null };
  }
  const status = resolveReadStatus({
    finished: true,
    hasUsefulClips: summary != null || goals.length > 0,
    syncStatus: sync?.status ?? null,
    matchDate: fixture.matchDate,
    now,
  });

  await noteRead(fixtureId, status, sync, now);

  return {
    status,
    summary,
    summaries,
    goals,
    checkedAt: sync?.lastCheckedAt?.toISOString() ?? null,
  };
}

async function noteRead(
  fixtureId: number,
  status: HighlightReadStatus,
  sync: {
    status: string;
    nextCheckAt: Date;
    attempts: number;
    lastCheckedAt: Date | null;
    priority: boolean;
  } | null,
  now: Date,
): Promise<void> {
  try {
    if (status === 'unavailable') {
      if (sync && sync.status !== 'unavailable') {
        await prisma.fixtureHighlightSync.upsert({
          where: { fixtureId },
          create: {
            fixtureId,
            status: 'unavailable',
            attempts: sync.attempts,
            nextCheckAt: sync.nextCheckAt,
            priority: false,
            lastCheckedAt: sync.lastCheckedAt,
          },
          update: { status: 'unavailable', priority: false },
        });
      }
      return;
    }

    if (
      sync?.priority !== true &&
      shouldPrioritizeHighlight({
        status,
        nextCheckAt: sync?.nextCheckAt ?? null,
        now,
      })
    ) {
      await prisma.fixtureHighlightSync.upsert({
        where: { fixtureId },
        create: {
          fixtureId,
          status: 'pending',
          attempts: 0,
          nextCheckAt: now,
          priority: true,
          lastCheckedAt: null,
        },
        update: { priority: true },
      });
    }
  } catch (error) {
    logger.warn(`[Highlightly] read wake failed for fixture ${fixtureId}`, error);
  }
}
