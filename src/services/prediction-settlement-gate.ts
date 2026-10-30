/**
 * Single settlement gate for King predictions (winner + exact).
 *
 * Rules (P0):
 * - Settle only when status ∈ {FT, AET, PEN}.
 * - Scores must be finite numbers ≥ 0 (null / NaN / <0 / 365's -1 → reject).
 * - AET: winner from goals after extra time.
 * - PEN: winner from penalty shootout tallies only. A winner-mode `draw`
 *   pick on a PEN match is WRONG (there is always a shootout winner).
 * - Exact-score mode (unchanged): compares predictedHome/Away to the
 *   regulation goals line (`goals.home/away`) — FT = 90', AET = after ET,
 *   PEN = score before shootout (API-Football / 365 goals), NOT pen tallies.
 */

export const SETTLEMENT_STATUSES = ['FT', 'AET', 'PEN'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];
export type SettlementWinner = 'home' | 'draw' | 'away';

export type SettlementFixtureInput = {
  status: string | null | undefined;
  /** Regulation / ET goals (API-Football `goals` or cache homeScore/awayScore). */
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
  /** Shootout tallies when status is PEN. */
  penaltyHome?: number | null | undefined;
  penaltyAway?: number | null | undefined;
};

export type SettlementOk = {
  ok: true;
  status: SettlementStatus;
  homeScore: number;
  awayScore: number;
  winner: SettlementWinner;
  /** Line used for exact-score grading (same as home/away goals — never pens). */
  exactHomeScore: number;
  exactAwayScore: number;
};

export type SettlementFail = {
  ok: false;
  reason:
    | 'STATUS_NOT_SETTLEABLE'
    | 'SCORE_INVALID'
    | 'PEN_WINNER_UNKNOWN'
    | 'PEN_SCORE_INVALID'
    | 'STATUS_SCORE_CONFLICT';
};

export type SettlementResult = SettlementOk | SettlementFail;

/** Module counter for Railway / ops visibility (process-local). */
export const settlementGateCounters = {
  rejectedStatus: 0,
  rejectedScore: 0,
  penWinnerUnknown: 0,
  accepted: 0,
};

export function resetSettlementGateCounters(): void {
  settlementGateCounters.rejectedStatus = 0;
  settlementGateCounters.rejectedScore = 0;
  settlementGateCounters.penWinnerUnknown = 0;
  settlementGateCounters.accepted = 0;
}

export function isSettlementStatus(status: string | null | undefined): status is SettlementStatus {
  return status === 'FT' || status === 'AET' || status === 'PEN';
}

export function isValidNonNegativeScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function winnerFromScores(home: number, away: number): SettlementWinner {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/**
 * Pure gate: every settle path must pass its fixture snapshot through this
 * before touching Prediction rows.
 */
export function resolveSettlementInput(fixture: SettlementFixtureInput): SettlementResult {
  const statusRaw = String(fixture.status ?? '').trim().toUpperCase();
  if (!isSettlementStatus(statusRaw)) {
    settlementGateCounters.rejectedStatus += 1;
    return { ok: false, reason: 'STATUS_NOT_SETTLEABLE' };
  }

  if (!isValidNonNegativeScore(fixture.homeScore) || !isValidNonNegativeScore(fixture.awayScore)) {
    settlementGateCounters.rejectedScore += 1;
    return { ok: false, reason: 'SCORE_INVALID' };
  }

  const homeScore = fixture.homeScore;
  const awayScore = fixture.awayScore;

  if (statusRaw === 'PEN') {
    if (
      !isValidNonNegativeScore(fixture.penaltyHome) ||
      !isValidNonNegativeScore(fixture.penaltyAway)
    ) {
      settlementGateCounters.penWinnerUnknown += 1;
      return { ok: false, reason: 'PEN_WINNER_UNKNOWN' };
    }
    if (fixture.penaltyHome === fixture.penaltyAway) {
      // A completed shootout cannot be a draw; treat as unknown upstream data.
      settlementGateCounters.penWinnerUnknown += 1;
      return { ok: false, reason: 'PEN_WINNER_UNKNOWN' };
    }
    const winner = winnerFromScores(fixture.penaltyHome, fixture.penaltyAway);
    settlementGateCounters.accepted += 1;
    return {
      ok: true,
      status: 'PEN',
      homeScore,
      awayScore,
      winner,
      exactHomeScore: homeScore,
      exactAwayScore: awayScore,
    };
  }

  // FT / AET carrying a shootout tally contradict each other — the provider is
  // mid-update; wait rather than settle a PEN match on goals (A8).
  if (isValidNonNegativeScore(fixture.penaltyHome) && isValidNonNegativeScore(fixture.penaltyAway)) {
    settlementGateCounters.rejectedStatus += 1;
    return { ok: false, reason: 'STATUS_SCORE_CONFLICT' };
  }

  // FT / AET — winner and exact line both from goals.
  settlementGateCounters.accepted += 1;
  return {
    ok: true,
    status: statusRaw,
    homeScore,
    awayScore,
    winner: winnerFromScores(homeScore, awayScore),
    exactHomeScore: homeScore,
    exactAwayScore: awayScore,
  };
}

/**
 * Winner-mode correctness. PEN draw picks are always wrong once a shootout
 * winner is known (product decision P0).
 */
export function isWinnerPredictionCorrect(
  predictionType: string,
  winner: SettlementWinner,
  status: SettlementStatus,
): boolean {
  if (status === 'PEN' && predictionType === 'draw') return false;
  return predictionType === winner;
}

/**
 * Exact-score correctness against the goals line (not pen tallies).
 * Documented above — unchanged from pre-P0 resolver behaviour.
 */
export function isExactPredictionCorrect(
  predictedHome: number,
  predictedAway: number,
  exactHome: number,
  exactAway: number,
): boolean {
  return predictedHome === exactHome && predictedAway === exactAway;
}

export function extractPenaltyFromFullData(
  fullData: unknown,
): { home: number | null; away: number | null } {
  const score = (fullData as { score?: { penalty?: { home?: unknown; away?: unknown } } } | null)
    ?.score?.penalty;
  const home = score?.home;
  const away = score?.away;
  return {
    home: isValidNonNegativeScore(home) ? home : null,
    away: isValidNonNegativeScore(away) ? away : null,
  };
}

export function snapshotFromApiFootballFixture(match: {
  fixture?: { status?: { short?: string } };
  goals?: { home?: number | null; away?: number | null };
  score?: { penalty?: { home?: number | null; away?: number | null } };
}): SettlementFixtureInput {
  return {
    status: match.fixture?.status?.short ?? null,
    homeScore: match.goals?.home ?? null,
    awayScore: match.goals?.away ?? null,
    penaltyHome: match.score?.penalty?.home ?? null,
    penaltyAway: match.score?.penalty?.away ?? null,
  };
}
