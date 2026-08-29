/**
 * Predict & Win daily match pool.
 *
 * The product ships "10 matches a day" for sponsors to pick from, but that is a
 * starting volume — not a structural limit. The size is configuration
 * (`PREDICT_WIN_POOL_SIZE`, default 10) and the pool is computed per day, so
 * raising it later needs no schema or app change.
 *
 * This deliberately does NOT reuse `group-round.service`: that pool belongs to
 * the Prediction Groups feature and is capped at its own fixed 10. Both share
 * the same ranking helper, but this picker reads Scores365 `cached_fixtures`
 * only — never API-Football.
 */

import {
  calendarDateFromKickoff,
  calendarTodayKey,
  getAppCalendarTimezone,
  offsetCalendarDateKey,
} from '../utils/calendar-day-bounds.util';
import { pickTopFixtures } from '../utils/fixture-importance';
import { logger } from '../utils/logger';
import { loadPoolFixturesForDate } from './competition-match-pool.source';

/** Sponsors choose from this many matches per day. Configurable, not fixed. */
export const POOL_SIZE = Math.max(
  1,
  Number.parseInt(process.env.PREDICT_WIN_POOL_SIZE ?? '', 10) || 10,
);

/**
 * How many days ahead a sponsor may schedule a competition.
 *
 * This was 0 — today only. Combined with the kickoff cap on the deadline
 * picker it meant a sponsor could only ever choose today, and once the day's
 * remaining fixtures had kicked off there was no legal deadline left at all,
 * so step 2's Next button could never enable. A week of lead time is what the
 * feature needs to be usable; it stays configurable.
 */
export const POOL_MAX_DAYS_AHEAD = (() => {
  const parsed = Number.parseInt(process.env.PREDICT_WIN_POOL_DAYS_AHEAD ?? '', 10);
  return Math.max(0, Number.isFinite(parsed) ? parsed : 7);
})();

/**
 * A challenge needs a window in which people can actually predict, so a match
 * that kicks off in the next few minutes is not offerable. `0` disables the
 * margin; the filter then means strictly "kickoff is still in the future".
 */
export const POOL_MIN_LEAD_MINUTES = (() => {
  const parsed = Number.parseInt(process.env.PREDICT_WIN_POOL_MIN_LEAD_MINUTES ?? '', 10);
  return Math.max(0, Number.isFinite(parsed) ? parsed : 15);
})();

export interface PoolMatch {
  apiMatchId: number;
  home: { name: string; logo: string | null };
  away: { name: string; logo: string | null };
  /** Local pool day, `YYYY-MM-DD`. */
  day: string;
  /** Kickoff as an absolute instant — the value competitions are stamped with. */
  kickoffIso: string;
  /** `HH:mm` for display, derived from `kickoffIso`. */
  time: string;
  status: string;
  leagueName: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a caller-supplied pool date. Rejects malformed input and dates
 * outside the allowed window so `date` can't be used to enumerate arbitrary
 * fixture history.
 */
export function normalisePoolDate(input?: string): string {
  // The app calendar day (Africa/Cairo), not the server's local day: the
  // fixture cache is keyed on the same calendar the HTTP matches-by-date
  // endpoints use, so a UTC server would otherwise ask for yesterday's pool
  // between 00:00 and 03:00 Cairo time.
  const today = calendarTodayKey();
  if (!input) return today;
  if (!DATE_RE.test(input)) throw new Error('INVALID_POOL_DATE');

  const requested = new Date(`${input}T00:00:00Z`).getTime();
  const base = new Date(`${today}T00:00:00Z`).getTime();
  if (Number.isNaN(requested)) throw new Error('INVALID_POOL_DATE');

  const daysAhead = Math.round((requested - base) / 86_400_000);
  if (daysAhead < 0 || daysAhead > POOL_MAX_DAYS_AHEAD) throw new Error('INVALID_POOL_DATE');
  return input;
}

function toPoolMatch(fixture: any, fallbackDay: string): PoolMatch | null {
  const meta = fixture?.fixture ?? {};
  const apiMatchId = meta.id;
  if (typeof apiMatchId !== 'number') return null;

  // Keep the full ISO instant. Slicing date/time apart and re-parsing them as
  // local wall-clock (as the group-round formatter does) shifts kickoffs by the
  // server's UTC offset.
  const kickoff = meta.date ? new Date(meta.date) : null;
  const kickoffIso =
    kickoff && !Number.isNaN(kickoff.getTime())
      ? kickoff.toISOString()
      : new Date(`${fallbackDay}T00:00:00Z`).toISOString();

  return {
    apiMatchId,
    home: { name: fixture?.teams?.home?.name ?? 'Home', logo: fixture?.teams?.home?.logo ?? null },
    away: { name: fixture?.teams?.away?.name ?? 'Away', logo: fixture?.teams?.away?.logo ?? null },
    day: calendarDateFromKickoff(kickoffIso) ?? fallbackDay,
    kickoffIso,
    // `kickoffIso.slice(11,16)` would print UTC — a Cairo sponsor would see
    // every kickoff 2–3 hours early in the match picker. Format in the app
    // calendar timezone, the same one `day` is bucketed by.
    time: appClockTime(kickoffIso),
    status: meta.status?.short ?? 'NS',
    leagueName: fixture?.league?.name ?? null,
  };
}

/** `HH:mm` for an instant, in the app calendar timezone. */
export function appClockTime(iso: string, timezone = getAppCalendarTimezone()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '00:00';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/**
 * The instant a match must kick off after to be offerable.
 *
 * `pickTopFixtures` already drops anything whose status is not `NS`/`TBD`, but
 * status is provider-reported and lags: a fixture that kicked off an hour ago
 * routinely still reads `NS`. Ranking by importance and *then* slicing to
 * `POOL_SIZE` also meant the ten "best" matches of the day could all be ones
 * already played. Either way a sponsor could select a match whose kickoff was
 * in the past, and since the prediction deadline must satisfy
 * `now < deadline <= kickoff`, no deadline existed — step 2's Next button
 * stayed disabled with nothing on screen explaining why.
 */
function eligibilityCutoff(now: Date): number {
  return now.getTime() + POOL_MIN_LEAD_MINUTES * 60_000;
}

/** True when this fixture can still host a challenge created at `now`. */
function isOfferable(match: PoolMatch, now: Date): boolean {
  const kickoff = new Date(match.kickoffIso).getTime();
  if (Number.isNaN(kickoff)) return false;
  return kickoff > eligibilityCutoff(now);
}

/**
 * The ranked pool for one calendar day, capped at `POOL_SIZE`.
 *
 * The time filter runs *before* the importance cut, so the pool is always
 * `POOL_SIZE` matches a sponsor can actually use rather than `POOL_SIZE` of
 * the day's best matches minus however many have already started.
 */
export async function getPoolForDate(dateString?: string, now: Date = new Date()): Promise<PoolMatch[]> {
  const day = normalisePoolDate(dateString);
  let fixtures = await loadPoolFixturesForDate(day);

  // When the durable cache is cold, warm it the same way the Matches tab does
  // so sponsors are not stuck on "Couldn't load the match list".
  if (fixtures.length === 0) {
    try {
      const { footballDataCacheService } = await import('./football-data-cache.service');
      const warmed = await footballDataCacheService.getMatchesByDate(day);
      if (warmed.length > 0) {
        fixtures = await loadPoolFixturesForDate(day);
      }
    } catch (err) {
      logger.warn(`[PredictWinPool] warm cache for ${day} failed:`, err);
    }
  }

  // `pickTopFixtures` with no limit keeps its status filter and its ranking
  // while leaving the cap to us — the eligibility filter has to come first.
  const ranked = pickTopFixtures(fixtures, Number.MAX_SAFE_INTEGER);

  const pool = ranked
    .map((f: any) => toPoolMatch(f, day))
    .filter((m): m is PoolMatch => m !== null)
    .filter((m) => isOfferable(m, now))
    .slice(0, POOL_SIZE);

  if (pool.length === 0) logger.warn(`[PredictWinPool] no offerable fixtures for ${day}`);
  return pool;
}

/**
 * Every match a sponsor may choose right now: today's remaining fixtures plus
 * the next `POOL_MAX_DAYS_AHEAD` days, in kickoff order.
 *
 * This is what the wizard asks for when it does not name a day. Serving only
 * today was what forced the deadline picker onto today's date — there was
 * simply no later kickoff to bound it with.
 */
export async function getUpcomingPool(now: Date = new Date()): Promise<PoolMatch[]> {
  const today = calendarTodayKey();
  const days = [today];
  for (let i = 1; i <= POOL_MAX_DAYS_AHEAD; i += 1) {
    days.push(offsetCalendarDateKey(today, i));
  }

  const perDay = await Promise.all(
    days.map((day) =>
      getPoolForDate(day, now).catch((err) => {
        // One unreachable day must not empty the whole picker.
        logger.warn(`[PredictWinPool] day ${day} failed:`, err?.message ?? err);
        return [] as PoolMatch[];
      }),
    ),
  );

  const seen = new Set<number>();
  return perDay
    .flat()
    .filter((m) => {
      // A fixture can surface under two calendar days around midnight.
      if (seen.has(m.apiMatchId)) return false;
      seen.add(m.apiMatchId);
      return true;
    })
    .sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime());
}

/**
 * Looks a match up inside the pool it must belong to. Returns null when the
 * match is not selectable, so callers can reject the competition.
 *
 * With no `dateString` this searches the whole upcoming window rather than just
 * today — otherwise publishing a competition on a match the picker legitimately
 * offered for tomorrow was rejected with `MATCH_NOT_IN_POOL`.
 */
export async function findInPool(
  apiMatchId: number,
  dateString?: string,
  now: Date = new Date(),
): Promise<PoolMatch | null> {
  const pool = dateString
    ? await getPoolForDate(dateString, now)
    : await getUpcomingPool(now);
  return pool.find((m) => m.apiMatchId === apiMatchId) ?? null;
}
