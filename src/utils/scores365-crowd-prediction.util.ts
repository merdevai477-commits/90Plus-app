/**
 * Pure extractors for 365Scores community "Who Will Win?" percentages.
 */

export interface Scores365CrowdPrediction {
  homePercent: number;
  drawPercent: number;
  awayPercent: number;
  totalVotes: number;
}

type CrowdVoteOption = {
  num?: number;
  name?: string;
  vote?: { count?: number; percentage?: number };
};

type CrowdPromotedPrediction = {
  id?: number;
  type?: number;
  title?: string;
  totalVotes?: number;
  options?: CrowdVoteOption[];
};

export type CrowdGameShape = {
  id?: number;
  promotedPredictions?: { predictions?: CrowdPromotedPrediction[] };
};

/** 365 community votes: option 1=home, 2=draw, 3=away (365 side order). */
export function extractScores365CrowdWinPrediction(
  game: CrowdGameShape | null | undefined,
  options?: { swapped?: boolean },
): Scores365CrowdPrediction | null {
  const predictions = game?.promotedPredictions?.predictions;
  if (!Array.isArray(predictions) || predictions.length === 0) return null;

  const www =
    predictions.find((p) => p?.type === 1) ??
    predictions.find((p) => /who will win/i.test(String(p?.title ?? '')));
  if (!www?.options?.length) return null;

  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;
  for (const opt of www.options) {
    const pct = opt?.vote?.percentage;
    if (typeof pct !== 'number' || !Number.isFinite(pct)) continue;
    if (opt.num === 1) home = Math.round(pct);
    else if (opt.num === 2) draw = Math.round(pct);
    else if (opt.num === 3) away = Math.round(pct);
  }
  if (home == null || draw == null || away == null) return null;

  if (options?.swapped) {
    const tmp = home;
    home = away;
    away = tmp;
  }

  return {
    homePercent: home,
    drawPercent: draw,
    awayPercent: away,
    totalVotes: typeof www.totalVotes === 'number' ? www.totalVotes : 0,
  };
}
