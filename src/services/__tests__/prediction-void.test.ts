/**
 * VOID behind PREDICTION_VOID_ENABLED (E11 / Q2).
 */

const mockCacheFind = jest.fn();
const mockFindFirst = jest.fn();
const mockCount = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: { findUnique: (...a: unknown[]) => mockCacheFind(...a) },
    prediction: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      count: (...a: unknown[]) => mockCount(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

import { __resetVoidLogForTests, maybeVoidMatchPredictions } from '../prediction-void.service';

const now = new Date('2026-10-31T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

beforeEach(() => {
  jest.clearAllMocks();
  __resetVoidLogForTests();
  delete process.env.PREDICTION_VOID_ENABLED;
  mockCount.mockResolvedValue(3);
  mockUpdateMany.mockResolvedValue({ count: 3 });
});

describe('maybeVoidMatchPredictions', () => {
  it('flag off → dry run only, no writes', async () => {
    mockCacheFind.mockResolvedValue({ matchDate: hoursAgo(72) });
    await expect(maybeVoidMatchPredictions(1, 'CANC', 'w', now)).resolves.toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalledTimes(1);
  });

  it('flag on, past 48h → voids only pending non-voided rows, no refund fields', async () => {
    process.env.PREDICTION_VOID_ENABLED = 'true';
    mockCacheFind.mockResolvedValue({ matchDate: hoursAgo(49) });
    await expect(maybeVoidMatchPredictions(2, 'ABD', 'w', now)).resolves.toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { apiMatchId: 2, isCorrect: null, voidedAt: null },
      data: { voidedAt: now, voidReason: 'ABD' },
    });
  });

  it('flag on, under 48h → nothing', async () => {
    process.env.PREDICTION_VOID_ENABLED = 'true';
    mockCacheFind.mockResolvedValue({ matchDate: hoursAgo(47) });
    await expect(maybeVoidMatchPredictions(3, 'PST', 'w', now)).resolves.toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('rescheduled PST (future kickoff) → nothing', async () => {
    process.env.PREDICTION_VOID_ENABLED = 'true';
    mockCacheFind.mockResolvedValue({ matchDate: new Date(now.getTime() + 86_400_000) });
    await expect(maybeVoidMatchPredictions(4, 'PST', 'w', now)).resolves.toBe(0);
  });

  it.each(['FT', 'NS', 'LIVE', 'PEN', null])('status %s is never voided', async (status) => {
    process.env.PREDICTION_VOID_ENABLED = 'true';
    await expect(maybeVoidMatchPredictions(5, status, 'w', now)).resolves.toBe(0);
    expect(mockCacheFind).not.toHaveBeenCalled();
  });

  it('falls back to the earliest prediction kickoff when the fixture is not cached', async () => {
    process.env.PREDICTION_VOID_ENABLED = 'true';
    mockCacheFind.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({ matchDate: hoursAgo(100) });
    await expect(maybeVoidMatchPredictions(6, 'WO', 'w', now)).resolves.toBe(3);
  });
});
