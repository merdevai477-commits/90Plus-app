/**
 * Top Scorers Five — pure rules: points, per-fixture stat extraction, the
 * gameweek window and its lifecycle. No I/O, so every rule is unit-testable.
 */

import type { TopScorersFiveGameweekStatus } from '@prisma/client';

export const TSF_POINTS_PER_GOAL = 3;
export const TSF_POINTS_PER_ASSIST = 1;

export type TsfLeagueKey = 'pl' | 'laliga' | 'bundesliga' | 'seriea' | 'ligue1';

export type TsfLeagueConfig = {
  key: TsfLeagueKey;
  /** `CachedFixture.leagueId` of the competition (365Scores competition id + 7,000,000). */
  competitionLeagueId: number;
  /** 365Scores competition id, for its season leaderboards. */
  scores365CompetitionId: number;
};

/**
 * Leagues whose pool and scoring are live. The other keys stay on the app's
 * placeholder data until their player lists are supplied.
 */
export const TSF_LEAGUES: Partial<Record<TsfLeagueKey, TsfLeagueConfig>> = {
  laliga: { key: 'laliga', competitionLeagueId: 7000011, scores365CompetitionId: 11 },
  seriea: { key: 'seriea', competitionLeagueId: 7000017, scores365CompetitionId: 17 },
  bundesliga: { key: 'bundesliga', competitionLeagueId: 7000025, scores365CompetitionId: 25 },
  pl: { key: 'pl', competitionLeagueId: 7000007, scores365CompetitionId: 7 },
  ligue1: { key: 'ligue1', competitionLeagueId: 7000035, scores365CompetitionId: 35 },
};

/**
 * The picker card draws the player over its own artwork, so the portrait has
 * its studio backdrop removed (365's image CDN does the cut-out and caches it).
 */
export function tsfPortraitUrl(athleteId: number): string {
  return `https://imagecache.365scores.com/image/upload/e_background_removal,f_png,w_256,h_256,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png/Athletes/${athleteId}`;
}

export function getTsfLeagueConfig(leagueKey: string): TsfLeagueConfig | null {
  return (TSF_LEAGUES as Record<string, TsfLeagueConfig | undefined>)[leagueKey] ?? null;
}

export function enabledTsfLeagues(): TsfLeagueConfig[] {
  return Object.values(TSF_LEAGUES).filter((cfg): cfg is TsfLeagueConfig => cfg != null);
}

export type TsfStatLine = { goals: number; assists: number };

export function computeTsfPoints({ goals, assists }: TsfStatLine): number {
  return goals * TSF_POINTS_PER_GOAL + assists * TSF_POINTS_PER_ASSIST;
}

/** Sum of finished-fixture performances — a user's (or player's) score. */
export function sumTsfPerformances(
  rows: ReadonlyArray<{ goals: number; assists: number; points: number }>,
): { goals: number; assists: number; points: number } {
  return rows.reduce(
    (acc, row) => ({
      goals: acc.goals + row.goals,
      assists: acc.assists + row.assists,
      points: acc.points + row.points,
    }),
    { goals: 0, assists: 0, points: 0 },
  );
}

// ─── Fixture status ─────────────────────────────────────────────────────────

const FINISHED = new Set(['FT', 'AET', 'PEN']);
/** Never going to produce a result in this window. */
const VOID = new Set(['CANC', 'ABD', 'AWD', 'WO']);
const POSTPONED = new Set(['PST', 'TBD']);

export function isTsfFinishedStatus(status: string | null | undefined): boolean {
  return FINISHED.has(String(status ?? '').toUpperCase());
}

export function isTsfVoidStatus(status: string | null | undefined): boolean {
  return VOID.has(String(status ?? '').toUpperCase());
}

export function isTsfPostponedStatus(status: string | null | undefined): boolean {
  return POSTPONED.has(String(status ?? '').toUpperCase());
}

// ─── 365Scores game → per-athlete goals/assists ──────────────────────────────

type GameMember = { id: number; athleteId?: number | null };
type GameEvent = {
  playerId?: number | null;
  extraPlayers?: number[] | null;
  eventType?: { id?: number | null; name?: string | null; subTypeName?: string | null } | null;
};
type GameSide = { lineups?: { members?: Array<{ id: number; status?: number | null }> | null } | null };
export type TsfScorableGame = {
  members?: GameMember[] | null;
  events?: GameEvent[] | null;
  homeCompetitor?: GameSide | null;
  awayCompetitor?: GameSide | null;
};

const GOAL_EVENT_TYPE_ID = 1;

/**
 * Goals and assists per 365Scores athleteId for one game. Event player ids are
 * per-game member ids, so they are mapped through `members[].athleteId`. Own
 * goals score nothing for the player who put the ball in his own net and carry
 * no assist; penalties scored in play count as goals.
 */
export function extractTsfStatsFrom365Game(game: TsfScorableGame): Map<number, TsfStatLine> {
  const athleteByMember = new Map<number, number>();
  for (const member of game.members ?? []) {
    if (member.athleteId != null && member.athleteId > 0) {
      athleteByMember.set(member.id, member.athleteId);
    }
  }

  const stats = new Map<number, TsfStatLine>();
  const bump = (athleteId: number, field: keyof TsfStatLine) => {
    const line = stats.get(athleteId) ?? { goals: 0, assists: 0 };
    line[field] += 1;
    stats.set(athleteId, line);
  };

  for (const event of game.events ?? []) {
    if (event.eventType?.id !== GOAL_EVENT_TYPE_ID) continue;
    if (/own\s*goal/i.test(event.eventType?.subTypeName ?? '')) continue;

    const scorer = event.playerId != null ? athleteByMember.get(event.playerId) : undefined;
    if (scorer != null) bump(scorer, 'goals');

    const assistMember = event.extraPlayers?.[0];
    const assister = assistMember != null ? athleteByMember.get(assistMember) : undefined;
    if (assister != null && assister !== scorer) bump(assister, 'assists');
  }

  return stats;
}

export type TsfParticipation = 'STARTED' | 'SUBBED_ON' | 'BENCH' | 'UNAVAILABLE' | 'NOT_IN_SQUAD' | 'UNKNOWN';

/** 365Scores lineup member status: 0/1 starter, 2 bench, 3 missing (injured, suspended). */
const LINEUP_STARTER = new Set([0, 1]);
const LINEUP_BENCH = 2;
const LINEUP_MISSING = 3;
const SUBSTITUTION_EVENT_TYPE_IDS = new Set([4, 1000]);

/**
 * How each listed athlete took part, from the final lineups. A bench player who
 * shows up in a substitution (or scores) came on. Without lineups 365 cannot
 * tell, so every athlete is UNKNOWN and an absent one NOT_IN_SQUAD only when
 * lineups exist. Points never depend on this — only goals and assists score.
 */
export function tsfParticipationFrom365Game(game: TsfScorableGame): {
  hasLineups: boolean;
  byAthlete: Map<number, TsfParticipation>;
} {
  const athleteByMember = new Map<number, number>();
  for (const member of game.members ?? []) {
    if (member.athleteId != null && member.athleteId > 0) athleteByMember.set(member.id, member.athleteId);
  }

  const involved = new Set<number>();
  for (const event of game.events ?? []) {
    const typeId = event.eventType?.id ?? null;
    const isSub = (typeId != null && SUBSTITUTION_EVENT_TYPE_IDS.has(typeId)) || /subst/i.test(event.eventType?.name ?? '');
    if (!isSub && typeId !== GOAL_EVENT_TYPE_ID) continue;
    for (const memberId of [event.playerId, ...(event.extraPlayers ?? [])]) {
      if (memberId != null) involved.add(memberId);
    }
  }

  const byAthlete = new Map<number, TsfParticipation>();
  const lineupMembers = [
    ...(game.homeCompetitor?.lineups?.members ?? []),
    ...(game.awayCompetitor?.lineups?.members ?? []),
  ];
  for (const member of lineupMembers) {
    const athleteId = athleteByMember.get(member.id);
    if (athleteId == null) continue;
    const status = member.status ?? -1;
    let value: TsfParticipation | null = null;
    if (LINEUP_STARTER.has(status)) value = 'STARTED';
    else if (status === LINEUP_BENCH) value = involved.has(member.id) ? 'SUBBED_ON' : 'BENCH';
    else if (status === LINEUP_MISSING) value = 'UNAVAILABLE';
    if (value) byAthlete.set(athleteId, value);
  }
  return { hasLineups: byAthlete.size > 0, byAthlete };
}

export function tsfParticipationOf(
  athleteId: number,
  participation: ReturnType<typeof tsfParticipationFrom365Game>,
): TsfParticipation {
  return participation.byAthlete.get(athleteId) ?? (participation.hasLineups ? 'NOT_IN_SQUAD' : 'UNKNOWN');
}

/** Every athlete listed for the game (starters, bench, both clubs). */
export function tsfGameAthleteIds(game: TsfScorableGame): Set<number> {
  const ids = new Set<number>();
  for (const member of game.members ?? []) {
    if (member.athleteId != null && member.athleteId > 0) ids.add(member.athleteId);
  }
  return ids;
}

// ─── Gameweek window + lifecycle ─────────────────────────────────────────────

const DAY_MS = 86_400_000;
/** Windows start Tuesday 00:00 UTC so a Fri–Mon matchday never straddles two. */
const WINDOW_START_UTC_DAY = 2;

export type TsfGameweekWindow = { weekKey: string; startAt: Date; endAt: Date };

export function tsfGameweekWindow(now: Date = new Date()): TsfGameweekWindow {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const offset = (now.getUTCDay() - WINDOW_START_UTC_DAY + 7) % 7;
  const startAt = new Date(midnight - offset * DAY_MS);
  const endAt = new Date(startAt.getTime() + 7 * DAY_MS);
  return { weekKey: startAt.toISOString().slice(0, 10), startAt, endAt };
}

const STATUS_ORDER: TopScorersFiveGameweekStatus[] = [
  'OPEN',
  'LOCKED',
  'LIVE',
  'CALCULATING',
  'COMPLETED',
];

export function tsfStatusRank(status: TopScorersFiveGameweekStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/**
 * Where the lifecycle should be now. COMPLETED is not derived here — only the
 * processor sets it, after its final pass has stored every fixture.
 */
export function nextTsfGameweekStatus(
  current: TopScorersFiveGameweekStatus,
  input: { now: Date; lockAt: Date; endAt: Date; anyStarted: boolean; allSettled: boolean },
): TopScorersFiveGameweekStatus {
  let target: TopScorersFiveGameweekStatus = 'OPEN';
  if (input.now >= input.lockAt) target = input.anyStarted ? 'LIVE' : 'LOCKED';
  if (input.now >= input.endAt && input.allSettled) target = 'CALCULATING';
  return tsfStatusRank(target) > tsfStatusRank(current) ? target : current;
}

/** Picks are editable only before the deadline, whatever the stored status says. */
export function isTsfGameweekOpen(gameweek: { lockAt: Date; status: TopScorersFiveGameweekStatus }, now: Date = new Date()): boolean {
  return gameweek.status === 'OPEN' && now < gameweek.lockAt;
}

/**
 * A pick can still be set only while the gameweek is open and the user has not
 * confirmed one. Confirming is final until the next gameweek.
 */
export function isTsfSelectionLocked(
  selection: { confirmedAt: Date | null } | null,
  gameweek: { lockAt: Date; status: TopScorersFiveGameweekStatus },
  now: Date = new Date(),
): boolean {
  return selection?.confirmedAt != null || !isTsfGameweekOpen(gameweek, now);
}

/** The "next 7 days" fixture window, from now. */
export function tsfUpcomingWindow(now: Date = new Date(), days = 7): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + days * DAY_MS) };
}

// ─── A user's pick state ─────────────────────────────────────────────────────

export type TsfPickState = 'PICKING' | 'CONFIRMED' | 'WAITING_FOR_MATCHES' | 'CALCULATING' | 'COMPLETED';

const PICK_STATE_ORDER: TsfPickState[] = ['PICKING', 'CONFIRMED', 'WAITING_FOR_MATCHES', 'CALCULATING', 'COMPLETED'];

export type TsfRelevantFixtureState = { kickoffAt: Date; status: string; processed: boolean };

/**
 * Where one league pick stands. Fixtures are the pick's club's fixtures in the
 * gameweek; postponed ones have left the window and are ignored.
 *   PICKING              nothing picked, or a carried-over pick not yet confirmed
 *   CONFIRMED            locked, no relevant match has kicked off
 *   WAITING_FOR_MATCHES  a relevant match is live or still to come
 *   CALCULATING          every relevant match is over, stats not all stored yet
 *   COMPLETED            every relevant match's stats are stored — the score is final
 */
export function tsfPickState(input: {
  picked: boolean;
  locked: boolean;
  now: Date;
  windowEnd: Date;
  fixtures: readonly TsfRelevantFixtureState[];
}): TsfPickState {
  if (!input.picked || !input.locked) return 'PICKING';
  const relevant = input.fixtures.filter((f) => f.processed || !isTsfPostponedStatus(f.status));
  if (relevant.length === 0) return input.now >= input.windowEnd ? 'COMPLETED' : 'CONFIRMED';
  if (relevant.every((f) => f.processed)) return 'COMPLETED';
  if (!relevant.some((f) => f.kickoffAt <= input.now)) return 'CONFIRMED';
  const allOver = relevant.every(
    (f) => f.processed || isTsfFinishedStatus(f.status) || isTsfVoidStatus(f.status),
  );
  return allOver ? 'CALCULATING' : 'WAITING_FOR_MATCHES';
}

/**
 * The user's overall state across league picks: the least advanced one, so the
 * result is final only once every pick's matches are done. No pick → PICKING.
 */
export function combineTsfPickStates(states: readonly TsfPickState[]): TsfPickState {
  if (states.length === 0) return 'PICKING';
  return states.reduce((min, state) =>
    PICK_STATE_ORDER.indexOf(state) < PICK_STATE_ORDER.indexOf(min) ? state : min,
  );
}

// ─── Name matching (pool resolution) ────────────────────────────────────────

/** Arabic + Latin folding so "أوباميانغ" ≈ "اوباميانغ" and "Mbappé" ≈ "mbappe". */
export function normalizeTsfName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ø/gi, 'o')
    .replace(/[-'’.]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 0..1 similarity between a wanted name and a candidate: full match 1, every
 * wanted token present 0.9, last-name match 0.75, otherwise share of tokens.
 */
export function scoreTsfNameMatch(wanted: string, candidate: string): number {
  const a = normalizeTsfName(wanted);
  const b = normalizeTsfName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wantedTokens = a.split(' ');
  const candidateTokens = new Set(b.split(' '));
  const hits = wantedTokens.filter((token) => candidateTokens.has(token)).length;
  if (hits === wantedTokens.length) return 0.9;
  const lastWanted = wantedTokens[wantedTokens.length - 1];
  if (lastWanted && lastWanted.length >= 3 && candidateTokens.has(lastWanted)) return 0.75;
  return hits / Math.max(wantedTokens.length, candidateTokens.size);
}
