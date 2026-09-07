import type { Match } from '../components/Matches/matchCardUtils';
import {
  MATCHES_LIST_INTEREST_CAP,
  MATCHES_LIST_KICKOFF_INTEREST_MS,
  MATCHES_LIST_NS_AFTER_KICKOFF_MS,
  MATCHES_LIST_OVERDUE_KICKOFF_MS,
  MATCHES_LIST_STALE_OVERDUE_CAP,
} from '../src/store/liveFixtureStore.types';

function kickoffMs(match: Match): number | null {
  if (!match.fixtureDate) return null;
  const t = Date.parse(match.fixtureDate);
  return Number.isFinite(t) ? t : null;
}

function isUpcomingLike(match: Match): boolean {
  return match.status !== 'live' && match.status !== 'finished';
}

/** Calendar still NS/upcoming this long after kickoff — refresh the day list. */
export function isStaleUpcomingOnCalendar(match: Match, now = Date.now()): boolean {
  if (!isUpcomingLike(match)) return false;
  const kickoff = kickoffMs(match);
  if (kickoff == null) return false;
  return now - kickoff >= MATCHES_LIST_OVERDUE_KICKOFF_MS;
}

/** Poll from 10 min before kickoff through 3h after while the row is still NS. */
export function shouldPollFixtureOnMatchesList(match: Match, now = Date.now()): boolean {
  if (match.status === 'live') return true;
  if (match.status === 'finished') return false;
  const kickoff = kickoffMs(match);
  if (kickoff == null) return false;
  const after = now - kickoff;
  return after >= -MATCHES_LIST_KICKOFF_INTEREST_MS && after <= MATCHES_LIST_NS_AFTER_KICKOFF_MS;
}

/** Live first, then past-kickoff NS, then upcoming kickoffs — capped. */
export function pickMatchesListInterestIds(
  matches: Match[],
  cap = MATCHES_LIST_INTEREST_CAP,
): number[] {
  const now = Date.now();
  const live: { id: number; kickoff: number }[] = [];
  const pastKickoffNs: { id: number; kickoff: number }[] = [];
  const near: { id: number; kickoff: number }[] = [];

  for (const m of matches) {
    if (!shouldPollFixtureOnMatchesList(m, now)) continue;
    const id = parseInt(m.id, 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    const kickoff = kickoffMs(m) ?? 0;
    const row = { id, kickoff };
    if (m.status === 'live') live.push(row);
    else if (now >= kickoff) pastKickoffNs.push(row);
    else near.push(row);
  }

  live.sort((a, b) => a.kickoff - b.kickoff);
  pastKickoffNs.sort((a, b) => a.kickoff - b.kickoff);
  near.sort((a, b) => a.kickoff - b.kickoff);

  const out: number[] = [];
  const seen = new Set<number>();
  for (const row of live) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row.id);
  }
  let overdueAdded = 0;
  for (const row of pastKickoffNs) {
    if (seen.has(row.id)) continue;
    if (overdueAdded >= MATCHES_LIST_STALE_OVERDUE_CAP) break;
    seen.add(row.id);
    out.push(row.id);
    overdueAdded += 1;
  }
  for (const row of near) {
    if (seen.has(row.id)) continue;
    if (out.length >= live.length + MATCHES_LIST_STALE_OVERDUE_CAP + cap) break;
    seen.add(row.id);
    out.push(row.id);
  }
  return out;
}
