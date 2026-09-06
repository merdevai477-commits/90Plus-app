/**
 * Last-N form averages for the pre-kickoff Statistics tab.
 * Score metrics come from 365 recent games; shot/xG/corners come from
 * `/web/game/stats` when those payloads exist.
 */

import {
  extractCompetitorNumericStats,
  type Scores365TeamStatsPayload,
} from './scores365-team-stats';

export const RECENT_FORM_AVERAGES_LAST_DEFAULT = 4;

export type RecentFormGame = {
  id?: number;
  statusGroup?: number;
  homeCompetitor?: { id?: number; score?: number };
  awayCompetitor?: { id?: number; score?: number };
};

export type RecentFormTrend = {
  count: number;
  pct: number;
};

export type RecentFormAverages = {
  goalsFor: number | null;
  goalsAgainst: number | null;
  xg: number | null;
  xga: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  cards: number | null;
  penaltiesScored: number | null;
  penaltiesWon: number | null;
};

export type RecentFormAveragesSide = {
  teamId: number | null;
  teamName: string;
  games: number;
  averages: RecentFormAverages;
  trends: {
    wins: RecentFormTrend;
    btts: RecentFormTrend;
    over25: RecentFormTrend;
    winOrDraw: RecentFormTrend;
    cleanSheets: RecentFormTrend;
  };
};

export type RecentFormAveragesPayload = {
  last: number;
  home: RecentFormAveragesSide;
  away: RecentFormAveragesSide;
  statsGames: number;
  statsComplete: boolean;
};

export function isFinishedRecentFormGame(game: RecentFormGame | null | undefined): boolean {
  if (!game) return false;
  if (game.statusGroup === 4) return true;
  const home = game.homeCompetitor?.score;
  const away = game.awayCompetitor?.score;
  return home != null && away != null && home >= 0 && away >= 0;
}

export function pickLastFinishedGames(
  games: RecentFormGame[] | null | undefined,
  limit = RECENT_FORM_AVERAGES_LAST_DEFAULT,
): RecentFormGame[] {
  const cap = Math.max(1, Math.min(8, limit));
  return (games ?? []).filter(isFinishedRecentFormGame).slice(0, cap);
}

export function scoreSideForCompetitor(
  game: RecentFormGame,
  competitorId: number,
): { gf: number; ga: number } | null {
  if (!competitorId) return null;
  const homeId = game.homeCompetitor?.id;
  const awayId = game.awayCompetitor?.id;
  const hg = game.homeCompetitor?.score;
  const ag = game.awayCompetitor?.score;
  if (hg == null || ag == null) return null;
  if (homeId === competitorId) return { gf: hg, ga: ag };
  if (awayId === competitorId) return { gf: ag, ga: hg };
  return null;
}

export function averageFinite(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function trend(count: number, played: number): RecentFormTrend {
  return {
    count,
    pct: played > 0 ? Math.round((count / played) * 100) : 0,
  };
}

function emptySide(teamId: number | null, teamName: string): RecentFormAveragesSide {
  return {
    teamId,
    teamName,
    games: 0,
    averages: {
      goalsFor: null,
      goalsAgainst: null,
      xg: null,
      xga: null,
      shots: null,
      shotsOnTarget: null,
      corners: null,
      cards: null,
      penaltiesScored: null,
      penaltiesWon: null,
    },
    trends: {
      wins: trend(0, 0),
      btts: trend(0, 0),
      over25: trend(0, 0),
      winOrDraw: trend(0, 0),
      cleanSheets: trend(0, 0),
    },
  };
}

function cardsFromStats(stats: ReturnType<typeof extractCompetitorNumericStats>): number | null {
  if (stats.yellowCards == null && stats.redCards == null) return null;
  return (stats.yellowCards ?? 0) + (stats.redCards ?? 0);
}

export function buildRecentFormSide(
  games: RecentFormGame[] | null | undefined,
  competitorId: number,
  teamName: string,
  statsByGame: Map<number, Scores365TeamStatsPayload | null | undefined>,
  last = RECENT_FORM_AVERAGES_LAST_DEFAULT,
): RecentFormAveragesSide {
  const side = emptySide(competitorId || null, teamName);
  if (!competitorId) return side;

  const window = pickLastFinishedGames(games, last);
  let played = 0;
  let wins = 0;
  let btts = 0;
  let over25 = 0;
  let winOrDraw = 0;
  let cleanSheets = 0;
  const gf: number[] = [];
  const ga: number[] = [];
  const xg: number[] = [];
  const xga: number[] = [];
  const shots: number[] = [];
  const shotsOn: number[] = [];
  const corners: number[] = [];
  const cards: number[] = [];
  const pensScored: number[] = [];
  const pensWon: number[] = [];

  for (const game of window) {
    const score = scoreSideForCompetitor(game, competitorId);
    if (!score) continue;
    played += 1;
    gf.push(score.gf);
    ga.push(score.ga);
    if (score.gf > score.ga) wins += 1;
    if (score.gf >= score.ga) winOrDraw += 1;
    if (score.gf > 0 && score.ga > 0) btts += 1;
    if (score.gf + score.ga > 2.5) over25 += 1;
    if (score.ga === 0) cleanSheets += 1;

    const gameId = typeof game.id === 'number' ? game.id : 0;
    const payload = gameId ? statsByGame.get(gameId) : undefined;
    if (!payload) continue;

    const mine = extractCompetitorNumericStats(payload, competitorId);
    const oppId =
      game.homeCompetitor?.id === competitorId
        ? game.awayCompetitor?.id
        : game.homeCompetitor?.id;
    const opp =
      typeof oppId === 'number' && oppId > 0
        ? extractCompetitorNumericStats(payload, oppId)
        : null;

    if (mine.shots != null) shots.push(mine.shots);
    if (mine.shotsOnTarget != null) shotsOn.push(mine.shotsOnTarget);
    if (mine.corners != null) corners.push(mine.corners);
    const cardTotal = cardsFromStats(mine);
    if (cardTotal != null) cards.push(cardTotal);
    if (mine.xg != null) xg.push(mine.xg);
    if (mine.xga != null) xga.push(mine.xga);
    else if (opp?.xg != null) xga.push(opp.xg);
    if (mine.penaltiesScored != null) pensScored.push(mine.penaltiesScored);
    if (mine.penaltiesWon != null) pensWon.push(mine.penaltiesWon);
  }

  if (played === 0) return side;

  return {
    teamId: competitorId,
    teamName,
    games: played,
    averages: {
      goalsFor: averageFinite(gf),
      goalsAgainst: averageFinite(ga),
      xg: averageFinite(xg),
      xga: averageFinite(xga),
      shots: averageFinite(shots),
      shotsOnTarget: averageFinite(shotsOn),
      corners: averageFinite(corners),
      cards: averageFinite(cards),
      penaltiesScored: averageFinite(pensScored),
      penaltiesWon: averageFinite(pensWon),
    },
    trends: {
      wins: trend(wins, played),
      btts: trend(btts, played),
      over25: trend(over25, played),
      winOrDraw: trend(winOrDraw, played),
      cleanSheets: trend(cleanSheets, played),
    },
  };
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
}

export function uniqueRecentGameIds(
  homeGames: RecentFormGame[],
  awayGames: RecentFormGame[],
  max = 8,
): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const game of [...homeGames, ...awayGames]) {
    const id = game.id;
    if (typeof id !== 'number' || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}
