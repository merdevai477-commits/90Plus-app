/**
 * PredictionWatcherService — schema gating, tick window (U1), resolved flag (A11).
 */

const mockSchemaOk = jest.fn();
const mockResolve = jest.fn();
const mockLoad = jest.fn();
const mockResolveCompetitions = jest.fn();
const mockCancelCompetitions = jest.fn();

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../prediction-resolver.service', () => ({
  PredictionResolverService: {
    resolveMatchPredictions: (...a: unknown[]) => mockResolve(...a),
    beginShutdown: jest.fn(),
    drain: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../prediction-settlement-snapshot', () => ({
  loadAuthoritativeSettlementFixture: (...a: unknown[]) => mockLoad(...a),
}));
jest.mock('../competition-resolver.service', () => ({
  CompetitionResolverService: {
    resolveMatchCompetitions: (...a: unknown[]) => mockResolveCompetitions(...a),
    cancelForAbandonedMatch: (...a: unknown[]) => mockCancelCompetitions(...a),
  },
}));
jest.mock('../notify.service', () => ({ notifyUser: jest.fn() }));
jest.mock('../notification.service', () => ({ NotificationType: {} }));
jest.mock('../schema-guard.service', () => ({ isSchemaOk: () => mockSchemaOk() }));

import { PredictionWatcherService } from '../prediction-watcher.service';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  PredictionWatcherService.stop();
  delete process.env.PREDICTION_SETTLE_MAX_MATCHES_PER_TICK;
});

describe('PredictionWatcherService.start', () => {
  it('does not start when schema mismatch (U1)', () => {
    mockSchemaOk.mockReturnValue(false);
    const check = jest.spyOn(PredictionWatcherService, 'checkPredictions').mockResolvedValue();
    PredictionWatcherService.start();
    expect(check).not.toHaveBeenCalled();
    expect((PredictionWatcherService as any).intervalId).toBeNull();
    check.mockRestore();
  });

  it('starts when schema ok', () => {
    mockSchemaOk.mockReturnValue(true);
    const check = jest.spyOn(PredictionWatcherService, 'checkPredictions').mockResolvedValue();
    PredictionWatcherService.start();
    expect(check).toHaveBeenCalledTimes(1);
    check.mockRestore();
  });
});

describe('PredictionWatcherService.nextTickWindow', () => {
  it('returns all ids when under the cap', () => {
    expect(PredictionWatcherService.nextTickWindow([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('per-tick cap rotates so stuck matches cannot starve the rest (U1 backlog)', () => {
    process.env.PREDICTION_SETTLE_MAX_MATCHES_PER_TICK = '2';
    const ids = [1, 2, 3, 4, 5];
    const seen = new Set<number>();
    for (let i = 0; i < 3; i += 1) {
      const w = PredictionWatcherService.nextTickWindow(ids);
      expect(w).toHaveLength(2);
      w.forEach((id) => seen.add(id));
    }
    expect([...seen].sort()).toEqual(ids);
  });
});

describe('checkAndResolveMatch resolved flag (A11)', () => {
  const ft = { status: 'FT', homeScore: 2, awayScore: 1 };

  it.each([
    ['gate rejected', { outcome: 'SETTLE_GATE_REJECTED', settled: 0, staleOnly: false }],
    ['lock held', { outcome: 'SETTLE_SKIPPED_LOCKED', settled: 0, staleOnly: false }],
    ['already settled', { outcome: 'SETTLE_COMPLETE', settled: 0, staleOnly: false }],
    ['lock lost', { outcome: 'SETTLE_LOCK_LOST', settled: 3, staleOnly: false }],
  ])('%s → resolved=false', async (_label, settle) => {
    mockLoad.mockResolvedValue(ft);
    mockResolve.mockResolvedValue(settle);
    await expect(PredictionWatcherService.checkAndResolveMatch(1)).resolves.toEqual({
      resolved: false,
      staleOnly: false,
    });
  });

  it('settled rows → resolved=true and passes the prefetched snapshot (E7)', async () => {
    mockLoad.mockResolvedValue(ft);
    mockResolve.mockResolvedValue({ outcome: 'SETTLE_COMPLETE', settled: 2, staleOnly: true });
    await expect(PredictionWatcherService.checkAndResolveMatch(2)).resolves.toEqual({
      resolved: true,
      staleOnly: true,
    });
    const opts = mockResolve.mock.calls[0][1];
    expect(opts.prefetched.snapshot).toBe(ft);
    expect(Date.now() - opts.prefetched.fetchedAt).toBeLessThan(5_000);
    expect(mockResolveCompetitions).toHaveBeenCalledWith(2, 2, 1, 'FT');
  });

  it('PEN without scores does not resolve competitions on garbage', async () => {
    mockLoad.mockResolvedValue({ status: 'PEN', homeScore: null, awayScore: null });
    mockResolve.mockResolvedValue({ outcome: 'SETTLE_GATE_REJECTED', settled: 0, staleOnly: false });
    await PredictionWatcherService.checkAndResolveMatch(3);
    expect(mockResolveCompetitions).not.toHaveBeenCalled();
  });

  it('CANC hands the match to the settler (VOID path) and cancels competitions', async () => {
    mockLoad.mockResolvedValue({ status: 'CANC', homeScore: null, awayScore: null });
    mockResolve.mockResolvedValue({ outcome: 'SETTLE_VOIDED', settled: 0, staleOnly: false });
    const r = await PredictionWatcherService.checkAndResolveMatch(4);
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockCancelCompetitions).toHaveBeenCalledWith(4, 'CANC');
    expect(r.resolved).toBe(false);
  });

  it('NS does not take a lease', async () => {
    mockLoad.mockResolvedValue({ status: 'NS', homeScore: null, awayScore: null });
    await PredictionWatcherService.checkAndResolveMatch(5);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
