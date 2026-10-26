/**
 * King of Coaches prices from real season numbers. Output (goals, assists,
 * expected stats, defensive work) is ranked inside each line, mixed with the
 * 365 rating and the club's table position, then scaled so the best player of
 * a line sits on that line's ceiling. Prices are tenths of a million.
 */

import type { CkLine, CkPriceKind } from './coach-king-scoring';

export const CK_PRICE_BANDS: Record<CkPriceKind, readonly [number, number]> = {
  FWD: [45, 200],
  MID: [45, 180],
  DEF: [40, 120],
  GK: [40, 100],
  COACH: [30, 120],
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

export function ckPriceFromScore(kind: CkPriceKind, score: number): number {
  const [lo, hi] = CK_PRICE_BANDS[kind];
  return Math.round(lo + (hi - lo) * Math.pow(clamp01(score), 1.4));
}

/** Price every player of the pool in one pass so lines rank against themselves. */
export function ckPricePool(inputs: CkPriceInput[]): Map<number, number> {
  const prices = new Map<number, number>();
  const lines: CkLine[] = ['FWD', 'MID', 'DEF', 'GK'];
  for (const line of lines) {
    const group = inputs.filter((input) => input.line === line);
    if (group.length === 0) continue;
    const output = percentiles(group.map((input) => ckOutput(line, input.stats)));
    const raw = group.map((input, index) =>
      0.4 * output[index]! +
      0.3 * ratingScore(input.stats.rating) +
      0.2 * clamp01(input.clubTier) +
      0.1 * (input.star ? 1 : 0),
    );
    const best = Math.max(...raw);
    group.forEach((input, index) => {
      prices.set(input.key, ckPriceFromScore(line, best > 0 ? raw[index]! / best : 0));
    });
  }
  return prices;
}

export function ckCoachPrice(clubTier: number): number {
  return ckPriceFromScore('COACH', clamp01(clubTier));
}

/** 1 for first place, 0 for last; mid-table when the table is unknown. */
export function ckClubTier(position: number | null | undefined, teams: number): number {
  if (position == null || !Number.isFinite(position) || teams <= 1) return 0.5;
  return clamp01(1 - (position - 1) / (teams - 1));
}
