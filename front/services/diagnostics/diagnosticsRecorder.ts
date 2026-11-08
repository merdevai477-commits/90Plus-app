import { DEFAULT_PRIORITY, DIAG_LIMITS, type DiagEventType, type DiagPriority, type DiagSeverity } from './diagnosticsConfig';
import { sanitizeDiagData, shouldSampleFixture } from './diagnosticsPrivacy';
import type { DiagEvent } from './diagnosticsQueue';
import { diagFlags, diagState, monoNow } from './diagnosticsState';

export interface RecordInit {
  severity?: DiagSeverity;
  priority?: DiagPriority;
  screen?: string;
  component?: string;
  fixtureId?: number | null;
  traceId?: string | null;
  data?: Record<string, unknown>;
  /** Monotonic time of the observation when it happened before the call. */
  mono?: number;
}

const SAFE_LABEL = /^[\w\-:.]{1,48}$/;
const SAFE_TRACE = /^[\w.:-]{1,64}$/;

function eventIdFor(seq: number): string {
  const session = diagState.session?.id ?? 'none';
  const sess4 = session.replace(/-/g, '').slice(0, 4) || 'none';
  const dev4 = diagState.deviceId.replace(/^d_/, '').slice(0, 4) || 'dev0';
  return `${sess4}-${dev4}-${seq}`;
}

/**
 * Records one diagnostics event. A no-op (one boolean read) unless a remote
 * session is recording. Never throws into the caller.
 */
export function recordDiagEvent(type: DiagEventType, init: RecordInit = {}): void {
  if (!diagFlags.active) return;
  const started = monoNow();
  try {
    const session = diagState.session;
    if (!session || !diagState.recording) return;
    if (started >= session.expiresAtMono && !diagState.closing) {
      diagState.onExpired?.();
      return;
    }

    diagState.seq += 1;
    const priority = init.priority ?? DEFAULT_PRIORITY[type];
    const event: DiagEvent = {
      eventId: eventIdFor(diagState.seq),
      seq: diagState.seq,
      type,
      severity: init.severity ?? 'info',
      priority,
      wall: Date.now(),
      mono: init.mono ?? started,
      data: sanitizeDiagData(init.data),
    };
    if (init.screen && SAFE_LABEL.test(init.screen)) event.screen = init.screen;
    if (init.component && SAFE_LABEL.test(init.component)) event.component = init.component;
    if (init.fixtureId != null && Number.isInteger(init.fixtureId) && init.fixtureId > 0) event.fixtureId = init.fixtureId;
    if (init.traceId && SAFE_TRACE.test(init.traceId)) event.traceId = init.traceId;

    const json = JSON.stringify(event);
    diagState.queue.push(event, json);
    diagState.recorded += 1;
    diagState.persistDirty = true;
    diagState.overhead.events += 1;

    if (priority === 'critical') diagState.onCritical?.();
    if (diagState.queue.pending >= DIAG_LIMITS.batchMaxEvents) diagState.onBatchReady?.();
  } catch {
    /* diagnostics must never affect the app */
  } finally {
    diagState.overhead.recordMs += monoNow() - started;
  }
}

/** Per-session deterministic fixture sampling for a feature's sampling rate. */
export function isFixtureSampled(fixtureId: number | string, feature: 'pipeline' | 'render'): boolean {
  const session = diagState.session;
  if (!session) return false;
  return shouldSampleFixture(fixtureId, session.config.sampling[feature], session.id);
}

/** Header value for `x-diag-session` while recording, else null. */
export function getDiagSessionHeader(): string | null {
  return diagFlags.active && diagState.session ? diagState.session.id : null;
}
