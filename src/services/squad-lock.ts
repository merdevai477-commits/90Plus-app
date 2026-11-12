import { createHash } from 'crypto';

/**
 * Per-user squad edit lock and kickoff eligibility.
 * The lock is not a calendar week and not a league round.
 * Scoring uses kickoff against confirmed membership, not the job clock.
 */

export const SQUAD_LOCK_MS = 7 * 24 * 60 * 60 * 1000;

export type MembershipInterval = {
  selectedAt: Date;
  removedAt: Date | null;
};

export type SquadLockState = {
  confirmedAt: Date | null;
  unlocksAt: Date | null;
  version: number;
};

export function squadUnlocksAt(confirmedAt: Date): Date {
  return new Date(confirmedAt.getTime() + SQUAD_LOCK_MS);
}

/** True only while a confirmation is still inside its 7 days. Null means editable. */
export function isSquadEditLocked(unlocksAt: Date | null | undefined, now: Date): boolean {
  return unlocksAt != null && now.getTime() < unlocksAt.getTime();
}

/**
 * A confirmed player scores a match only when the kickoff falls inside the
 * membership. Drafts are not memberships. The job's run time is not used.
 */
export function membershipCoversKickoff(member: MembershipInterval, kickoffAt: Date): boolean {
  if (kickoffAt.getTime() < member.selectedAt.getTime()) return false;
  if (member.removedAt != null && kickoffAt.getTime() >= member.removedAt.getTime()) return false;
  return true;
}

/**
 * Kickoff membership is the rule for every new performance.
 * `legacyThrough` keeps rows already stored before the squad-lock migration,
 * and only inside that membership's own gameweek. It must not pull points
 * from earlier weeks the user did not play this player in.
 */
export function performanceCountsForMember(
  row: { kickoffAt: Date; createdAt: Date; gameweekId?: string | null },
  member: MembershipInterval & { legacyThrough?: Date | null },
  memberGameweekId: string | null = null,
): boolean {
  if (membershipCoversKickoff(member, row.kickoffAt)) return true;
  if (member.legacyThrough == null || memberGameweekId == null) return false;
  if (row.gameweekId != null && row.gameweekId !== memberGameweekId) return false;
  return row.createdAt.getTime() <= member.legacyThrough.getTime();
}

/** How long a finished fixture is re-read for a provider correction. */
export const SCORE_CORRECTION_WINDOW_MS = 36 * 60 * 60 * 1000;

/** True when the worker should fetch the game again. A sealed hash outside the window stays put. */
export function shouldRefetchScoredFixture(
  fixture: { processedAt: Date | null; sourceHash: string | null },
  now: Date,
): boolean {
  if (!fixture.processedAt || !fixture.sourceHash) return true;
  return now.getTime() - fixture.processedAt.getTime() <= SCORE_CORRECTION_WINDOW_MS;
}

export type StatLine = { key: string; goals: number; assists: number; points: number; mark?: string };

/** Stable fingerprint of the lines that will be stored. Identical lines are a duplicate delivery. */
export function statLineHash(lines: readonly StatLine[]): string {
  const body = [...lines]
    .map((line) => `${line.key}:${line.goals}:${line.assists}:${line.points}:${line.mark ?? ''}`)
    .sort()
    .join('|');
  return createHash('sha256').update(body).digest('hex');
}

/** Provider kickoff when a postponed match is given a new start. */
export function providerKickoff(game: { startTime?: string | null } | null | undefined): Date | null {
  if (!game?.startTime) return null;
  const parsed = new Date(game.startTime);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function lineupKey(slots: ReadonlyArray<{ slotKey: string; id: string | null }>): string {
  return [...slots]
    .map((slot) => `${slot.slotKey}:${slot.id ?? ''}`)
    .sort()
    .join('|');
}

export function lineupsDiffer(
  before: ReadonlyArray<{ slotKey: string; id: string | null }>,
  after: ReadonlyArray<{ slotKey: string; id: string | null }>,
): boolean {
  return lineupKey(before) !== lineupKey(after);
}

/**
 * Confirm result. An identical lineup does not start a new lock.
 * A locked squad cannot be confirmed again until `unlocksAt`.
 */
export function nextConfirmedLock(
  state: SquadLockState,
  changed: boolean,
  now: Date,
): { ok: true; confirmedAt: Date | null; unlocksAt: Date | null; version: number } | { ok: false; reason: 'LOCKED' } {
  if (isSquadEditLocked(state.unlocksAt, now)) return { ok: false, reason: 'LOCKED' };
  if (!changed) {
    return { ok: true, confirmedAt: state.confirmedAt, unlocksAt: state.unlocksAt, version: state.version };
  }
  return {
    ok: true,
    confirmedAt: now,
    unlocksAt: squadUnlocksAt(now),
    version: state.version + 1,
  };
}

export type CountedPerformance = {
  points: number;
  kickoffAt: Date;
  createdAt: Date;
};

/**
 * Points from one player's performances.
 * Rows created at or before `legacyThrough` stay (already awarded).
 * Later rows count only when a membership covers the kickoff.
 */
export function pointsCoveringKickoff(
  performances: readonly CountedPerformance[],
  memberships: readonly MembershipInterval[],
  legacyThrough: Date | null,
): number {
  let total = 0;
  for (const row of performances) {
    const legacy = legacyThrough != null && row.createdAt.getTime() <= legacyThrough.getTime();
    const covered = memberships.some((member) => membershipCoversKickoff(member, row.kickoffAt));
    if (legacy || covered) total += row.points;
  }
  return total;
}

export type FixtureAvailabilityLabel = 'FINISHED' | 'LIVE' | 'UPCOMING' | 'POSTPONED';

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const LIVE = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT']);
const POSTPONED = new Set(['PST', 'TBD']);

/** Informational only. Never used to hide or reject a player. */
export function fixtureAvailabilityLabel(
  status: string | null | undefined,
  kickoffAt: Date,
  now: Date,
): FixtureAvailabilityLabel {
  const code = String(status ?? '').toUpperCase();
  if (POSTPONED.has(code)) return 'POSTPONED';
  if (FINISHED.has(code)) return 'FINISHED';
  if (LIVE.has(code)) return 'LIVE';
  if (kickoffAt.getTime() > now.getTime()) return 'UPCOMING';
  return 'LIVE';
}

/** Prefer the next kickoff; otherwise the most recent one. */
export function nearestFixture<T extends { kickoffAt: Date }>(fixtures: readonly T[], now: Date): T | null {
  if (fixtures.length === 0) return null;
  const upcoming = fixtures
    .filter((fixture) => fixture.kickoffAt.getTime() >= now.getTime())
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
  if (upcoming.length > 0) return upcoming[0];
  return [...fixtures].sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime())[0];
}
