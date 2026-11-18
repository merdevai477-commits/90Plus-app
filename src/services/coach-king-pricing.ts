/**
 * King of Coaches prices from real season numbers. Output (goals, assists,
 * expected stats, defensive work) is ranked inside each line, mixed with the
 * 365 rating and the club's table position, then snapped to the public tiers.
 *
 * Players: 0.5M / 1M / 3M / 5M / 8M / 13M (cap).
 * Coaches: 0.5M / 1M / 3M / 5M (cap) from club table tier.
 * Prices are tenths of a million (5 = 0.5M).
 */

import type { CkLine, CkPriceKind } from './coach-king-scoring';

/** 13M — best players of a line. */
export const CK_PLAYER_CAP_MILLI = 130;

/** 0.5M — cheapest fringe / rotation options. */
export const CK_PLAYER_FLOOR_MILLI = 5;

/** 1M — budget depth. */
export const CK_PLAYER_BUDGET_MILLI = 10;

/** 3M — squad regulars. */
export const CK_PLAYER_LOW_MILLI = 30;

/** 5M — solid starters. */
export const CK_PLAYER_STANDARD_MILLI = 50;

/** 8M — strong producers. */
export const CK_PLAYER_MID_MILLI = 80;

/** Public player price ladder: 0.5 / 1 / 3 / 5 / 8 / 13. */
export const CK_PRICE_TIERS_MILLI = [
  CK_PLAYER_FLOOR_MILLI,
  CK_PLAYER_BUDGET_MILLI,
  CK_PLAYER_LOW_MILLI,
  CK_PLAYER_STANDARD_MILLI,
  CK_PLAYER_MID_MILLI,
  CK_PLAYER_CAP_MILLI,
] as const;

/** 0.5M coach floor. */
export const CK_COACH_FLOOR_MILLI = 5;

/** 1M coach mid-cheap. */
export const CK_COACH_BUDGET_MILLI = 10;

/** 3M coach mid. */
export const CK_COACH_MID_MILLI = 30;

/** 5M coach ceiling. */
export const CK_COACH_CAP_MILLI = 50;

/** @deprecated Prefer CK_COACH_CAP_MILLI — kept for older imports. */
export const CK_COACH_PRICE_MILLI = CK_COACH_CAP_MILLI;

export const CK_COACH_TIERS_MILLI = [
  CK_COACH_FLOOR_MILLI,
  CK_COACH_BUDGET_MILLI,
  CK_COACH_MID_MILLI,
  CK_COACH_CAP_MILLI,
] as const;

export const CK_PRICE_BANDS: Record<CkPriceKind, readonly [number, number]> = {
  FWD: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  MID: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  DEF: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  GK: [CK_PLAYER_FLOOR_MILLI, CK_PLAYER_CAP_MILLI],
  COACH: [CK_COACH_FLOOR_MILLI, CK_COACH_CAP_MILLI],
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
 * Map a 0–1 score onto the player ladder (or coach ladder for COACH).
 */
export function ckPriceFromScore(kind: CkPriceKind, score: number): number {
  if (kind === 'COACH') return ckCoachPrice(clamp01(score));
  const t = clamp01(score);
  if (t >= 0.88) return CK_PLAYER_CAP_MILLI;
  if (t >= 0.7) return CK_PLAYER_MID_MILLI;
  if (t >= 0.5) return CK_PLAYER_STANDARD_MILLI;
  if (t >= 0.32) return CK_PLAYER_LOW_MILLI;
  if (t >= 0.16) return CK_PLAYER_BUDGET_MILLI;
  return CK_PLAYER_FLOOR_MILLI;
}

/**
 * Price every player of the pool in one pass so lines rank against themselves.
 * Season output dominates — fringe no-names stay on 0.5M / 1M.
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

    const n = group.length;
    const eliteSlots = Math.max(1, Math.round(n * 0.02));
    const midSlots = Math.max(eliteSlots, Math.round(n * 0.12));
    const standardSlots = Math.max(midSlots, Math.round(n * 0.28));
    const lowSlots = Math.max(standardSlots, Math.round(n * 0.48));
    const budgetSlots = Math.max(lowSlots, Math.round(n * 0.72));
    let elites = 0;
    let mids = 0;
    let standards = 0;
    let lows = 0;
    let budgets = 0;

    ranked.forEach((row) => {
      // Curated big-club stars always sit on the 13M ceiling.
      if (row.star && row.clubTier >= 0.8) {
        prices.set(row.key, CK_PLAYER_CAP_MILLI);
        return;
      }
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
      if (row.star || (mids < midSlots && (row.output > 0 || row.score >= 0.55))) {
        mids += 1;
        prices.set(row.key, CK_PLAYER_MID_MILLI);
        return;
      }
      if (standards < standardSlots && (row.output > 0 || row.score >= 0.4)) {
        standards += 1;
        prices.set(row.key, CK_PLAYER_STANDARD_MILLI);
        return;
      }
      if (lows < lowSlots && (row.output > 0 || row.score >= 0.25)) {
        lows += 1;
        prices.set(row.key, CK_PLAYER_LOW_MILLI);
        return;
      }
      if (budgets < budgetSlots) {
        budgets += 1;
        prices.set(row.key, CK_PLAYER_BUDGET_MILLI);
        return;
      }
      prices.set(row.key, CK_PLAYER_FLOOR_MILLI);
    });
  }
  return prices;
}

/**
 * Coach price from club table tier: top sides → 5M, mid → 1–3M, bottom → 0.5M.
 */
export function ckCoachPrice(clubTier?: number): number {
  const t = clamp01(clubTier ?? 0.5);
  if (t >= 0.75) return CK_COACH_CAP_MILLI;
  if (t >= 0.45) return CK_COACH_MID_MILLI;
  if (t >= 0.2) return CK_COACH_BUDGET_MILLI;
  return CK_COACH_FLOOR_MILLI;
}

/** 1 for first place, 0 for last; mid-table when the table is unknown. */
export function ckClubTier(position: number | null | undefined, teams: number): number {
  if (position == null || !Number.isFinite(position) || teams <= 1) return 0.5;
  return clamp01(1 - (position - 1) / (teams - 1));
}
