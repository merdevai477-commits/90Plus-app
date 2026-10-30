import {
  isExactPredictionCorrect,
  isWinnerPredictionCorrect,
  resetSettlementGateCounters,
  resolveSettlementInput,
  settlementGateCounters,
} from '../prediction-settlement-gate';

beforeEach(() => {
  resetSettlementGateCounters();
});

describe('resolveSettlementInput', () => {
  it('rejects status outside FT/AET/PEN', () => {
    const r = resolveSettlementInput({ status: '2H', homeScore: 1, awayScore: 0 });
    expect(r).toEqual({ ok: false, reason: 'STATUS_NOT_SETTLEABLE' });
    expect(settlementGateCounters.rejectedStatus).toBe(1);
  });

  it.each(['PST', 'CANC', 'ABD', 'NS', 'LIVE', 'HT'])('rejects %s', (status) => {
    expect(resolveSettlementInput({ status, homeScore: 0, awayScore: 0 }).ok).toBe(false);
  });

  it('rejects null / NaN / negative scores (no ?? 0)', () => {
    expect(resolveSettlementInput({ status: 'FT', homeScore: null, awayScore: 1 })).toEqual({
      ok: false,
      reason: 'SCORE_INVALID',
    });
    expect(resolveSettlementInput({ status: 'FT', homeScore: -1, awayScore: 0 })).toEqual({
      ok: false,
      reason: 'SCORE_INVALID',
    });
    expect(resolveSettlementInput({ status: 'FT', homeScore: Number.NaN, awayScore: 0 })).toEqual({
      ok: false,
      reason: 'SCORE_INVALID',
    });
  });

  it('accepts FT and derives winner from goals', () => {
    const r = resolveSettlementInput({ status: 'FT', homeScore: 2, awayScore: 1 });
    expect(r).toMatchObject({
      ok: true,
      status: 'FT',
      winner: 'home',
      homeScore: 2,
      awayScore: 1,
      exactHomeScore: 2,
      exactAwayScore: 1,
    });
  });

  it('AET: winner from goals after extra time', () => {
    const r = resolveSettlementInput({ status: 'AET', homeScore: 3, awayScore: 3 });
    expect(r).toMatchObject({ ok: true, status: 'AET', winner: 'draw' });
    const awayWin = resolveSettlementInput({ status: 'AET', homeScore: 2, awayScore: 3 });
    expect(awayWin).toMatchObject({ ok: true, winner: 'away' });
  });

  it('PEN 1-1 with away winning shootout → winner away', () => {
    const r = resolveSettlementInput({
      status: 'PEN',
      homeScore: 1,
      awayScore: 1,
      penaltyHome: 3,
      penaltyAway: 4,
    });
    expect(r).toMatchObject({
      ok: true,
      status: 'PEN',
      winner: 'away',
      homeScore: 1,
      awayScore: 1,
      exactHomeScore: 1,
      exactAwayScore: 1,
    });
  });

  it('PEN without shootout tallies → PEN_WINNER_UNKNOWN (pending)', () => {
    const r = resolveSettlementInput({
      status: 'PEN',
      homeScore: 1,
      awayScore: 1,
      penaltyHome: null,
      penaltyAway: null,
    });
    expect(r).toEqual({ ok: false, reason: 'PEN_WINNER_UNKNOWN' });
    expect(settlementGateCounters.penWinnerUnknown).toBe(1);
  });

  it.each(['FT', 'AET'])('%s carrying a shootout tally → STATUS_SCORE_CONFLICT (A8)', (status) => {
    expect(
      resolveSettlementInput({ status, homeScore: 1, awayScore: 1, penaltyHome: 4, penaltyAway: 3 }),
    ).toEqual({ ok: false, reason: 'STATUS_SCORE_CONFLICT' });
  });

  it('FT with empty penalty pair still settles', () => {
    expect(
      resolveSettlementInput({ status: 'FT', homeScore: 1, awayScore: 0, penaltyHome: null, penaltyAway: null }).ok,
    ).toBe(true);
  });

  it('PEN with tied shootout tallies → PEN_WINNER_UNKNOWN', () => {
    expect(
      resolveSettlementInput({
        status: 'PEN',
        homeScore: 0,
        awayScore: 0,
        penaltyHome: 5,
        penaltyAway: 5,
      }),
    ).toEqual({ ok: false, reason: 'PEN_WINNER_UNKNOWN' });
  });
});

describe('winner / exact grading', () => {
  it('PEN: away pick correct, home wrong, draw wrong (product decision)', () => {
    expect(isWinnerPredictionCorrect('away', 'away', 'PEN')).toBe(true);
    expect(isWinnerPredictionCorrect('home', 'away', 'PEN')).toBe(false);
    expect(isWinnerPredictionCorrect('draw', 'away', 'PEN')).toBe(false);
  });

  it('exact-score uses goals line, not pen tallies (unchanged rule)', () => {
    // PEN 1-1 (3-4 pens): exact 1-1 is correct; exact 3-4 is wrong.
    expect(isExactPredictionCorrect(1, 1, 1, 1)).toBe(true);
    expect(isExactPredictionCorrect(3, 4, 1, 1)).toBe(false);
  });

  it('AET exact compares against post-ET goals', () => {
    expect(isExactPredictionCorrect(2, 1, 2, 1)).toBe(true);
    expect(isExactPredictionCorrect(1, 1, 2, 1)).toBe(false);
  });
});
