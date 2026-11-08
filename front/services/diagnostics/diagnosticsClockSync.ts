/**
 * Device-to-server clock offset from upload round trips (NTP-style).
 *
 *   t0 client send (wall)   t1 server receive   t2 server send   t3 client receive (wall)
 *   offset = ((t1 - t0) + (t2 - t3)) / 2     uncertainty = ±RTT / 2
 *
 * t3 is derived from t0 plus the monotonic elapsed time, so a wall-clock
 * adjustment during the request cannot corrupt the RTT. Server time for a
 * device timestamp is `deviceWall + offsetMs`, never exact: callers must carry
 * `uncertaintyMs` with every cross-clock number.
 */

export interface OffsetSample {
  t0: number;
  t1: number;
  t2: number;
  t3: number;
  offsetMs: number;
  rttMs: number;
  atMono: number;
}

export interface OffsetEstimate {
  offsetMs: number;
  uncertaintyMs: number;
  samples: number;
}

export function computeOffsetSample(input: {
  t0Wall: number;
  t0Mono: number;
  t3Mono: number;
  serverRecvAt: number;
  serverSendAt: number;
}): OffsetSample | null {
  const { t0Wall, t0Mono, t3Mono, serverRecvAt, serverSendAt } = input;
  if (![t0Wall, t0Mono, t3Mono, serverRecvAt, serverSendAt].every(Number.isFinite)) return null;
  const elapsed = t3Mono - t0Mono;
  const serverHold = serverSendAt - serverRecvAt;
  if (elapsed < 0 || serverHold < 0 || serverHold > elapsed + 1) return null;
  const t3 = t0Wall + elapsed;
  return {
    t0: t0Wall,
    t1: serverRecvAt,
    t2: serverSendAt,
    t3,
    offsetMs: (serverRecvAt - t0Wall + (serverSendAt - t3)) / 2,
    rttMs: Math.max(0, elapsed - serverHold),
    atMono: t3Mono,
  };
}

const MAX_SAMPLES = 8;
/** Wall minus monotonic moving by more than this means the device clock was changed. */
export const WALL_JUMP_THRESHOLD_MS = 1000;

export class ClockOffsetEstimator {
  private samples: OffsetSample[] = [];
  private wallMinusMono: number | null = null;

  add(sample: OffsetSample): void {
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  /** The lowest-RTT sample has the tightest bound. */
  best(): OffsetEstimate | null {
    if (this.samples.length === 0) return null;
    let best = this.samples[0];
    for (const sample of this.samples) if (sample.rttMs < best.rttMs) best = sample;
    return { offsetMs: best.offsetMs, uncertaintyMs: best.rttMs / 2, samples: this.samples.length };
  }

  /**
   * Returns the size of a wall-clock jump since the previous observation, or
   * null. Offsets measured before a jump no longer apply, so they are dropped.
   */
  observeWall(wall: number, mono: number): number | null {
    const current = wall - mono;
    const previous = this.wallMinusMono;
    this.wallMinusMono = current;
    if (previous === null) return null;
    const jump = current - previous;
    if (Math.abs(jump) < WALL_JUMP_THRESHOLD_MS) return null;
    this.samples = [];
    return jump;
  }

  reset(): void {
    this.samples = [];
    this.wallMinusMono = null;
  }
}

/**
 * Converts a device wall time to server time and reports a cross-clock
 * difference with its bound. `lowConfidence` when the bound exceeds half the value.
 */
export function crossClockDelta(
  serverTime: number,
  deviceWall: number,
  estimate: OffsetEstimate | null,
): { deltaMs: number; uncertaintyMs: number; lowConfidence: boolean } | null {
  if (!estimate || !Number.isFinite(serverTime) || !Number.isFinite(deviceWall)) return null;
  const deltaMs = deviceWall + estimate.offsetMs - serverTime;
  return {
    deltaMs,
    uncertaintyMs: estimate.uncertaintyMs,
    lowConfidence: estimate.uncertaintyMs > Math.abs(deltaMs) / 2,
  };
}
