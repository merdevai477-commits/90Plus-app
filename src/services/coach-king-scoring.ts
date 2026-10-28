/**
 * King of Coaches — pure rules: prices, squad checks, and match points.
 * No I/O, so the budget and the scoring table stay unit-testable.
 */

export const CK_START_BALANCE_MILLI = 1000;
export const CK_POINT_CASH_MILLI = 1;

export type CkLine = 'GK' | 'DEF' | 'MID' | 'FWD';
export type CkPriceKind = CkLine | 'COACH';

export const COACH_KING_SLOTS = [
  { key: 'lw', line: 'FWD', label: 'LW' },
  { key: 'st', line: 'FWD', label: 'ST' },
  { key: 'rw', line: 'FWD', label: 'RW' },
  { key: 'cm1', line: 'MID', label: 'CM' },
  { key: 'cm2', line: 'MID', label: 'CM' },
  { key: 'cm3', line: 'MID', label: 'CM' },
  { key: 'lb', line: 'DEF', label: 'LB' },
  { key: 'cb1', line: 'DEF', label: 'CB' },
  { key: 'cb2', line: 'DEF', label: 'CB' },
  { key: 'rb', line: 'DEF', label: 'RB' },
  { key: 'gk', line: 'GK', label: 'GK' },
] as const;

export type CkSlotKey = (typeof COACH_KING_SLOTS)[number]['key'];

/**
 * Positions that may fill each pitch slot. Strikers are stored as CF or ST
 * (SS stays with the 9 so a second striker is still pickable). The three
 * midfield slots share the whole midfield, because the pitch does not split them.
 */
export const CK_SLOT_POSITIONS: Record<CkSlotKey, readonly string[]> = {
  lw: ['LW'],
  st: ['CF', 'ST', 'SS'],
  rw: ['RW'],
  cm1: ['CM', 'AM', 'DM'],
  cm2: ['CM', 'AM', 'DM'],
  cm3: ['CM', 'AM', 'DM'],
  lb: ['LB'],
  cb1: ['CB'],
  cb2: ['CB'],
  rb: ['RB'],
  gk: ['GK'],
};

/** At most this many players from one club in a lineup. */
export const CK_CLUB_LIMIT = 3;

export function coachKingSlot(slotKey: string) {
  return COACH_KING_SLOTS.find((slot) => slot.key === slotKey) ?? null;
}

export function coachKingSlotAccepts(slotKey: string, position: string | null | undefined): boolean {
  const slot = coachKingSlot(slotKey);
  if (!slot) return false;
  const code = (position ?? '').trim().toUpperCase();
  return CK_SLOT_POSITIONS[slot.key].includes(code);
}

export function formatCoachKingMoney(milli: number): string {
  const millions = milli / 10;
  const rounded = Math.round(millions * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}M`;
}

export function coachKingRemainingMilli(balanceMilli: number, spentMilli: number): number {
  return balanceMilli - spentMilli;
}

/** Squad price is never deducted. A finished week only adds 0.1M per point. */
export function coachKingNextBalanceMilli(balanceMilli: number, points: number): number {
  return balanceMilli + points * CK_POINT_CASH_MILLI;
}

export type CkSquadIssue =
  | 'INCOMPLETE'
  | 'DUPLICATE_PLAYER'
  | 'BAD_SLOT'
  | 'WRONG_LINE'
  | 'BUDGET'
  | 'CLUB_LIMIT'
  | 'MISSING_COACH'
  | 'MATCH_STARTED';

export type CkDraftSlot = {
  slotKey: string;
  playerId: string;
  line: CkLine;
  teamId: number;
  priceMilli: number;
};

export function inspectCoachKingSquad(input: {
  slots: CkDraftSlot[];
  coachPriceMilli: number | null;
  coachTeamId: number | null;
  balanceMilli: number;
  startedTeamIds: ReadonlySet<number>;
  /** Draft saves may be short of 11. Confirm requires the full XI and a coach. */
  requireComplete: boolean;
}): { ok: true; spentMilli: number } | { ok: false; code: CkSquadIssue } {
  if (input.requireComplete && (input.coachPriceMilli == null || input.coachTeamId == null)) {
    return { ok: false, code: 'MISSING_COACH' };
  }
  if (input.requireComplete && input.slots.length !== COACH_KING_SLOTS.length) {
    return { ok: false, code: 'INCOMPLETE' };
  }

  const seenSlots = new Set<string>();
  const seenPlayers = new Set<string>();
  const perClub = new Map<number, number>();
  let spent = input.coachPriceMilli ?? 0;

  for (const slot of input.slots) {
    const spec = coachKingSlot(slot.slotKey);
    if (!spec || seenSlots.has(slot.slotKey)) return { ok: false, code: 'BAD_SLOT' };
    seenSlots.add(slot.slotKey);
    if (slot.line !== spec.line) return { ok: false, code: 'WRONG_LINE' };
    if (seenPlayers.has(slot.playerId)) return { ok: false, code: 'DUPLICATE_PLAYER' };
    seenPlayers.add(slot.playerId);
    const fromClub = (perClub.get(slot.teamId) ?? 0) + 1;
    if (fromClub > CK_CLUB_LIMIT) return { ok: false, code: 'CLUB_LIMIT' };
    perClub.set(slot.teamId, fromClub);
    if (input.startedTeamIds.has(slot.teamId)) return { ok: false, code: 'MATCH_STARTED' };
    spent += slot.priceMilli;
  }

  if (input.requireComplete && seenSlots.size !== COACH_KING_SLOTS.length) {
    return { ok: false, code: 'INCOMPLETE' };
  }
  if (input.coachTeamId != null && input.startedTeamIds.has(input.coachTeamId)) {
    return { ok: false, code: 'MATCH_STARTED' };
  }
  if (spent > input.balanceMilli) return { ok: false, code: 'BUDGET' };
  return { ok: true, spentMilli: spent };
}

export type CkStatLine = {
  minutes: number;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
  ownGoals: number;
  teamConceded: number | null;
};

export function computeCoachKingPoints(line: CkLine, stats: CkStatLine): { points: number; cleanSheet: boolean } {
  const cleanSheet = (line === 'DEF' || line === 'GK') && stats.minutes >= 60 && stats.teamConceded === 0;
  const goalValue = line === 'FWD' ? 4 : line === 'MID' ? 5 : 6;
  let points = 0;
  if (stats.minutes > 0) points += 1;
  if (stats.minutes >= 60) points += 1;
  points += stats.goals * goalValue;
  points += stats.assists * 3;
  if (cleanSheet) points += 4;
  points -= stats.yellows;
  points -= stats.reds * 3;
  points -= stats.ownGoals * 2;
  return { points, cleanSheet };
}

export type CkMatchResult = 'WIN' | 'DRAW' | 'LOSS';

export function coachKingResultPoints(result: CkMatchResult): number {
  if (result === 'WIN') return 3;
  if (result === 'DRAW') return 1;
  return 0;
}

export function coachKingMatchResult(teamGoals: number, conceded: number): CkMatchResult {
  if (teamGoals > conceded) return 'WIN';
  if (teamGoals === conceded) return 'DRAW';
  return 'LOSS';
}

type CkEvent = {
  playerId?: number | null;
  extraPlayers?: number[] | null;
  eventType?: { id?: number | null; subTypeName?: string | null } | null;
};

type CkMember = {
  id: number;
  athleteId?: number | null;
  stats?: Array<{ type?: number | null; value?: string | number | null }> | null;
};

type CkLineupMember = { id: number; status?: number | null; stats?: CkMember['stats'] };

export type CkScorableGame = {
  members?: CkMember[] | null;
  events?: CkEvent[] | null;
  homeCompetitor?: { id?: number; score?: number | null; lineups?: { members?: CkLineupMember[] | null } | null } | null;
  awayCompetitor?: { id?: number; score?: number | null; lineups?: { members?: CkLineupMember[] | null } | null } | null;
};

const GOAL = 1;
const YELLOW = 2;
const RED = 3;
const MINUTES_STAT = 30;
const STARTER = new Set([0, 1]);

function readMinutes(stats: CkMember['stats']): number | null {
  for (const row of stats ?? []) {
    if (row?.type !== MINUTES_STAT) continue;
    const match = String(row.value ?? '').match(/\d+/);
    if (match) return Number(match[0]) || 0;
  }
  return null;
}

function blank(): CkStatLine {
  return { minutes: 0, goals: 0, assists: 0, yellows: 0, reds: 0, ownGoals: 0, teamConceded: null };
}

/**
 * Per-athlete line from one 365 game. Own goals are not goals. Missing minutes
 * fall back to 90 for a starter and 1 for a substitute who actually came on.
 */
export function extractCoachKingStats(game: CkScorableGame): Map<number, CkStatLine> {
  const athleteByMember = new Map<number, number>();
  for (const member of game.members ?? []) {
    if (member.athleteId != null && member.athleteId > 0) athleteByMember.set(member.id, member.athleteId);
  }

  const sideOfMember = new Map<number, 'home' | 'away'>();
  const minutesOfMember = new Map<number, number | null>();
  const roleOfMember = new Map<number, 'STARTED' | 'BENCH' | 'OTHER'>();

  const takeSide = (side: 'home' | 'away', members: CkLineupMember[] | null | undefined) => {
    for (const member of members ?? []) {
      sideOfMember.set(member.id, side);
      const mins = readMinutes(member.stats);
      if (mins != null) minutesOfMember.set(member.id, mins);
      const status = member.status ?? -1;
      if (STARTER.has(status)) roleOfMember.set(member.id, 'STARTED');
      else if (status === 2) roleOfMember.set(member.id, 'BENCH');
      else roleOfMember.set(member.id, 'OTHER');
    }
  };
  takeSide('home', game.homeCompetitor?.lineups?.members);
  takeSide('away', game.awayCompetitor?.lineups?.members);

  for (const member of game.members ?? []) {
    if (minutesOfMember.has(member.id)) continue;
    const mins = readMinutes(member.stats);
    if (mins != null) minutesOfMember.set(member.id, mins);
  }

  const involved = new Set<number>();
  const stats = new Map<number, CkStatLine>();
  const lineFor = (athleteId: number) => {
    const current = stats.get(athleteId);
    if (current) return current;
    const created = blank();
    stats.set(athleteId, created);
    return created;
  };

  for (const event of game.events ?? []) {
    const typeId = event.eventType?.id ?? null;
    const ownGoal = typeId === GOAL && /own\s*goal/i.test(event.eventType?.subTypeName ?? '');
    const memberIds = [event.playerId, ...(event.extraPlayers ?? [])].filter((id): id is number => id != null);
    if (typeId === 4 || typeId === 1000) {
      for (const id of memberIds) involved.add(id);
    }

    const athlete = event.playerId != null ? athleteByMember.get(event.playerId) : undefined;
    if (athlete == null) continue;
    const line = lineFor(athlete);
    if (typeId === GOAL && ownGoal) line.ownGoals += 1;
    else if (typeId === GOAL) line.goals += 1;
    else if (typeId === YELLOW) line.yellows += 1;
    else if (typeId === RED) line.reds += 1;

    if (typeId === GOAL && !ownGoal) {
      const assistMember = event.extraPlayers?.[0];
      const assister = assistMember != null ? athleteByMember.get(assistMember) : undefined;
      if (assister != null && assister !== athlete) lineFor(assister).assists += 1;
    }
  }

  const homeScore = game.homeCompetitor?.score;
  const awayScore = game.awayCompetitor?.score;
  const concededFor = (side: 'home' | 'away'): number | null => {
    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') return null;
    return side === 'home' ? awayScore : homeScore;
  };

  const seen = new Set<number>();
  for (const [memberId, athleteId] of athleteByMember) {
    if (seen.has(athleteId)) continue;
    const role = roleOfMember.get(memberId);
    const cameOn = role === 'BENCH' && involved.has(memberId);
    if (role !== 'STARTED' && !cameOn && !stats.has(athleteId)) continue;
    seen.add(athleteId);
    const line = lineFor(athleteId);
    const parsed = minutesOfMember.get(memberId);
    if (parsed != null) line.minutes = parsed;
    else if (role === 'STARTED') line.minutes = 90;
    else if (cameOn) line.minutes = 1;
    const side = sideOfMember.get(memberId);
    line.teamConceded = side ? concededFor(side) : null;
  }

  return stats;
}
