import cron from 'node-cron';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { withSyncLeaderLease } from '../football-sync-leader.service';
import {
  fetchHighlightPage,
  HighlightlyRequestError,
  isHighlightlyConfigured,
  type HighlightlyPage,
  type NormalizedHighlight,
} from './highlightly.client';
import {
  allowanceAllows,
  highlightDailyBudget,
  markHighlightTick,
  nextUtcMidnightMs,
  noteHighlightUpstream,
  pauseHighlightSync,
  readHighlightAllowance,
  recordHighlightRequest,
  type HighlightAllowance,
} from './highlightly.quota';
import { isHighlightCoverageFixture } from './highlight-coverage';
import {
  FINISHED_HIGHLIGHT_STATUSES,
  GOAL_CATEGORY,
  HIGHLIGHT_PAGE_LIMIT,
  HIGHLIGHT_TIMEZONE,
  HIGHLIGHT_WINDOW_MS,
  MAX_REQUESTS_PER_TICK,
  SUMMARY_CATEGORY,
  highlightDateKey,
  isFixtureDue,
  linkHighlightToFixture,
  planNextCheck,
  selectSyncDates,
  syncTickGapMs,
  type HighlightFixtureCandidate,
} from './highlightly.policy';

const USEFUL_CATEGORIES = new Set([SUMMARY_CATEGORY, GOAL_CATEGORY]);
const FIXTURE_SCAN_LIMIT = 4000;
const LEASE_SCOPE = 'highlightly-highlights';

export interface HighlightSyncOutcome {
  skipped: 'unconfigured' | 'quota' | 'interval' | 'lease' | null;
  requests: number;
  dates: string[];
}

type FetchPage = typeof fetchHighlightPage;

interface DueFixture extends HighlightFixtureCandidate {
  attempts: number;
  priority: boolean;
}

let started = false;

export function startMatchHighlightsSync(): void {
  if (started) return;
  if (!isHighlightlyConfigured()) {
    logger.info('Highlightly sync disabled (HIGHLIGHTLY_API_KEY unset)');
    return;
  }
  started = true;
  const schedule = process.env.HIGHLIGHTLY_SYNC_CRON?.trim() || '*/5 * * * *';
  if (!cron.validate(schedule)) {
    started = false;
    logger.warn(`Invalid HIGHLIGHTLY_SYNC_CRON "${schedule}" — highlight sync not started`);
    return;
  }
  cron.schedule(schedule, () => {
    runMatchHighlightsSync().catch((error) => {
      logger.error('[Highlightly] sync tick failed', error);
    });
  });
  logger.info(
    `Highlightly sync scheduled (${schedule}, budget ${highlightDailyBudget()}/day, free gap 30m)`,
  );
}

export async function runMatchHighlightsSync(deps?: {
  fetchPage?: FetchPage;
  now?: Date;
}): Promise<HighlightSyncOutcome> {
  const now = deps?.now ?? new Date();
  const idle: HighlightSyncOutcome = { skipped: null, requests: 0, dates: [] };
  if (!isHighlightlyConfigured()) return { ...idle, skipped: 'unconfigured' };

  const allowance = await readHighlightAllowance(now);
  if (!allowanceAllows(allowance, now)) return { ...idle, skipped: 'quota' };
  if (tickIsEarly(allowance, now)) return { ...idle, skipped: 'interval' };

  const fetchPage = deps?.fetchPage ?? fetchHighlightPage;
  const lease = await withSyncLeaderLease(
    LEASE_SCOPE,
    async (context) => {
      await markHighlightTick(now);
      return syncUnderLease(fetchPage, now, context.signal, () => context.isLost());
    },
    { ttlSec: 90 },
  );
  if (!lease.acquired || !lease.value) return { ...idle, skipped: 'lease' };
  return lease.value;
}

async function syncUnderLease(
  fetchPage: FetchPage,
  now: Date,
  signal: AbortSignal,
  isLost: () => boolean,
): Promise<HighlightSyncOutcome> {
  const since = new Date(now.getTime() - HIGHLIGHT_WINDOW_MS);
  const fixtures = await prisma.cachedFixture.findMany({
    where: {
      status: { in: [...FINISHED_HIGHLIGHT_STATUSES] },
      matchDate: { gte: since, lte: now },
    },
    select: {
      fixtureId: true,
      homeTeamName: true,
      awayTeamName: true,
      leagueName: true,
      leagueCountry: true,
      matchDate: true,
    },
    orderBy: { matchDate: 'desc' },
    take: FIXTURE_SCAN_LIMIT,
  });
  const covered = fixtures.filter((fixture) => isHighlightCoverageFixture(fixture));
  if (fixtures.length === FIXTURE_SCAN_LIMIT) {
    logger.warn('[Highlightly] finished-fixture scan hit the safety cap');
  }

  if (!covered.length) return { skipped: null, requests: 0, dates: [] };

  const syncRows = await prisma.fixtureHighlightSync.findMany({
    where: { fixtureId: { in: covered.map((fixture) => fixture.fixtureId) } },
  });
  const syncByFixture = new Map(syncRows.map((row) => [row.fixtureId, row]));
  const due: DueFixture[] = [];
  const datePlanInput = covered.map((fixture) => {
    const state = syncByFixture.get(fixture.fixtureId);
    const isDue = isFixtureDue(state, now);
    if (isDue) {
      due.push({
        fixtureId: fixture.fixtureId,
        homeTeamName: fixture.homeTeamName,
        awayTeamName: fixture.awayTeamName,
        matchDate: fixture.matchDate,
        attempts: state?.attempts ?? 0,
        priority: state?.priority ?? false,
      });
    }
    return {
      fixtureId: fixture.fixtureId,
      matchDate: fixture.matchDate,
      due: isDue,
      priority: state?.priority ?? false,
    };
  });

  const dates = selectSyncDates(datePlanInput);
  if (!dates.length) return { skipped: null, requests: 0, dates: [] };

  const candidates: HighlightFixtureCandidate[] = covered.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    homeTeamName: fixture.homeTeamName,
    awayTeamName: fixture.awayTeamName,
    matchDate: fixture.matchDate,
  }));

  let requests = 0;
  let allowance = await readHighlightAllowance(now);
  for (const date of dates) {
    if (requests >= MAX_REQUESTS_PER_TICK || isLost() || signal.aborted) break;
    if (!allowanceAllows(allowance, now)) break;

    const dueOnDate = due.filter((fixture) => highlightDateKey(fixture.matchDate) === date);
    let page: HighlightlyPage;
    try {
      page = await pullPage(fetchPage, { date, offset: 0, signal }, now);
    } catch (error) {
      logPullFailure(date, error);
      break;
    }
    requests += 1;
    allowance = await readHighlightAllowance(now);

    const firstPass = await persistClips(page.clips, candidates);
    const summaries = new Set(firstPass.summaryFixtureIds);
    const linked = new Set(firstPass.linkedFixtureIds);
    const missed = dueOnDate.filter((fixture) => !linked.has(fixture.fixtureId));
    if (
      missed.length > 0 &&
      requests < MAX_REQUESTS_PER_TICK &&
      allowanceAllows(allowance, now) &&
      !isLost() &&
      !signal.aborted
    ) {
      const target = missed[0];
      try {
        const focused = await pullPage(
          fetchPage,
          {
            date,
            offset: 0,
            homeTeamName: target.homeTeamName,
            awayTeamName: target.awayTeamName,
            signal,
          },
          now,
        );
        requests += 1;
        allowance = await readHighlightAllowance(now);
        const extra = await persistClips(focused.clips, candidates);
        for (const fixtureId of extra.summaryFixtureIds) summaries.add(fixtureId);
        for (const fixtureId of extra.linkedFixtureIds) linked.add(fixtureId);
      } catch (error) {
        logPullFailure(date, error);
        await markDateChecked(dueOnDate, summaries, now);
        break;
      }
    }

    await markDateChecked(dueOnDate, summaries, now);
    logger.info(
      `[Highlightly] date=${date} requests=${requests} linked=${linked.size} due=${dueOnDate.length}`,
    );
  }

  return { skipped: null, requests, dates };
}

async function pullPage(
  fetchPage: FetchPage,
  params: {
    date: string;
    offset: number;
    signal: AbortSignal;
    homeTeamName?: string;
    awayTeamName?: string;
  },
  now: Date,
): Promise<HighlightlyPage> {
  try {
    const page = await fetchPage({
      date: params.date,
      offset: params.offset,
      limit: HIGHLIGHT_PAGE_LIMIT,
      timezone: HIGHLIGHT_TIMEZONE,
      homeTeamName: params.homeTeamName,
      awayTeamName: params.awayTeamName,
      signal: params.signal,
    });
    await noteHighlightUpstream(now, { remaining: page.upstreamRemaining, tier: page.tier });
    return page;
  } catch (error) {
    if (
      error instanceof HighlightlyRequestError &&
      (error.status === 429 || error.status === 401)
    ) {
      await pauseHighlightSync(nextUtcMidnightMs(now));
    }
    throw error;
  } finally {
    await recordHighlightRequest(now);
  }
}

async function persistClips(
  clips: NormalizedHighlight[],
  fixtures: HighlightFixtureCandidate[],
): Promise<{ summaryFixtureIds: number[]; linkedFixtureIds: number[] }> {
  const summaryFixtureIds: number[] = [];
  const linkedFixtureIds: number[] = [];
  for (const clip of clips) {
    if (!USEFUL_CATEGORIES.has(clip.category)) continue;
    const link = linkHighlightToFixture(clip, fixtures);
    if (link.fixtureId == null) {
      if (link.ambiguous) {
        logger.warn(
          `[Highlightly] skipped ambiguous clip ${clip.highlightlyId} candidates=${link.candidateIds.join(',')}`,
        );
      }
      continue;
    }
    const shared = {
      highlightlyMatchId: clip.highlightlyMatchId,
      category: clip.category,
      type: clip.type,
      title: clip.title,
      description: clip.description,
      url: clip.url,
      embedUrl: clip.embedUrl,
      imgUrl: clip.imgUrl,
      source: clip.source,
      channel: clip.channel,
      homeTeamName: clip.homeTeamName,
      awayTeamName: clip.awayTeamName,
      leagueName: clip.leagueName,
      matchDate: clip.matchDate,
    };
    await prisma.matchHighlight.upsert({
      where: { highlightlyId: clip.highlightlyId },
      create: {
        highlightlyId: clip.highlightlyId,
        fixtureId: link.fixtureId,
        ...shared,
      },
      update: {
        ...shared,
        ...(link.fixtureId != null ? { fixtureId: link.fixtureId } : {}),
      },
    });
    if (link.fixtureId != null) linkedFixtureIds.push(link.fixtureId);
    void import('../highlight-storage/ingest')
      .then((mod) => mod.noteClipForStorage({
        highlightlyId: clip.highlightlyId,
        fixtureId: link.fixtureId,
        url: clip.url,
      }))
      .catch((error) => logger.warn('[HighlightStorage] enqueue skipped', error));
    if (link.fixtureId != null && clip.category === SUMMARY_CATEGORY) {
      summaryFixtureIds.push(link.fixtureId);
    }
  }
  return { summaryFixtureIds, linkedFixtureIds };
}

async function markDateChecked(
  dueOnDate: DueFixture[],
  summaryFixtureIds: Set<number>,
  now: Date,
): Promise<void> {
  const prior = dueOnDate.length
    ? await prisma.matchHighlight.findMany({
        where: {
          fixtureId: { in: dueOnDate.map((fixture) => fixture.fixtureId) },
          category: SUMMARY_CATEGORY,
        },
        select: { fixtureId: true },
      })
    : [];
  const found = new Set(summaryFixtureIds);
  for (const row of prior) {
    if (row.fixtureId != null) found.add(row.fixtureId);
  }

  for (const fixture of dueOnDate) {
    const plan = planNextCheck({
      foundSummary: found.has(fixture.fixtureId),
      matchDate: fixture.matchDate,
      attempts: fixture.attempts,
      now,
    });
    await prisma.fixtureHighlightSync.upsert({
      where: { fixtureId: fixture.fixtureId },
      create: {
        fixtureId: fixture.fixtureId,
        attempts: plan.attempts,
        nextCheckAt: plan.nextCheckAt,
        status: plan.status,
        priority: false,
        lastCheckedAt: now,
      },
      update: {
        attempts: plan.attempts,
        nextCheckAt: plan.nextCheckAt,
        status: plan.status,
        priority: false,
        lastCheckedAt: now,
      },
    });
  }
}

function tickIsEarly(allowance: HighlightAllowance, now: Date): boolean {
  if (allowance.lastTickMs == null) return false;
  return now.getTime() - allowance.lastTickMs < syncTickGapMs(allowance.tier, allowance.upstreamRemaining);
}

function logPullFailure(date: string, error: unknown): void {
  const status = error instanceof HighlightlyRequestError ? error.status : 0;
  logger.warn(`[Highlightly] date=${date} pull failed status=${status}`);
}
