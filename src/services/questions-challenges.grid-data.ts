/**
 * FOOTBALL GRID — the board, built entirely from persisted football data.
 * =============================================================================
 *
 * The mode is a 3×3 board: AWARDS across the top, CLUBS / NATIONAL TEAMS down
 * the side. A cell is satisfied by a player who BOTH played for that club (or
 * that national team) AND won that award — the classic football-grid rule,
 * where each half of the pair is an independent, recorded fact.
 *
 * NOTHING HERE IS AUTHORED OR INFERRED. Every value comes out of
 * `cached_365_player_career`, the provider payload the app already stores:
 *
 *   award won        ← data.trophies[].competitionId / .displayName
 *   played for X     ← data.seasons[].competitions[].teamId / .teamName
 *   player portrait  ← cached_365_player_career.photo
 *   row crest        ← the provider's own competitor image, keyed by that
 *                      same teamId (no name matching, so a crest can never
 *                      belong to a different club)
 *
 * A player, a club, a national team or an award that is not in that table
 * simply does not exist for this mode. There is no model in this path at all:
 * the AI cannot invent a player, a trophy or a relationship here because it is
 * never asked for one — see questions-challenges.ai-generator.service.ts.
 *
 * The board is chosen so that ALL NINE cells are genuinely fillable; if the
 * stored data cannot support one, the mode publishes no round that day rather
 * than a board with an unanswerable cell.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import type { QuizLanguage } from '../types/quiz.types';
import { seededRng } from '../utils/seeded-rng';
import { shuffle } from './questions-challenges.football-data';
import { remoteImageUrlOrNull as imageUrlOrNull } from './questions-challenges.round-contract';
import { FOOTBALL_GRID_COLUMNS, FOOTBALL_GRID_ROWS } from '../constants/questions-modes.config';

/** 365Scores language ids for the two languages the app publishes rounds in. */
const LANG_ID: Record<QuizLanguage, number> = { en: 1, ar: 27 };

/**
 * The provider's own crest for a competitor (club or national team), by its
 * competitor id. Same URL shape the rest of the app uses for 365 crests
 * (scores365-experiment.service.ts) — an id that does not exist 404s rather
 * than resolving to some other club's badge.
 */
function competitorCrestUrl(competitorId: number): string {
  return `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v3/Competitors/${competitorId}`;
}

/** 365 labels club rows "Club (Name)" / "نادي (Name)" and countries "منتخب (X)". */
function stripWrapper(raw: string): string {
  return raw
    .replace(/^Club\s*\((.*)\)$/, '$1')
    .replace(/^نادي\s*\((.*)\)$/, '$1')
    .replace(/^National team\s*\((.*)\)$/i, '$1')
    .replace(/^منتخب\s*\((.*)\)$/, '$1')
    .trim();
}

function isNationalTeamLabel(raw: string): boolean {
  return /^National team/i.test(raw) || /^منتخب/.test(raw);
}

/** A season split across clubs ("Man City & Bayern") names no single team. */
function isAmbiguous(raw: string): boolean {
  return raw.includes('&');
}

export interface GridPlayerCandidate {
  /** Dataset id — "player:365:<athleteId>". */
  id: string;
  name: string;
  /** Real 365Scores portrait. Always present. */
  imageUrl: string;
  /** Competitor ids this player actually played for. */
  teamIds: Set<number>;
  /** Competition ids this player actually won. */
  awardIds: Set<number>;
}

export interface GridAxisEntry {
  /** 365 competitor id (rows) or competition id (columns). */
  refId: number;
  label: string;
}

export interface GridBoardCandidate {
  /** Clubs / national teams, top to bottom. */
  rows: Array<GridAxisEntry & { imageUrl: string; kind: 'club' | 'national-team' }>;
  /** Awards, left to right. */
  columns: GridAxisEntry[];
  /** `r{row}-c{col}` → every pooled player who satisfies that cell. */
  cells: Map<string, GridPlayerCandidate[]>;
  /**
   * `r{row}-c{col}` → the player this cell's answer should be, chosen so that
   * as many cells as possible answer to a DIFFERENT player (see
   * {@link assignDistinctAnswers}). Always covers all nine cells.
   */
  answers: Map<string, GridPlayerCandidate>;
  /** The whole pool, for drawing players who do NOT satisfy a cell. */
  players: GridPlayerCandidate[];
}

interface CareerRow {
  athleteId: number;
  name: string;
  photo: string | null;
  data: {
    trophies?: Array<{ name?: string; displayName?: string; competitionId?: number; categoryName?: string }>;
    seasons?: Array<{ competitions?: Array<{ teamId?: number; teamName?: string }> }>;
  } | null;
}

/** How many teams/awards the board search considers, most-covered first. */
const AXIS_SEARCH_WIDTH = 18;
/**
 * A cell is answerable with one valid player, so that is the hard floor and a
 * board with a thinner cell is never published. It is only the floor, though —
 * the search below actively prefers boards well above it, because nine cells
 * that each have exactly one answer is a memory test, not a grid.
 */
const MIN_PLAYERS_PER_CELL = 1;
/** Row triples examined per column triple (rows are ranked before pairing). */
const ROW_CANDIDATE_WIDTH = 8;
/** Stop searching once a board is this good — distinct answers everywhere … */
const IDEAL_MIN_CELL_PLAYERS = 3;

async function loadCareerRows(language: QuizLanguage): Promise<CareerRow[]> {
  /*
   * Rows are language-scoped. Mixing them would put Arabic club names on an
   * English board (365 stores one row per athlete PER LANGUAGE), so a language
   * with too little cached career data publishes no grid rather than a
   * half-translated one.
   */
  return prisma.$queryRawUnsafe<CareerRow[]>(
    `select "athleteId", name, photo, data
       from public.cached_365_player_career
      where "langId" = $1 and photo is not null and photo <> ''`,
    LANG_ID[language],
  );
}

/** One career row → the player's real teams and real awards, or null. */
function toPlayerCandidate(row: CareerRow): GridPlayerCandidate | null {
  const imageUrl = imageUrlOrNull(row.photo);
  if (!imageUrl || !row.name?.trim()) return null;

  const teamIds = new Set<number>();
  for (const season of row.data?.seasons ?? []) {
    for (const competition of season?.competitions ?? []) {
      const teamId = Number(competition?.teamId);
      const teamName = String(competition?.teamName ?? '');
      if (!Number.isFinite(teamId) || teamId <= 0 || !teamName) continue;
      if (isAmbiguous(teamName)) continue;
      teamIds.add(teamId);
    }
  }

  const awardIds = new Set<number>();
  for (const trophy of row.data?.trophies ?? []) {
    const competitionId = Number(trophy?.competitionId);
    if (!Number.isFinite(competitionId) || competitionId <= 0) continue;
    awardIds.add(competitionId);
  }

  if (teamIds.size === 0 || awardIds.size === 0) return null;

  return {
    id: `player:365:${row.athleteId}`,
    name: row.name.trim(),
    imageUrl,
    teamIds,
    awardIds,
  };
}

/** Labels for the ids seen across the pool, taken from the same rows. */
function collectLabels(rows: CareerRow[]): {
  teams: Map<number, { label: string; kind: 'club' | 'national-team' }>;
  awards: Map<number, string>;
} {
  const teams = new Map<number, { label: string; kind: 'club' | 'national-team' }>();
  const awards = new Map<number, string>();

  for (const row of rows) {
    for (const season of row.data?.seasons ?? []) {
      for (const competition of season?.competitions ?? []) {
        const teamId = Number(competition?.teamId);
        const raw = String(competition?.teamName ?? '');
        if (!Number.isFinite(teamId) || teamId <= 0 || !raw || isAmbiguous(raw)) continue;
        const label = stripWrapper(raw);
        if (!label) continue;
        if (!teams.has(teamId)) {
          teams.set(teamId, { label, kind: isNationalTeamLabel(raw) ? 'national-team' : 'club' });
        }
      }
    }
    for (const trophy of row.data?.trophies ?? []) {
      const competitionId = Number(trophy?.competitionId);
      if (!Number.isFinite(competitionId) || competitionId <= 0) continue;
      const label = String(trophy?.displayName ?? trophy?.name ?? '').trim();
      if (!label || awards.has(competitionId)) continue;
      awards.set(competitionId, label);
    }
  }

  return { teams, awards };
}

/**
 * Give each cell a DIFFERENT player where the data allows it.
 *
 * Nine cells drawn from overlapping pools will happily collapse onto one name —
 * a player who won all three awards at one of the three clubs answers a whole
 * row — and picking greedily cell by cell collapses them even when a spread-out
 * assignment exists. This is the bipartite matching (cells ↔ players), solved
 * with augmenting paths: cheap at 9 cells, and it finds the maximum number of
 * distinct answers rather than a locally convenient one.
 *
 * Cells left unmatched (their only candidates are genuinely taken) fall back to
 * a real player who fills them, so every cell always has an answer.
 */
function assignDistinctAnswers(
  cells: Map<string, GridPlayerCandidate[]>,
  order: string[],
): { answers: Map<string, GridPlayerCandidate>; distinct: number } {
  /** playerId → the cell currently answering to them. */
  const takenBy = new Map<string, string>();
  const matched = new Map<string, GridPlayerCandidate>();

  const tryAssign = (cellKey: string, visited: Set<string>): boolean => {
    for (const player of cells.get(cellKey) ?? []) {
      if (visited.has(player.id)) continue;
      visited.add(player.id);
      const holder = takenBy.get(player.id);
      // Free, or its current holder can be re-seated somewhere else.
      if (holder === undefined || tryAssign(holder, visited)) {
        takenBy.set(player.id, cellKey);
        matched.set(cellKey, player);
        return true;
      }
    }
    return false;
  };

  for (const cellKey of order) tryAssign(cellKey, new Set());

  const answers = new Map<string, GridPlayerCandidate>();
  for (const cellKey of order) {
    const player = matched.get(cellKey) ?? cells.get(cellKey)?.[0];
    if (player) answers.set(cellKey, player);
  }
  return { answers, distinct: new Set([...answers.values()].map((p) => p.id)).size };
}

/** Cell keys in reading order — the board's own question order. */
function cellOrder(): string[] {
  const keys: string[] = [];
  for (let row = 0; row < FOOTBALL_GRID_ROWS; row += 1) {
    for (let column = 0; column < FOOTBALL_GRID_COLUMNS; column += 1) {
      keys.push(`r${row}-c${column}`);
    }
  }
  return keys;
}

/** All `size`-sized ascending index combinations of `count` items. */
function* combinations(count: number, size: number): Generator<number[]> {
  const idx = Array.from({ length: size }, (_, i) => i);
  if (count < size) return;
  for (;;) {
    yield [...idx];
    let i = size - 1;
    while (i >= 0 && idx[i] === count - size + i) i -= 1;
    if (i < 0) return;
    idx[i]! += 1;
    for (let j = i + 1; j < size; j += 1) idx[j] = idx[j - 1]! + 1;
  }
}

/**
 * Pick a 3×3 board every cell of which real players can fill.
 *
 * The search is over the best-covered teams and awards (most players first) and
 * is seeded per day/language, so the board rotates but is reproducible.
 *
 * Every board that clears the floor is SCORED rather than accepted on sight:
 * how many of the nine cells can be given a different player, then how deep the
 * thinnest cell is. Taking the first fillable board produced technically-valid
 * grids whose middle row had a single eligible player answering all three of
 * its cells; the same data supports much better boards, they were just further
 * down the search. The floor itself is unchanged — this only decides which of
 * the boards that already pass gets published.
 */
export async function buildFootballGridBoard(
  language: QuizLanguage,
  refreshDateYmd: string,
): Promise<GridBoardCandidate | null> {
  const rows = await loadCareerRows(language);
  const players = rows
    .map(toPlayerCandidate)
    .filter((player): player is GridPlayerCandidate => Boolean(player));

  if (players.length < 12) {
    logger.warn('[QuestionsGrid] not enough career records to build a board', {
      language,
      careerRows: rows.length,
      usablePlayers: players.length,
    });
    return null;
  }

  const { teams, awards } = collectLabels(rows);

  const playersByTeam = new Map<number, GridPlayerCandidate[]>();
  const playersByAward = new Map<number, GridPlayerCandidate[]>();
  for (const player of players) {
    for (const teamId of player.teamIds) {
      if (!playersByTeam.has(teamId)) playersByTeam.set(teamId, []);
      playersByTeam.get(teamId)!.push(player);
    }
    for (const awardId of player.awardIds) {
      if (!playersByAward.has(awardId)) playersByAward.set(awardId, []);
      playersByAward.get(awardId)!.push(player);
    }
  }

  const rng = seededRng(`${refreshDateYmd}:${language}:football-grid`);

  /** Distinct labels only — two rows reading the same name is not a board. */
  const seenTeamLabels = new Set<string>();
  const teamPool = [...playersByTeam.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .filter(([teamId]) => {
      const meta = teams.get(teamId);
      if (!meta) return false;
      const key = meta.label.toLowerCase();
      if (seenTeamLabels.has(key)) return false;
      seenTeamLabels.add(key);
      return true;
    })
    .slice(0, AXIS_SEARCH_WIDTH);

  const seenAwardLabels = new Set<string>();
  const awardPool = [...playersByAward.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .filter(([awardId]) => {
      const label = awards.get(awardId);
      if (!label) return false;
      const key = label.toLowerCase();
      if (seenAwardLabels.has(key)) return false;
      seenAwardLabels.add(key);
      return true;
    })
    .slice(0, AXIS_SEARCH_WIDTH);

  const shuffledTeams = shuffle(teamPool, rng);
  const shuffledAwards = shuffle(awardPool, rng);

  const satisfies = (player: GridPlayerCandidate, teamId: number, awardId: number): boolean =>
    player.teamIds.has(teamId) && player.awardIds.has(awardId);

  /** Every pooled player who fills (team, award). Memoized — the search re-asks. */
  const cellCache = new Map<string, GridPlayerCandidate[]>();
  const cellPlayers = (teamId: number, awardId: number): GridPlayerCandidate[] => {
    const key = `${teamId}:${awardId}`;
    const hit = cellCache.get(key);
    if (hit) return hit;
    const found = (playersByTeam.get(teamId) ?? []).filter((player) =>
      satisfies(player, teamId, awardId),
    );
    cellCache.set(key, found);
    return found;
  };

  const order = cellOrder();
  let best: {
    rowIds: number[];
    columnIds: number[];
    cells: Map<string, GridPlayerCandidate[]>;
    answers: Map<string, GridPlayerCandidate>;
    score: [number, number, number];
  } | null = null;

  /** Higher is better, compared left to right. */
  const beats = (a: [number, number, number], b: [number, number, number]): boolean =>
    a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

  search: for (const [a, b, c] of combinations(shuffledAwards.length, FOOTBALL_GRID_COLUMNS)) {
    const columnIds = [shuffledAwards[a!]![0], shuffledAwards[b!]![0], shuffledAwards[c!]![0]];

    // Teams that can fill ALL THREE awards — the rows a complete board can use.
    // Ranked by their thinnest cell so the strongest rows are paired first.
    const eligible: Array<{ teamId: number; weakest: number }> = [];
    for (const [teamId] of shuffledTeams) {
      let weakest = Infinity;
      for (const awardId of columnIds) {
        weakest = Math.min(weakest, cellPlayers(teamId, awardId).length);
        if (weakest < MIN_PLAYERS_PER_CELL) break;
      }
      if (weakest >= MIN_PLAYERS_PER_CELL) eligible.push({ teamId, weakest });
    }
    if (eligible.length < FOOTBALL_GRID_ROWS) continue;

    eligible.sort((x, y) => y.weakest - x.weakest);
    const shortlist = eligible.slice(0, ROW_CANDIDATE_WIDTH);

    for (const rowIdx of combinations(shortlist.length, FOOTBALL_GRID_ROWS)) {
      const rowIds = rowIdx.map((i) => shortlist[i]!.teamId);

      const cells = new Map<string, GridPlayerCandidate[]>();
      let thinnest = Infinity;
      let total = 0;
      for (let row = 0; row < FOOTBALL_GRID_ROWS; row += 1) {
        for (let column = 0; column < FOOTBALL_GRID_COLUMNS; column += 1) {
          const found = cellPlayers(rowIds[row]!, columnIds[column]!);
          cells.set(`r${row}-c${column}`, found);
          thinnest = Math.min(thinnest, found.length);
          total += found.length;
        }
      }

      const { answers, distinct } = assignDistinctAnswers(cells, order);
      const score: [number, number, number] = [distinct, thinnest, total];
      if (!best || beats(score, best.score)) {
        best = { rowIds, columnIds, cells, answers, score };
      }
      // Nine cells, nine different players, none of them thin — nothing further
      // down the search can beat this, so stop paying for it.
      if (distinct === order.length && thinnest >= IDEAL_MIN_CELL_PLAYERS) break search;
    }
  }

  if (best) {
    logger.info('[QuestionsGrid] board selected', {
      language,
      refreshDateYmd,
      distinctAnswers: best.score[0],
      thinnestCell: best.score[1],
      rows: best.rowIds.map((teamId) => teams.get(teamId)?.label),
      columns: best.columnIds.map((awardId) => awards.get(awardId)),
    });
    return {
      rows: best.rowIds.map((teamId) => {
        const meta = teams.get(teamId)!;
        return {
          refId: teamId,
          label: meta.label,
          kind: meta.kind,
          imageUrl: competitorCrestUrl(teamId),
        };
      }),
      columns: best.columnIds.map((awardId) => ({ refId: awardId, label: awards.get(awardId)! })),
      cells: best.cells,
      answers: best.answers,
      players,
    };
  }

  logger.warn('[QuestionsGrid] no 3x3 board is fully fillable from the stored career data', {
    language,
    usablePlayers: players.length,
    teamsConsidered: teamPool.length,
    awardsConsidered: awardPool.length,
  });
  return null;
}
