import type {
  Competitor365Squad,
  Competitor365Stats,
  Squad365Player,
  SquadPositionGroup,
  Stat365Leaderboard,
  Stat365LeaderRow,
} from '../services/apiFootball';
import { scores365CompetitionIdFromLeagueId, WC_LEAGUE_ID } from '../constants/worldCup';

export type MatchTopPlayersTab = 'attack' | 'midfield' | 'defense';

export type MatchTopPlayer = {
  athleteId: number;
  name: string;
  photo: string | null;
  goals: number;
  assists: number;
  /** null = 365 has no rating for this player in this competition. */
  rating: number | null;
};

const GOALS_TYPE_ID = 1;
const ASSISTS_TYPE_ID = 2;
const RATING_TYPE_ID = 36;

const GOALS_NAME_RE = /goal|scorer|هدف|هداف/;
const ASSISTS_NAME_RE = /assist|صناع|تمرير/;
const RATING_NAME_RE = /rating|تقييم/;
/** Combined / expected boards whose names also contain "goals" or "assists". */
const DERIVED_NAME_RE = /expected|متوقع|\+|\band\b| و|penalt|ركل/;

export function match365CompetitionId(leagueId: number | undefined | null): number | null {
  if (leagueId == null || leagueId <= 0) return null;
  const fromOffset = scores365CompetitionIdFromLeagueId(leagueId);
  if (fromOffset && fromOffset > 0) return fromOffset;
  if (leagueId === WC_LEAGUE_ID) return WC_LEAGUE_ID;
  return null;
}

export function parseLeaderValue(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatTopPlayerStat(value: number | null, kind: 'int' | 'rating'): string {
  if (kind === 'rating') {
    if (value == null || value <= 0) return '–';
    return (Math.round(value * 10) / 10).toFixed(1);
  }
  if (value == null || value <= 0) return '0';
  return String(Math.round(value));
}

export function classifyMatchPlayerPosition(
  position: string | null | undefined,
): SquadPositionGroup {
  const s = (position ?? '').toLowerCase();
  if (!s.trim()) return 'other';
  if (/gk|goal\s*keep|حارس|keeper/.test(s)) return 'goalkeeper';
  if (
    /\bcb\b|\blb\b|\brb\b|\blwb\b|\brwb\b|\bwb\b|defender|centre back|center back|left back|right back|wing back|مدافع/.test(
      s,
    )
  ) {
    return 'defender';
  }
  if (/\bdm\b|\bcm\b|\bam\b|\bcdm\b|\bcam\b|\blm\b|\brm\b|midfield|وسط/.test(s)) {
    return 'midfielder';
  }
  if (/\bst\b|\bcf\b|\bss\b|\blw\b|\brw\b|\bfw\b|forward|striker|winger|attacker|مهاجم|wing/.test(s)) {
    return 'forward';
  }
  return 'other';
}

/**
 * Board `key` is positional (in a cup with no scorers, key 1 can be "Red Cards"),
 * so match on the 365 stat `typeId`. Payloads cached before `typeId` existed
 * fall back to the board name.
 */
function findBoard(
  boards: Stat365Leaderboard[],
  typeId: number,
  nameRe: RegExp,
): Stat365Leaderboard | null {
  const byType = boards.find((board) => board.typeId === typeId);
  if (byType) return byType;
  if (boards.some((board) => board.typeId != null)) return null;
  return (
    boards.find((board) => {
      const name = (board.name ?? '').toLowerCase();
      return nameRe.test(name) && !DERIVED_NAME_RE.test(name);
    }) ?? null
  );
}

function ownRows(board: Stat365Leaderboard | null, competitorId: number): Stat365LeaderRow[] {
  if (!board) return [];
  const own = board.rows.filter(
    (row) => row.athleteId > 0 && (!row.leftClub || row.competitorId === competitorId),
  );
  return own.length > 0 ? own : board.rows.filter((row) => row.athleteId > 0);
}

function valueByAthlete(board: Stat365Leaderboard | null, competitorId: number): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of ownRows(board, competitorId)) {
    if (!map.has(row.athleteId)) map.set(row.athleteId, parseLeaderValue(row.value));
  }
  return map;
}

function tabGroup(tab: MatchTopPlayersTab): SquadPositionGroup {
  if (tab === 'attack') return 'forward';
  if (tab === 'midfield') return 'midfielder';
  return 'defender';
}

function playerPosition(
  athleteId: number,
  rowPositionName: string | null | undefined,
  squadById: Map<number, Squad365Player>,
): SquadPositionGroup {
  const fromRow = classifyMatchPlayerPosition(rowPositionName);
  if (fromRow !== 'other') return fromRow;
  return squadById.get(athleteId)?.positionGroup ?? 'other';
}

function scorePlayer(player: MatchTopPlayer, tab: MatchTopPlayersTab): number {
  const rating = player.rating ?? 0;
  if (tab === 'attack') return player.goals * 1000 + player.assists * 10 + rating;
  if (tab === 'midfield') return player.assists * 1000 + player.goals * 10 + rating;
  return rating * 100 + player.goals + player.assists;
}

export function pickMatchTopPlayer(
  stats: Competitor365Stats | null | undefined,
  squad: Competitor365Squad | null | undefined,
  competitorId: number,
  tab: MatchTopPlayersTab,
): MatchTopPlayer | null {
  if (!competitorId) return null;
  const boards = stats?.leaderboards ?? [];
  const goalsBoard = findBoard(boards, GOALS_TYPE_ID, GOALS_NAME_RE);
  const assistsBoard = findBoard(boards, ASSISTS_TYPE_ID, ASSISTS_NAME_RE);
  const ratingBoard = findBoard(boards, RATING_TYPE_ID, RATING_NAME_RE);
  const goalsById = valueByAthlete(goalsBoard, competitorId);
  const assistsById = valueByAthlete(assistsBoard, competitorId);
  const ratingById = valueByAthlete(ratingBoard, competitorId);

  const squadById = new Map<number, Squad365Player>();
  for (const player of squad?.players ?? []) {
    if (player.athleteId > 0) squadById.set(player.athleteId, player);
  }

  const wanted = tabGroup(tab);
  const byId = new Map<number, MatchTopPlayer>();
  const hasSquad = squadById.size > 0;
  const primary =
    tab === 'attack' ? goalsBoard : tab === 'midfield' ? assistsBoard : ratingBoard ?? goalsBoard;

  const toPlayer = (
    athleteId: number,
    name: string,
    photo: string | null,
    existing?: MatchTopPlayer,
  ): MatchTopPlayer => ({
    athleteId,
    name: name || existing?.name || '—',
    photo: photo ?? existing?.photo ?? null,
    goals: goalsById.get(athleteId) ?? existing?.goals ?? 0,
    assists: assistsById.get(athleteId) ?? existing?.assists ?? 0,
    rating: (ratingById.get(athleteId) || null) ?? existing?.rating ?? null,
  });

  for (const player of squad?.groups[wanted] ?? []) {
    if (player.athleteId <= 0) continue;
    byId.set(player.athleteId, toPlayer(player.athleteId, player.name, player.photo));
  }

  for (const board of boards) {
    const isPrimary = board === primary;
    for (const row of ownRows(board, competitorId)) {
      const group = playerPosition(row.athleteId, row.positionName, squadById);
      const allowUnclassified = isPrimary && group === 'other' && !hasSquad;
      if (group !== wanted && !allowUnclassified) continue;
      byId.set(row.athleteId, toPlayer(row.athleteId, row.name, row.photo, byId.get(row.athleteId)));
    }
  }

  let ranked = [...byId.values()].sort((a, b) => scorePlayer(b, tab) - scorePlayer(a, tab));
  if (ranked.length === 0 && !hasSquad) {
    ranked = ownRows(primary, competitorId).map((row) =>
      toPlayer(row.athleteId, row.name, row.photo),
    );
  }

  return ranked[0] ?? null;
}
