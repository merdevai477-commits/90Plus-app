/**
 * King of Coaches prices from real season numbers. Output (goals, assists,
 * expected stats, defensive work) is ranked inside each line, mixed with the
 * 365 rating and the club's table position, then snapped to the public tiers:
 * 5M / 8M / 13M. Prices are tenths of a million.
 */

import type { CkLine, CkPriceKind } from './coach-king-scoring';

/** 13M. The best player of a line sits on this cap; that player is the super. */
export const CK_PLAYER_CAP_MILLI = 130;

/** Budget floor shared with head coaches. */
export const CK_PLAYER_FLOOR_MILLI = 50;

/** Mid tier — solid starters between the floor and the ceiling. */
export const CK_PLAYER_MID_MILLI = 80;

/** Public player price ladder: 5M / 8M / 13M. */
export const CK_PRICE_TIERS_MILLI = [
  CK_PLAYER_FLOOR_MILLI,
  CK_PLAYER_MID_MILLI,
  CK_PLAYER_CAP_MILLI,
] as const;

/** Every head coach costs 5M, independent of table position. */
export const CK_COACH_PRICE_MILLI = CK_PLAYER_FLOOR_MILLI;

export const CK_PRICE_BANDS: Record<CkPriceKind, readonly [number, number]> = {
  FWD: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  MID: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  DEF: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  GK: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  COACH: [CK_COACH_PRICE_MILLI, CK_COACH_PRICE_MILLI],
};

export type CkSeasonStats = {
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  rating: number | null;
  cleanSheets: number;
  saves: number;
  tackles: number;
  interceptions: number;
};

export const CK_EMPTY_STATS: CkSeasonStats = {
  goals: 0,
  assists: 0,
  xg: 0,
  xa: 0,
  rating: null,
  cleanSheets: 0,
  saves: 0,
  tackles: 0,
  interceptions: 0,
};

export type CkPriceInput = {
  key: number;
  line: CkLine;
  stats: CkSeasonStats;
  /** 1 for the league leader, 0 for the bottom side. */
  clubTier: number;
  star: boolean;
};

const STAT_TYPE: Record<number, keyof CkSeasonStats> = {
  1: 'goals',
  2: 'assists',
  42: 'xg',
  44: 'xa',
  36: 'rating',
  12: 'cleanSheets',
  67: 'saves',
  38: 'tackles',
  63: 'interceptions',
};

export function ckStatKey(typeId: number | null | undefined): keyof CkSeasonStats | null {
  return typeId != null ? STAT_TYPE[typeId] ?? null : null;
}

export function ckParseStatValue(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const match = String(raw ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function ckOutput(line: CkLine, s: CkSeasonStats): number {
  const defence = s.tackles + s.interceptions;
  if (line === 'FWD') return s.goals + s.assists * 0.6 + s.xg * 0.5 + s.xa * 0.3;
  if (line === 'MID') return s.goals * 0.8 + s.assists * 0.8 + s.xa * 0.5 + s.xg * 0.3 + defence * 0.5;
  if (line === 'DEF') return s.goals * 0.6 + s.assists * 0.6 + s.cleanSheets * 0.6 + defence;
  return s.cleanSheets + s.saves * 0.5;
}

function ratingScore(rating: number | null): number {
  return rating == null ? 0 : clamp01((rating - 6.2) / 1.6);
}

function percentiles(values: number[]): number[] {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (positive.length === 0) return values.map(() => 0);
  return values.map((value) => {
    if (value <= 0) return 0;
    let below = 0;
    while (below < positive.length && positive[below]! < value) below += 1;
    return positive.length === 1 ? 1 : below / (positive.length - 1);
  });
}

/**
 * Map a 0–1 line score onto 5 / 8 / 13 (kept for tests / callers that score one pick).
 * Pool pricing uses rank bands inside each line instead.
 */
export function ckPriceFromScore(kind: CkPriceKind, score: number): number {
  if (kind === 'COACH') return CK_COACH_PRICE_MILLI;
  const t = clamp01(score);
  if (t >= 0.7) return CK_PLAYER_CAP_MILLI;
  if (t >= 0.32) return CK_PLAYER_MID_MILLI;
  return CK_PLAYER_FLOOR_MILLI;
}

/**
 * Price every player of the pool in one pass so lines rank against themselves.
 * Season output (goals/assists/defence) dominates — no empty-stat fringe player
 * can sit above Haaland/Mbappé on club tier alone.
 */
export function ckPricePool(inputs: CkPriceInput[]): Map<number, number> {
  const prices = new Map<number, number>();
  const lines: CkLine[] = ['FWD', 'MID', 'DEF', 'GK'];
  for (const line of lines) {
    const group = inputs.filter((input) => input.line === line);
    if (group.length === 0) continue;
    const rawOutput = group.map((input) => ckOutput(line, input.stats));
    const outputPct = percentiles(rawOutput);
    const ranked = group
      .map((input, index) => ({
        key: input.key,
        star: input.star,
        clubTier: clamp01(input.clubTier),
        output: rawOutput[index]!,
        outputPct: outputPct[index]!,
        score:
          0.62 * outputPct[index]! +
          0.2 * ratingScore(input.stats.rating) +
          0.1 * clamp01(input.clubTier) +
          0.08 * (input.star ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || b.output - a.output || a.key - b.key);

    const eliteSlots = Math.max(1, Math.round(group.length * 0.02));
    const midSlots = Math.max(eliteSlots, Math.round(group.length * 0.2));
    let elites = 0;
    let mids = 0;

    ranked.forEach((row) => {
      // Curated big-club stars (Haaland, Mbappé, …) always sit on the ceiling.
      if (row.star && row.clubTier >= 0.8) {
        prices.set(row.key, CK_PLAYER_CAP_MILLI);
        return;
      }
      // Other 13M spots: real producers from respectable clubs only.
      if (
        elites < eliteSlots
        && row.output > 0
        && row.outputPct >= 0.85
        && row.clubTier >= 0.45
      ) {
        elites += 1;
        prices.set(row.key, CK_PLAYER_CAP_MILLI);
        return;
      }
      // 8M for solid output, curated stars, or strong rating/club mix.
      if (
        row.star
        || (mids < midSlots && (row.output > 0 || row.score >= 0.45))
      ) {
        mids += 1;
        prices.set(row.key, CK_PLAYER_MID_MILLI);
        return;
      }
      prices.set(row.key, CK_PLAYER_FLOOR_MILLI);
    });
  }
  return prices;
}

export function ckCoachPrice(_clubTier?: number): number {
  return CK_COACH_PRICE_MILLI;
}

/** 1 for first place, 0 for last; mid-table when the table is unknown. */
export function ckClubTier(position: number | null | undefined, teams: number): number {
  if (position == null || !Number.isFinite(position) || teams <= 1) return 0.5;
  return clamp01(1 - (position - 1) / (teams - 1));
}
