/**
 * Lease lock (A5) + heartbeat (A6) — SQL is exercised for real in
 * settle-lease.db.test.ts; this covers ownership / fail-closed handling.
 */

const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  },
}));

import { acquireSettleLock, startLeaseHeartbeat } from '../prediction-settle-lock';

beforeEach(() => jest.clearAllMocks());

describe('acquireSettleLock', () => {
  it('grants when the insert returns our owner token', async () => {
    mockQueryRaw.mockImplementation(async (_s: unknown, ...values: unknown[]) => [{ owner: values[1] }]);
    const r = await acquireSettleLock(7);
    expect(r.ok).toBe(true);
  });

  it('live lease held elsewhere (no row returned) → SETTLE_SKIPPED_LOCKED', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await expect(acquireSettleLock(7)).resolves.toMatchObject({ ok: false, reason: 'SETTLE_SKIPPED_LOCKED' });
  });

  it('DB error → fail closed SETTLE_SKIPPED_NO_LOCK', async () => {
    mockQueryRaw.mockRejectedValue(new Error('relation "settle_leases" does not exist'));
    await expect(acquireSettleLock(7)).resolves.toMatchObject({ ok: false, reason: 'SETTLE_SKIPPED_NO_LOCK' });
  });

  it('extend reports lost when another owner took over', async () => {
    mockQueryRaw.mockImplementationOnce(async (_s: unknown, ...values: unknown[]) => [{ owner: values[1] }]);
    const r = await acquireSettleLock(8);
    if (!r.ok) throw new Error('expected lock');
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(r.handle.extend()).resolves.toBe(false);
  });
});

describe('startLeaseHeartbeat', () => {
  it('beats on the interval and latches lost', async () => {
    jest.useFakeTimers();
    const extend = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const hb = startLeaseHeartbeat({ kind: 'lease', owner: 'o', extend, release: jest.fn() }, 1_000);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(hb.isLost()).toBe(false);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(hb.isLost()).toBe(true);
    await expect(hb.beat()).resolves.toBe(false);
    expect(extend).toHaveBeenCalledTimes(2);
    hb.stop();
    jest.useRealTimers();
  });
});
