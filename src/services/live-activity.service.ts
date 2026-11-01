/**
 * iOS Live Activities for followed teams (lock screen card + Dynamic Island).
 *
 * - "update" tokens: one per running activity. Score / status changes are pushed as soon as the
 *   live cache sees them; the minute ticks on the device from `clockStart`, so quiet spells only
 *   need a low-priority resync every few minutes.
 * - "start" tokens (iOS 17.2+ push-to-start): when a followed team kicks off, the server opens
 *   the activity itself, even if the app has not been opened that day.
 *
 * Reads only the shared live cache, so it adds no upstream API traffic.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { readLiveFixtureById, readTerminalFixtureById } from './live-fixture-cache.service';
import { matchCacheService } from './match-cache.service';
import { resolveTeamMatch, toWidgetMatch, type WidgetMatch, type WidgetTeam } from './widget-feed.service';
import { isApnsConfigured, isDeadToken, sendLiveActivityPush, closeApnsSessions } from './apns.service';
import { withSyncLeaderLease } from './football-sync-leader.service';

export type LiveActivityKind = 'update' | 'start';

const UPDATE_TICK_MS = 10_000;
const START_TICK_MS = 30_000;
/** Keeps the on-device clock honest when nothing else changes (priority 5 does not spend the alert budget). */
const RESYNC_MS = 4 * 60_000;
/** iOS ends every Live Activity after 8 hours; its update token is useless after that. */
const UPDATE_TOKEN_MAX_AGE_MS = 8 * 60 * 60_000;
/** Push-to-start tokens are re-sent on every app launch; one that stays silent this long is abandoned. */
const START_TOKEN_MAX_AGE_MS = 45 * 24 * 60 * 60_000;
/** Opening a card for a match that is nearly over is noise rather than news. */
const START_MAX_ELAPSED = 80;
const MAX_STARTS_PER_DEVICE_PER_TICK = 2;
const STARTED_HISTORY = 30;
const FINAL_DISMISS_AFTER_SEC = 20 * 60;
const STALE_AFTER_SEC = 15 * 60;
const SEND_CONCURRENCY = 20;
/** If the live cache has nothing for this fixture this long after the last successful push, end the card. */
const MISSING_FIXTURE_END_AFTER_MS = 3 * 60_000;

const COPY: Record<'ar' | 'en', { goal: string; kickoff: string }> = {
  en: { goal: 'Goal!', kickoff: 'Kick-off' },
  ar: { goal: 'هدف!', kickoff: 'بدأت المباراة' },
};

export interface MatchActivityState {
  homeScore: number;
  awayScore: number;
  status: 'live' | 'ht' | 'ft' | 'upcoming';
  minute: number | null;
  /**
   * Unix seconds at which the match clock read 0' — only set mid-period (not stoppage).
   * The device caps the timer at the period end so it never invents 50'/129' injury time.
   */
  clockStart: number | null;
  /** Provider period for `45+N'` / `90+N'` formatting on device. */
  statusShort?: string | null;
  /** Announced stoppage when elapsed is pinned at 45/90/120. */
  extra?: number | null;
}

/** Must stay in sync with Swift `MatchActivityAttributes` (app module + widget target). */
export interface MatchActivityAttributes {
  fixtureId: number;
  homeName: string;
  awayName: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  language: string;
}

function copyFor(language: string) {
  return language.startsWith('ar') ? COPY.ar : COPY.en;
}

function periodEndMin(statusShort: string, elapsed: number): number {
  const s = statusShort.trim().toUpperCase();
  if (s === '1H') return 45;
  if (s === 'ET') return elapsed >= 120 ? 120 : 90;
  if (s === 'LIVE' || s === 'INT') {
    if (elapsed <= 45) return 45;
    if (elapsed <= 90) return 90;
    return elapsed >= 120 ? 120 : 90;
  }
  return 90;
}

function isActivityStoppage(
  statusShort: string,
  elapsed: number | null,
  extra: number | null,
): boolean {
  const s = statusShort.trim().toUpperCase();
  const hasExtra = extra != null && extra > 0;
  if (elapsed == null) return hasExtra;
  if (s === '1H') return hasExtra || elapsed > 45;
  if (s === '2H' || s === 'LIVE' || s === 'INT') {
    return hasExtra || elapsed > periodEndMin(s, elapsed);
  }
  if (s === 'ET') return hasExtra || elapsed > 120;
  return false;
}

export function activityState(match: WidgetMatch, nowSec: number): MatchActivityState {
  const status = match.status === 'off' ? 'ft' : match.status;
  const elapsed = match.elapsed;
  const extra = match.extra;
  const statusShort = match.statusShort;
  const stoppage = isActivityStoppage(statusShort, elapsed, extra);
  const canTick =
    status === 'live' &&
    elapsed != null &&
    !stoppage &&
    elapsed < periodEndMin(statusShort, elapsed);
  // Snap "now" to the minute so re-pushes with the same elapsed do not jitter the on-device timer.
  const clockStart = canTick ? Math.floor(nowSec / 60) * 60 - elapsed! * 60 : null;
  return {
    homeScore: match.score?.home ?? 0,
    awayScore: match.score?.away ?? 0,
    status,
    // Elapsed only — never fold `extra` into the minute (that turned 45+5 into 50').
    minute: elapsed,
    statusShort,
    extra,
    clockStart,
  };
}

function stateKey(state: MatchActivityState): string {
  // Mid-period the device ticks from clockStart; only score/status need pushes.
  // In stoppage the label is static — include minute/extra so 90+N / 45+N updates land.
  if (state.clockStart == null && state.status === 'live') {
    return `${state.homeScore}-${state.awayScore}-${state.status}-${state.minute ?? ''}-${state.extra ?? ''}`;
  }
  return `${state.homeScore}-${state.awayScore}-${state.status}`;
}

function goalsIn(key: string | null): number | null {
  if (!key) return null;
  const [home, away] = key.split('-').map((n) => Number.parseInt(n, 10));
  return Number.isFinite(home) && Number.isFinite(away) ? home + away : null;
}

export function activityAttributes(match: WidgetMatch, language: string): MatchActivityAttributes {
  return {
    fixtureId: match.fixtureId,
    homeName: match.home.name,
    awayName: match.away.name,
    homeLogo: match.home.logo ?? '',
    awayLogo: match.away.logo ?? '',
    league: match.league.name,
    language,
  };
}

async function inBatches<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += SEND_CONCURRENCY) {
    await Promise.all(items.slice(i, i + SEND_CONCURRENCY).map(run));
  }
}

async function resolveFixtureForActivity(fixtureId: number) {
  const live = await readLiveFixtureById(fixtureId).catch(() => null);
  if (live?.fixture?.status) return live;
  const terminal = await readTerminalFixtureById(fixtureId).catch(() => null);
  if (terminal?.fixture?.status) return terminal;
  const row = await prisma.cachedFixture.findUnique({ where: { fixtureId } }).catch(() => null);
  if (!row) return null;
  try {
    return matchCacheService.convertDbMatchToApiFormat(row);
  } catch {
    return null;
  }
}

function syntheticFinishedMatch(fixtureId: number, row: {
  lastState: string | null;
}): WidgetMatch {
  const parts = (row.lastState ?? '0-0-ft').split('-');
  const home = Number.parseInt(parts[0] ?? '0', 10);
  const away = Number.parseInt(parts[1] ?? '0', 10);
  return {
    fixtureId,
    status: 'ft',
    statusShort: 'FT',
    kickoffTs: 0,
    elapsed: 90,
    extra: null,
    home: { id: 0, name: '', logo: null },
    away: { id: 0, name: '', logo: null },
    score: {
      home: Number.isFinite(home) ? home : 0,
      away: Number.isFinite(away) ? away : 0,
    },
    league: { id: 0, name: '', logo: null },
  };
}

// MARK: - Registration

export async function registerLiveActivityToken(input: {
  kind: LiveActivityKind;
  token: string;
  deviceId: string;
  fixtureId: number | null;
  teamIds: number[];
  language: string;
}): Promise<void> {
  const { kind, token, deviceId, fixtureId, teamIds, language } = input;

  if (kind === 'update') {
    // Tokens rotate; the previous one for the same activity is dead weight.
    // Keep other update tokens for the same device (other fixtures) intact.
    await prisma.liveActivityToken.deleteMany({
      where: { kind, deviceId, fixtureId, token: { not: token } },
    });
    await prisma.liveActivityToken.upsert({
      where: { token },
      create: { token, kind, deviceId, fixtureId, teamIds, language },
      update: { kind, deviceId, fixtureId, teamIds, language },
    });
    return;
  }

  // Start-token rotation must carry startedFixtureIds / sandbox across so we do not
  // re-open cards the device already saw under the previous token.
  const previous = await prisma.liveActivityToken.findFirst({
    where: { kind: 'start', deviceId, token: { not: token } },
    orderBy: { updatedAt: 'desc' },
  });
  await prisma.liveActivityToken.deleteMany({
    where: { kind: 'start', deviceId, token: { not: token } },
  });
  await prisma.liveActivityToken.upsert({
    where: { token },
    create: {
      token,
      kind,
      deviceId,
      fixtureId: null,
      teamIds,
      language,
      startedFixtureIds: previous?.startedFixtureIds ?? [],
      sandbox: previous?.sandbox ?? null,
    },
    update: {
      kind,
      deviceId,
      fixtureId: null,
      teamIds,
      language,
      ...(previous
        ? {
            startedFixtureIds: previous.startedFixtureIds,
            sandbox: previous.sandbox,
          }
        : {}),
    },
  });
}

export async function removeLiveActivityToken(token: string): Promise<void> {
  await prisma.liveActivityToken.deleteMany({ where: { token } });
}

// MARK: - Update pushes

export async function runUpdateCycle(now: number): Promise<void> {
  const nowSec = Math.floor(now / 1000);
  const rows = await prisma.liveActivityToken.findMany({ where: { kind: 'update' } });
  if (rows.length === 0) return;

  const expired = rows.filter((r) => now - r.createdAt.getTime() > UPDATE_TOKEN_MAX_AGE_MS || r.fixtureId == null);
  if (expired.length) {
    await prisma.liveActivityToken.deleteMany({ where: { token: { in: expired.map((r) => r.token) } } });
  }
  const active = rows.filter((r) => !expired.includes(r));

  const byFixture = new Map<number, typeof active>();
  for (const row of active) {
    const list = byFixture.get(row.fixtureId!) ?? [];
    list.push(row);
    byFixture.set(row.fixtureId!, list);
  }

  for (const [fixtureId, tokens] of byFixture) {
    const fixture = await resolveFixtureForActivity(fixtureId);
    let match: WidgetMatch | null = fixture?.fixture?.status ? toWidgetMatch(fixture) : null;

    if (!match || match.status === 'upcoming') {
      // Fixture dropped out of live cache without a terminal snapshot — end after a short grace
      // so a brief Redis miss does not wipe an in-play card.
      const oldestPush = Math.min(
        ...tokens.map((t) => t.lastPushAt?.getTime() ?? t.createdAt.getTime()),
      );
      if (now - oldestPush < MISSING_FIXTURE_END_AFTER_MS) continue;
      match = syntheticFinishedMatch(fixtureId, tokens[0]);
      logger.info(`[LiveActivity] ending ${fixtureId} — fixture missing from live cache`);
    }

    const state = activityState(match, nowSec);
    const key = stateKey(state);
    const finished = state.status === 'ft';

    await inBatches(tokens, async (row) => {
      const changed = key !== row.lastState;
      const due = !row.lastPushAt || now - row.lastPushAt.getTime() >= RESYNC_MS;
      if (!finished && !changed && !due) return;

      const aps: Record<string, unknown> = {
        timestamp: nowSec,
        event: finished ? 'end' : 'update',
        'content-state': state,
      };
      if (finished) {
        aps['dismissal-date'] = nowSec + FINAL_DISMISS_AFTER_SEC;
      } else {
        aps['stale-date'] = nowSec + STALE_AFTER_SEC;
      }
      const before = goalsIn(row.lastState);
      if (!finished && before != null && state.homeScore + state.awayScore > before) {
        aps.alert = {
          title: copyFor(row.language).goal,
          body: `${match!.home.name} ${state.homeScore} - ${state.awayScore} ${match!.away.name}`,
        };
      }

      const result = await sendLiveActivityPush(row.token, aps, {
        priority: changed || finished ? 10 : 5,
        sandbox: row.sandbox,
      });
      if (isDeadToken(result)) {
        logger.warn(
          `[LiveActivity] dead update token for fixture ${fixtureId}: ${result.status} ${result.reason ?? ''}`,
        );
        await removeLiveActivityToken(row.token);
        return;
      }
      if (finished) {
        await removeLiveActivityToken(row.token);
        return;
      }
      if (result.status === 200) {
        await prisma.liveActivityToken.update({
          where: { token: row.token },
          data: { lastState: key, lastPushAt: new Date(now), sandbox: result.sandbox },
        });
      } else {
        logger.warn(`[LiveActivity] update ${fixtureId} failed: ${result.status} ${result.reason ?? ''}`);
      }
    });
  }
}

// MARK: - Push-to-start

export async function runStartCycle(now: number): Promise<void> {
  const nowSec = Math.floor(now / 1000);
  await prisma.liveActivityToken.deleteMany({
    where: { kind: 'start', updatedAt: { lt: new Date(now - START_TOKEN_MAX_AGE_MS) } },
  });
  const rows = await prisma.liveActivityToken.findMany({ where: { kind: 'start', NOT: { teamIds: { isEmpty: true } } } });
  if (rows.length === 0) return;

  const running = await prisma.liveActivityToken.findMany({
    where: { kind: 'update' },
    select: { deviceId: true, fixtureId: true },
  });
  const runningKeys = new Set(running.map((r) => `${r.deviceId}:${r.fixtureId}`));

  const teamCache = new Map<string, Promise<WidgetTeam>>();
  const teamFor = (teamId: number, language: string) => {
    const cacheKey = `${teamId}:${language}`;
    let pending = teamCache.get(cacheKey);
    if (!pending) {
      pending = resolveTeamMatch(teamId, language, nowSec);
      teamCache.set(cacheKey, pending);
    }
    return pending;
  };

  await inBatches(rows, async (row) => {
    const started = new Set(row.startedFixtureIds);
    let opened = 0;
    let dead = false;
    let sandbox = row.sandbox;

    for (const teamId of row.teamIds) {
      if (opened >= MAX_STARTS_PER_DEVICE_PER_TICK || dead) break;
      const match = (await teamFor(teamId, row.language)).match;
      if (!match || (match.status !== 'live' && match.status !== 'ht')) continue;
      if (started.has(match.fixtureId)) continue;
      if ((match.elapsed ?? 0) > START_MAX_ELAPSED) continue;
      started.add(match.fixtureId);
      if (runningKeys.has(`${row.deviceId}:${match.fixtureId}`)) continue;

      const state = activityState(match, nowSec);
      const result = await sendLiveActivityPush(
        row.token,
        {
          timestamp: nowSec,
          event: 'start',
          'attributes-type': 'MatchActivityAttributes',
          attributes: activityAttributes(match, row.language),
          'content-state': state,
          'stale-date': nowSec + STALE_AFTER_SEC,
          // iOS 18+: ask APNs to deliver a fresh update token so the app can register it.
          'input-push-token': 1,
          alert: {
            title: copyFor(row.language).kickoff,
            body: `${match.home.name} ${state.homeScore} - ${state.awayScore} ${match.away.name}`,
          },
        },
        { priority: 10, sandbox },
      );
      if (isDeadToken(result)) {
        logger.warn(
          `[LiveActivity] dead start token for device ${row.deviceId.slice(0, 8)}: ${result.status} ${result.reason ?? ''}`,
        );
        dead = true;
      } else if (result.status === 200) {
        opened += 1;
        sandbox = result.sandbox;
        logger.info(`[LiveActivity] push-to-start ${match.fixtureId} for device ${row.deviceId.slice(0, 8)}`);
      } else {
        logger.warn(`[LiveActivity] start ${match.fixtureId} failed: ${result.status} ${result.reason ?? ''}`);
      }
    }

    if (dead) {
      await removeLiveActivityToken(row.token);
    } else if (started.size !== row.startedFixtureIds.length) {
      await prisma.liveActivityToken.update({
        where: { token: row.token },
        data: { startedFixtureIds: [...started].slice(-STARTED_HISTORY), sandbox },
      });
    }
  });
}

// MARK: - Scheduler

class LiveActivityPushService {
  private updateTimer: NodeJS.Timeout | null = null;
  private startTimer: NodeJS.Timeout | null = null;
  private updateInFlight = false;
  private startInFlight = false;

  start(): void {
    if (this.updateTimer) return;
    if (!isApnsConfigured()) {
      logger.info('[LiveActivity] disabled — APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY not set');
      return;
    }
    this.updateTimer = setInterval(() => void this.tick('update'), UPDATE_TICK_MS);
    this.startTimer = setInterval(() => void this.tick('start'), START_TICK_MS);
    logger.info('[LiveActivity] push service started');
  }

  stop(): void {
    if (this.updateTimer) clearInterval(this.updateTimer);
    if (this.startTimer) clearInterval(this.startTimer);
    this.updateTimer = null;
    this.startTimer = null;
    closeApnsSessions();
  }

  private async tick(kind: 'update' | 'start'): Promise<void> {
    const flag = kind === 'update' ? 'updateInFlight' : 'startInFlight';
    if (this[flag]) return;
    this[flag] = true;
    try {
      await withSyncLeaderLease(
        `live-activity-${kind}`,
        () => (kind === 'update' ? runUpdateCycle(Date.now()) : runStartCycle(Date.now())),
        { ttlSec: kind === 'update' ? 30 : 60 },
      );
    } catch (err) {
      logger.warn(`[LiveActivity] ${kind} cycle failed:`, (err as Error)?.message);
    } finally {
      this[flag] = false;
    }
  }
}

export const liveActivityPushService = new LiveActivityPushService();
