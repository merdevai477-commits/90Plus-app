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
  rating: number;
};

const GOALS_NAME_RE = /goal|scorer|هدف/;
const ASSISTS_NAME_RE = /assist|صناع|تمرير/;
const RATING_NAME_RE = /rating|تقييم|mark|note|average/;

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

export function formatTopPlayerStat(value: number, kind: 'int' | 'rating'): string {
  if (kind === 'rating') {
    if (value <= 0) return '0';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  if (value <= 0) return '0';
  return Number.isInteger(value) ? String(value) : String(value);
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

function findBoard(
  boards: Stat365Leaderboard[],
  nameRe: RegExp,
  keys?: number[],
): Stat365Leaderboard | null {
  if (keys?.length) {
    const byKey = boards.find((board) => keys.includes(board.key));
    if (byKey) return byKey;
  }
  return boards.find((board) => nameRe.test((board.name ?? '').toLowerCase())) ?? null;
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
  if (tab === 'attack') return player.goals * 1000 + player.assists * 10 + player.rating;
  if (tab === 'midfield') return player.assists * 1000 + player.goals * 10 + player.rating;
  return player.rating * 100 + player.goals + player.assists;
}

export function pickMatchTopPlayer(
  stats: Competitor365Stats | null | undefined,
  squad: Competitor365Squad | null | undefined,
  competitorId: number,
  tab: MatchTopPlayersTab,
): MatchTopPlayer | null {
  if (!competitorId) return null;
  const boards = stats?.leaderboards ?? [];
  const goalsBoard = findBoard(boards, GOALS_NAME_RE, [1]);
  const assistsBoard = findBoard(boards, ASSISTS_NAME_RE);
  const ratingBoard = findBoard(boards, RATING_NAME_RE);
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
    rating: ratingById.get(athleteId) ?? existing?.rating ?? 0,
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
