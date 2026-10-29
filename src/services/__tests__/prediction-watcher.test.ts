/**
 * PredictionWatcherService — schema gating and tick window (U1).
 */

const mockSchemaOk = jest.fn();

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../football.service', () => ({ footballService: { fetchFromApi: jest.fn() } }));
jest.mock('../prediction-resolver.service', () => ({
  PredictionResolverService: { resolveMatchPredictions: jest.fn() },
}));
jest.mock('../competition-resolver.service', () => ({ CompetitionResolverService: {} }));
jest.mock('../notify.service', () => ({ notifyUser: jest.fn() }));
jest.mock('../notification.service', () => ({ NotificationType: {} }));
jest.mock('../schema-guard.service', () => ({ isSchemaOk: () => mockSchemaOk() }));

import { PredictionWatcherService } from '../prediction-watcher.service';

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
