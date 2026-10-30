/**
 * Server-side rules for King predictions (B1, B2, B5, A12, C1).
 *
 * The kickoff, eligibility and fixture identity always come from our fixture
 * cache (or 365 for native ids) — never from the client payload.
 */

import { fromZonedTime } from 'date-fns-tz';
import prisma from '../lib/prisma';
import { isNative365FixtureId } from '../utils/native-365-fixture-id';

export const KING_TIMEZONE = 'Africa/Cairo';

/** Statuses that still accept a prediction (before kickoff). */
const OPEN_STATUSES = new Set(['NS', 'TBD']);

export type ServerFixture = {
  kickoff: Date | null;
  status: string | null;
  canonicalKey: string;
};

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD of `at` in Africa/Cairo. */
export function cairoDayKey(at: Date = new Date()): string {
  return dayFormatter.format(at);
}

/** [start, end) UTC instants of a Cairo calendar day. */
export function cairoDayRange(dayKey: string): { start: Date; end: Date } {
  const [y, m, d] = dayKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextKey = next.toISOString().slice(0, 10);
  return {
    start: fromZonedTime(`${dayKey}T00:00:00.000`, KING_TIMEZONE),
    end: fromZonedTime(`${nextKey}T00:00:00.000`, KING_TIMEZONE),
  };
}

export type CairoWeek = { start: Date; end: Date; days: string[] };

/** Sunday-through-Saturday Cairo week containing `at`; [start, end) in UTC (Q1). */
export function cairoWeekBounds(at: Date = new Date()): CairoWeek {
  const [y, m, d] = cairoDayKey(at).split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - weekday + i)).toISOString().slice(0, 10),
  );
  return { start: cairoDayRange(days[0]).start, end: cairoDayRange(days[6]).end, days };
}

/** Rows that belong to a King week: by kickoff, or by creation when kickoff is unknown (B8, C4). */
export function kingWeekWhere(week: { start: Date; end: Date }) {
  const range = { gte: week.start, lt: week.end };
  return { OR: [{ matchDate: range }, { matchDate: null, createdAt: range }] };
}

function persisted365GameId(fullData: unknown): number | null {
  if (!fullData || typeof fullData !== 'object') return null;
  const raw = (fullData as { _scores365GameId?: unknown })._scores365GameId;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** One key per real-world fixture, whichever provider id the client sent. */
export function canonicalFixtureKey(apiMatchId: number, fullData?: unknown): string {
  if (isNative365FixtureId(apiMatchId)) return `365:${apiMatchId}`;
  const gameId = persisted365GameId(fullData);
  return gameId ? `365:${gameId}` : `af:${apiMatchId}`;
}

function statusFrom365Group(statusGroup: number | undefined): string | null {
  if (statusGroup === 2) return 'NS';
  if (statusGroup === 3) return 'LIVE';
  if (statusGroup === 4) return 'FT';
  return null;
}

export async function resolveServerFixture(apiMatchId: number): Promise<ServerFixture | null> {
  const cached = await prisma.cachedFixture.findUnique({
    where: { fixtureId: apiMatchId },
    select: { matchDate: true, status: true, fullData: true },
  });
  if (cached) {
    return {
      kickoff: cached.matchDate ?? null,
      status: cached.status ?? null,
      canonicalKey: canonicalFixtureKey(apiMatchId, cached.fullData),
    };
  }

  if (isNative365FixtureId(apiMatchId)) {
    try {
      const { fetchScores365GameById } = await import('./scores365-experiment.service');
      const game = await fetchScores365GameById(apiMatchId, { language: 'en' });
      if (game) {
        const parsed = game.startTime ? new Date(game.startTime) : null;
        return {
          kickoff: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
          status: statusFrom365Group(game.statusGroup),
          canonicalKey: canonicalFixtureKey(apiMatchId),
        };
      }
    } catch {
      // fall through — unknown fixture
    }
  }
  return null;
}

export type LockVerdict = 'OPEN' | 'KICKOFF_UNKNOWN' | 'MATCH_STARTED' | 'MATCH_NOT_ELIGIBLE';

/**
 * Edits close at kickoff (Q6). New rows also need a still-scheduled fixture (B5).
 */
export function lockVerdict(
  fixture: ServerFixture | null,
  opts: { isNew: boolean },
  now: Date = new Date(),
): LockVerdict {
  if (!fixture) return opts.isNew ? 'MATCH_NOT_ELIGIBLE' : 'KICKOFF_UNKNOWN';
  if (!fixture.kickoff) return 'KICKOFF_UNKNOWN';
  if (fixture.kickoff.getTime() <= now.getTime()) return 'MATCH_STARTED';
  if (fixture.status && !OPEN_STATUSES.has(fixture.status.toUpperCase())) {
    return opts.isNew ? 'MATCH_NOT_ELIGIBLE' : 'MATCH_STARTED';
  }
  return 'OPEN';
}
