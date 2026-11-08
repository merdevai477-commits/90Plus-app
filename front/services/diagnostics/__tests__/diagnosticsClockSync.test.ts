import { ClockOffsetEstimator, computeOffsetSample, crossClockDelta } from '../diagnosticsClockSync';

const T0 = 1_780_000_000_000;

describe('computeOffsetSample', () => {
  it('recovers a known offset with a symmetric path', () => {
    // Server clock is 500 ms ahead; 40 ms each way; server holds 10 ms.
    const sample = computeOffsetSample({
      t0Wall: T0,
      t0Mono: 1000,
      t3Mono: 1090,
      serverRecvAt: T0 + 500 + 40,
      serverSendAt: T0 + 500 + 50,
    });
    expect(sample).not.toBeNull();
    expect(sample!.offsetMs).toBeCloseTo(500, 6);
    expect(sample!.rttMs).toBeCloseTo(80, 6);
    expect(sample!.t3).toBe(T0 + 90);
  });

  it('bounds the error of an asymmetric path by half the RTT', () => {
    // True offset 0; request leg 70 ms, response leg 10 ms.
    const sample = computeOffsetSample({
      t0Wall: T0,
      t0Mono: 0,
      t3Mono: 80,
      serverRecvAt: T0 + 70,
      serverSendAt: T0 + 70,
    })!;
    expect(Math.abs(sample.offsetMs - 0)).toBeLessThanOrEqual(sample.rttMs / 2);
  });

  it('uses monotonic time for t3, so a wall change mid-request cannot skew the RTT', () => {
    const sample = computeOffsetSample({
      t0Wall: T0,
      t0Mono: 5000,
      t3Mono: 5100,
      serverRecvAt: T0 + 50,
      serverSendAt: T0 + 50,
    })!;
    expect(sample.rttMs).toBe(100);
  });

  it('rejects impossible or non-finite input', () => {
    expect(computeOffsetSample({ t0Wall: T0, t0Mono: 10, t3Mono: 5, serverRecvAt: T0, serverSendAt: T0 })).toBeNull();
    expect(computeOffsetSample({ t0Wall: T0, t0Mono: 0, t3Mono: 10, serverRecvAt: T0, serverSendAt: T0 + 50 })).toBeNull();
    expect(computeOffsetSample({ t0Wall: T0, t0Mono: 0, t3Mono: 10, serverRecvAt: NaN, serverSendAt: T0 })).toBeNull();
  });
});

describe('ClockOffsetEstimator', () => {
  it('prefers the lowest-RTT sample and reports ±RTT/2', () => {
    const estimator = new ClockOffsetEstimator();
    estimator.add({ t0: 0, t1: 0, t2: 0, t3: 0, offsetMs: 300, rttMs: 400, atMono: 1 });
    estimator.add({ t0: 0, t1: 0, t2: 0, t3: 0, offsetMs: 120, rttMs: 60, atMono: 2 });
    estimator.add({ t0: 0, t1: 0, t2: 0, t3: 0, offsetMs: 200, rttMs: 250, atMono: 3 });
    expect(estimator.best()).toEqual({ offsetMs: 120, uncertaintyMs: 30, samples: 3 });
  });

  it('detects a wall-clock jump and drops samples taken before it', () => {
    const estimator = new ClockOffsetEstimator();
    estimator.add({ t0: 0, t1: 0, t2: 0, t3: 0, offsetMs: 10, rttMs: 20, atMono: 1 });
    expect(estimator.observeWall(T0, 1000)).toBeNull();
    expect(estimator.observeWall(T0 + 5000, 6000)).toBeNull();
    expect(estimator.observeWall(T0 + 5000 + 3_600_000, 7000)).toBe(3_600_000 - 1000);
    expect(estimator.best()).toBeNull();
  });
});

describe('crossClockDelta', () => {
  it('flags low confidence when the bound is large relative to the value', () => {
    expect(crossClockDelta(T0, T0 - 100, { offsetMs: 120, uncertaintyMs: 30, samples: 2 })).toEqual({
      deltaMs: 20,
      uncertaintyMs: 30,
      lowConfidence: true,
    });
    expect(crossClockDelta(T0, T0 + 2000, { offsetMs: 0, uncertaintyMs: 30, samples: 2 })).toEqual({
      deltaMs: 2000,
      uncertaintyMs: 30,
      lowConfidence: false,
    });
    expect(crossClockDelta(T0, T0, null)).toBeNull();
  });
});
