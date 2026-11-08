import { DIAG_LIMITS, type DiagEventType, type DiagPriority, type DiagSeverity } from './diagnosticsConfig';

export interface DiagEvent {
  eventId: string;
  seq: number;
  type: DiagEventType;
  severity: DiagSeverity;
  priority: DiagPriority;
  wall: number;
  mono: number;
  screen?: string;
  component?: string;
  fixtureId?: number;
  traceId?: string;
  data: Record<string, unknown>;
}

/** Each event is serialized once, when queued; batches and persistence reuse the string. */
export interface QueueEntry {
  event: DiagEvent;
  json: string;
}

export const PRIORITY_ORDER: readonly DiagPriority[] = ['critical', 'high', 'normal', 'low'];

type LaneCounts = Record<DiagPriority, number>;

const zeroCounts = (): LaneCounts => ({ critical: 0, high: 0, normal: 0, low: 0 });

/**
 * Four priority lanes sharing one cap. When full, the oldest event of the
 * lowest non-empty lane at or below the incoming priority is evicted; if every
 * queued event outranks the incoming one, the incoming event is dropped.
 * Critical events are only evicted by newer critical events once the whole
 * queue is critical, and every drop is counted per lane.
 */
export class DiagnosticsQueue {
  private lanes: Record<DiagPriority, QueueEntry[]> = { critical: [], high: [], normal: [], low: [] };
  private inFlight: QueueEntry[] | null = null;
  readonly dropped: LaneCounts = zeroCounts();

  constructor(private readonly cap: number = DIAG_LIMITS.queueCap) {}

  get pending(): number {
    return this.lanes.critical.length + this.lanes.high.length + this.lanes.normal.length + this.lanes.low.length;
  }

  get size(): number {
    return this.pending + (this.inFlight?.length ?? 0);
  }

  get hasInFlight(): boolean {
    return this.inFlight !== null;
  }

  get droppedTotal(): number {
    return this.dropped.critical + this.dropped.high + this.dropped.normal + this.dropped.low;
  }

  push(event: DiagEvent, json: string = JSON.stringify(event)): boolean {
    if (this.size >= this.cap && !this.evictFor(event.priority)) {
      this.dropped[event.priority] += 1;
      return false;
    }
    this.lanes[event.priority].push({ event, json });
    return true;
  }

  private evictFor(priority: DiagPriority): boolean {
    const incomingRank = PRIORITY_ORDER.indexOf(priority);
    for (let rank = PRIORITY_ORDER.length - 1; rank >= incomingRank; rank -= 1) {
      const lane = this.lanes[PRIORITY_ORDER[rank]];
      if (lane.length > 0) {
        lane.shift();
        this.dropped[PRIORITY_ORDER[rank]] += 1;
        return true;
      }
    }
    return false;
  }

  /** Highest priority first, oldest first within a lane. Returns null while a batch is in flight. */
  takeBatch(maxEvents: number, maxBytes: number): QueueEntry[] | null {
    if (this.inFlight) return null;
    const batch: QueueEntry[] = [];
    let bytes = 0;
    outer: for (const priority of PRIORITY_ORDER) {
      const lane = this.lanes[priority];
      while (lane.length > 0 && batch.length < maxEvents) {
        const entry = lane[0];
        if (batch.length > 0 && bytes + entry.json.length + 1 > maxBytes) break outer;
        lane.shift();
        batch.push(entry);
        bytes += entry.json.length + 1;
      }
      if (batch.length >= maxEvents) break;
    }
    if (batch.length === 0) return null;
    this.inFlight = batch;
    return batch;
  }

  /** The in-flight batch was stored by the server (accepted, duplicate or rejected). */
  ackInFlight(): void {
    this.inFlight = null;
  }

  /** Put the in-flight batch back at the head of its lanes, e.g. to split it. */
  releaseInFlight(): void {
    if (!this.inFlight) return;
    for (let i = this.inFlight.length - 1; i >= 0; i -= 1) {
      const entry = this.inFlight[i];
      this.lanes[entry.event.priority].unshift(entry);
    }
    this.inFlight = null;
  }

  /** Every unacknowledged event, in-flight first, for persistence. */
  entries(): QueueEntry[] {
    return [
      ...(this.inFlight ?? []),
      ...this.lanes.critical,
      ...this.lanes.high,
      ...this.lanes.normal,
      ...this.lanes.low,
    ];
  }

  clear(): void {
    this.lanes = { critical: [], high: [], normal: [], low: [] };
    this.inFlight = null;
  }
}
