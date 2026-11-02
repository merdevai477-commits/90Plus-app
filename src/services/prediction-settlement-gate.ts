import { teamNamesLooselyMatch } from '../utils/team-name-match.util';

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
  /** Side that owns `homeScore` / `awayScore`. Missing names keep the legacy home/away compare. */
  homeTeamName?: string | null;
  awayTeamName?: string | null;
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
  /** Same orientation as `homeScore` / `awayScore`. */
  homeTeamName: string | null;
  awayTeamName: string | null;
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
      homeTeamName: fixture.homeTeamName ?? null,
      awayTeamName: fixture.awayTeamName ?? null,
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
    homeTeamName: fixture.homeTeamName ?? null,
    awayTeamName: fixture.awayTeamName ?? null,
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

export type JudgeablePrediction = {
  predictionType: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  /** Teams as the user saw them when they picked. Winner mode is graded against these. */
  homeTeam?: string | null;
  awayTeam?: string | null;
};

export type TeamOrientation = 'aligned' | 'swapped' | 'unknown';

/**
 * Which way the stored pick faces the scoreline.
 * Missing names stay `aligned` (legacy home/away compare) — a blank label is not
 * evidence of a swap. Names that match neither way are `unknown`: the caller
 * keeps the raw home/away compare instead of blocking settlement.
 */
export function winnerTeamOrientation(
  prediction: { homeTeam?: string | null; awayTeam?: string | null },
  fixture: { homeTeamName?: string | null; awayTeamName?: string | null },
): TeamOrientation {
  const predHome = prediction.homeTeam;
  const predAway = prediction.awayTeam;
  const fixHome = fixture.homeTeamName;
  const fixAway = fixture.awayTeamName;
  if (!predHome || !predAway || !fixHome || !fixAway) return 'aligned';

  const direct = teamNamesLooselyMatch(predHome, fixHome) && teamNamesLooselyMatch(predAway, fixAway);
  const swapped = teamNamesLooselyMatch(predHome, fixAway) && teamNamesLooselyMatch(predAway, fixHome);
  if (direct && !swapped) return 'aligned';
  if (swapped && !direct) return 'swapped';
  return 'unknown';
}

/** Flip a home/away winner onto the pick's team order. A draw does not flip. Unknown stays unset. */
export function orientWinner(winner: SettlementWinner, orientation: TeamOrientation): SettlementWinner | null {
  if (orientation === 'unknown') return null;
  if (orientation === 'aligned' || winner === 'draw') return winner;
  return winner === 'home' ? 'away' : 'home';
}

/**
 * A row with a scoreline is a King of Results pick (numbers only).
 * A winner pick is graded on the team the user chose.
 * A positive swap flips home/away. Names that match neither way (Arabic cache
 * vs English pick, or a suffix the matcher does not strip) are not evidence of
 * a swap, so the raw home/away compare stands and the row still settles.
 */
export function judgePrediction(prediction: JudgeablePrediction, settled: SettlementOk): boolean | null {
  if (prediction.predictedHomeScore != null && prediction.predictedAwayScore != null) {
    return isExactPredictionCorrect(
      prediction.predictedHomeScore,
      prediction.predictedAwayScore,
      settled.exactHomeScore,
      settled.exactAwayScore,
    );
  }
  const orientation = winnerTeamOrientation(prediction, settled);
  const winner = orientation === 'swapped' ? orientWinner(settled.winner, orientation) : settled.winner;
  if (winner == null) return null;
  return isWinnerPredictionCorrect(prediction.predictionType, winner, settled.status);
}

export type StoredVerdictBucket = 'wrongToCorrect' | 'correctToWrong' | 'unchanged';

/** Stored verdict vs the gate today; used by admin re-settle and the reconcile script (A7). */
export function classifyStoredVerdict(
  prediction: JudgeablePrediction & { isCorrect: boolean },
  settled: SettlementOk,
): { bucket: StoredVerdictBucket; computed: boolean } {
  const computed = judgePrediction(prediction, settled);
  // Unclear team order: leave the stored verdict. Do not guess a correction.
  if (computed == null) return { bucket: 'unchanged', computed: prediction.isCorrect };
  if (!prediction.isCorrect && computed) return { bucket: 'wrongToCorrect', computed };
  if (prediction.isCorrect && !computed) return { bucket: 'correctToWrong', computed };
  return { bucket: 'unchanged', computed };
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
  teams?: { home?: { name?: string | null }; away?: { name?: string | null } };
}): SettlementFixtureInput {
  return {
    status: match.fixture?.status?.short ?? null,
    homeScore: match.goals?.home ?? null,
    awayScore: match.goals?.away ?? null,
    penaltyHome: match.score?.penalty?.home ?? null,
    penaltyAway: match.score?.penalty?.away ?? null,
    homeTeamName: match.teams?.home?.name ?? null,
    awayTeamName: match.teams?.away?.name ?? null,
  };
}
