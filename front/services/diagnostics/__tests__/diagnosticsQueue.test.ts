import type { DiagPriority } from '../diagnosticsConfig';
import { DiagnosticsQueue, type DiagEvent } from '../diagnosticsQueue';

let seq = 0;
function ev(priority: DiagPriority, extra: Partial<DiagEvent> = {}): DiagEvent {
  seq += 1;
  return {
    eventId: `ab12-cd34-${seq}`,
    seq,
    type: 'screen_focus',
    severity: 'info',
    priority,
    wall: 1_780_000_000_000 + seq,
    mono: seq,
    data: { focused: true },
    ...extra,
  };
}

const ids = (entries: { event: DiagEvent }[] | null) => (entries ?? []).map((entry) => entry.event.seq);

describe('DiagnosticsQueue', () => {
  beforeEach(() => {
    seq = 0;
  });

  it('takes batches by priority, oldest first within a lane', () => {
    const queue = new DiagnosticsQueue(10);
    const low = ev('low');
    const normal1 = ev('normal');
    const critical = ev('critical');
    const normal2 = ev('normal');
    const high = ev('high');
    for (const event of [low, normal1, critical, normal2, high]) queue.push(event);

    expect(ids(queue.takeBatch(10, 1_000_000))).toEqual([critical.seq, high.seq, normal1.seq, normal2.seq, low.seq]);
  });

  it('evicts the oldest lowest-priority event when full and counts it', () => {
    const queue = new DiagnosticsQueue(3);
    queue.push(ev('low'));
    queue.push(ev('normal'));
    queue.push(ev('low'));
    expect(queue.push(ev('high'))).toBe(true);
    expect(queue.size).toBe(3);
    expect(queue.dropped).toEqual({ critical: 0, high: 0, normal: 0, low: 1 });
    expect(ids(queue.takeBatch(10, 1_000_000))).toEqual([4, 2, 3]);
  });

  it('drops an incoming event when everything queued outranks it', () => {
    const queue = new DiagnosticsQueue(2);
    queue.push(ev('critical'));
    queue.push(ev('high'));
    expect(queue.push(ev('normal'))).toBe(false);
    expect(queue.dropped.normal).toBe(1);
    expect(queue.size).toBe(2);
  });

  it('never loses a critical event to lower-priority traffic', () => {
    const queue = new DiagnosticsQueue(50);
    const critical = ev('critical');
    queue.push(critical);
    for (let i = 0; i < 500; i += 1) queue.push(ev(i % 2 ? 'normal' : 'low'));
    expect(queue.dropped.critical).toBe(0);
    expect(queue.entries().some((entry) => entry.event.eventId === critical.eventId)).toBe(true);
  });

  it('respects the byte budget but always sends at least one event', () => {
    const queue = new DiagnosticsQueue(10);
    for (let i = 0; i < 4; i += 1) queue.push(ev('normal'));
    const one = JSON.stringify(queue.entries()[0].event).length + 1;
    expect(queue.takeBatch(10, one * 2)).toHaveLength(2);
    queue.ackInFlight();
    expect(queue.takeBatch(10, 1)).toHaveLength(1);
  });

  it('holds one batch in flight and releases it back in order', () => {
    const queue = new DiagnosticsQueue(10);
    for (let i = 0; i < 4; i += 1) queue.push(ev('normal'));
    const first = queue.takeBatch(2, 1_000_000);
    expect(ids(first)).toEqual([1, 2]);
    expect(queue.takeBatch(2, 1_000_000)).toBeNull();
    expect(queue.size).toBe(4);
    expect(ids(queue.entries())).toEqual([1, 2, 3, 4]);

    queue.releaseInFlight();
    expect(ids(queue.takeBatch(10, 1_000_000))).toEqual([1, 2, 3, 4]);
    queue.ackInFlight();
    expect(queue.size).toBe(0);
  });

  it('serializes each event once and reuses the string', () => {
    const queue = new DiagnosticsQueue(10);
    const event = ev('normal');
    queue.push(event, '{"cached":true}');
    expect(queue.takeBatch(1, 1000)?.[0].json).toBe('{"cached":true}');
  });
});
