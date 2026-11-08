import { clockEstimator } from './diagnosticsUploader';
import { crossClockDelta } from './diagnosticsClockSync';
import { fixtureSignature } from './diagnosticsPrivacy';
import { isFixtureSampled, recordDiagEvent } from './diagnosticsRecorder';
import { diagFlags, monoNow } from './diagnosticsState';

/**
 * One consolidated pipeline trace per live update, assembled while the update
 * moves through store, overlay and row commit, then emitted on the existing
 * host tick. Anomaly events describe what was observed; they are not causes.
 */

export type PipelineSource = 'ws' | 'http_fast' | 'http_full' | 'http_events' | 'calendar' | 'live_feed' | 'bootstrap';
export type PipelineDecision = 'applied' | 'skipped' | 'partial' | 'noop' | 'unknown';

export interface WsCapture {
  fixtureId: number;
  recvWall: number;
  recvMono: number;
  serverEmitAt?: number;
  traceId?: string;
  detectedAt?: number;
  traceGen?: number;
  instanceId?: string;
  sigIn: string;
}

export interface StoreOutcome {
  source: PipelineSource;
  fixtureId: number;
  decision: PipelineDecision;
  reason?: string;
  sigBefore?: string;
  sigIn: string;
  sigAfter?: string;
  recvWall: number;
  recvMono: number;
  interested?: boolean;
  serverEmitAt?: number;
  traceId?: string;
  detectedAt?: number;
  traceGen?: number;
  instanceId?: string;
}

interface PendingTrace extends StoreOutcome {
  storeMono?: number;
  overlayMono?: number;
  commitMono?: number;
  openedMono: number;
}

const TRACE_SETTLE_MS = 2_000;
const DELAY_ANOMALY_MS = 5_000;
const WS_ERROR_MIN_INTERVAL_MS = 10_000;

const SAFE_ID = /^[\w\-:.]+$/;
const SAFE_TRACE = /^[\w.:-]{1,64}$/;

let armed: WsCapture | null = null;
const pending = new Map<number, PendingTrace>();
const lastApplied = new Map<number, { sig: string; serverEmitAt?: number; detectedAt?: number; traceId?: string }>();
let lastWsErrorMono = -Infinity;
let connectedSinceWall: number | null = null;

function cleanId(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/[^\w\-:. ]/g, '').trim().replace(/ /g, '').slice(0, max);
  return text && SAFE_ID.test(text) ? text : undefined;
}

function defined(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function armWsMatchUpdate(message: {
  timestamp?: number;
  payload?: unknown;
  trace?: { id?: string; detectedAt?: number; gen?: number; instanceId?: string };
}): void {
  if (!diagFlags.pipeline) {
    armed = null;
    return;
  }
  const payload = message?.payload as {
    matchId?: number;
    homeScore?: number;
    awayScore?: number;
    status?: string;
    minute?: number;
    extra?: number | null;
  } | null;
  if (!payload || typeof payload.matchId !== 'number' || payload.matchId <= 0) {
    armed = null;
    return;
  }
  const traceId = typeof message.trace?.id === 'string' && SAFE_TRACE.test(message.trace.id) ? message.trace.id : undefined;
  const serverEmitAt =
    typeof message.timestamp === 'number' && message.timestamp >= 1_500_000_000_000 ? message.timestamp : undefined;
  armed = {
    fixtureId: payload.matchId,
    recvWall: Date.now(),
    recvMono: monoNow(),
    serverEmitAt,
    traceId,
    detectedAt: typeof message.trace?.detectedAt === 'number' ? message.trace.detectedAt : undefined,
    traceGen: typeof message.trace?.gen === 'number' ? message.trace.gen : undefined,
    instanceId: cleanId(message.trace?.instanceId, 64),
    sigIn: fixtureSignature({
      status: payload.status,
      elapsed: payload.minute,
      extra: payload.extra,
      home: payload.homeScore,
      away: payload.awayScore,
    }),
  };
}

export function peekWsCapture(fixtureId: number): WsCapture | null {
  if (!armed || armed.fixtureId !== fixtureId) return null;
  return armed;
}

export function clearWsArm(): void {
  armed = null;
}

function anomaly(
  fixtureId: number,
  traceId: string | undefined,
  kind: 'duplicate' | 'out_of_order' | 'stale' | 'overwritten' | 'delayed' | 'missing_stage' | 'regression',
  data: Record<string, unknown>,
): void {
  recordDiagEvent('pipeline_anomaly', {
    severity: 'warn',
    fixtureId,
    traceId,
    screen: 'matches',
    data: defined({ kind, ...data }),
  });
}

function flushOne(trace: PendingTrace, nowMono: number): void {
  pending.delete(trace.fixtureId);
  const applied = trace.decision === 'applied' || trace.decision === 'partial';
  const settled = nowMono - trace.openedMono >= TRACE_SETTLE_MS;
  const missing: Array<'store' | 'overlay' | 'commit'> = [];
  if (applied && settled) {
    if (trace.storeMono == null) missing.push('store');
    if (trace.overlayMono == null) missing.push('overlay');
    if (trace.commitMono == null) missing.push('commit');
  }
  const estimate = clockEstimator.best();
  recordDiagEvent('pipeline_trace', {
    fixtureId: trace.fixtureId,
    traceId: trace.traceId,
    screen: 'matches',
    component: 'LiveFixtureStore',
    data: defined({
      source: trace.source,
      decision: trace.decision,
      reason: trace.reason,
      sigBefore: trace.sigBefore,
      sigIn: trace.sigIn,
      sigAfter: trace.sigAfter,
      recvWall: trace.recvWall,
      recvMono: Math.round(trace.recvMono * 1000) / 1000,
      storeMono: trace.storeMono != null ? Math.round(trace.storeMono * 1000) / 1000 : undefined,
      overlayMono: trace.overlayMono != null ? Math.round(trace.overlayMono * 1000) / 1000 : undefined,
      commitMono: trace.commitMono != null ? Math.round(trace.commitMono * 1000) / 1000 : undefined,
      serverEmitAt: trace.serverEmitAt,
      detectedAt: trace.detectedAt,
      traceGen: trace.traceGen,
      instanceId: trace.instanceId,
      offsetMs: estimate ? Math.round(estimate.offsetMs * 1000) / 1000 : undefined,
      offsetUncMs: estimate ? Math.round(estimate.uncertaintyMs * 1000) / 1000 : undefined,
      interested: trace.interested,
      missingStages: missing.length ? missing : undefined,
    }),
  });

  const previous = lastApplied.get(trace.fixtureId);
  if (previous?.traceId && trace.traceId && previous.traceId === trace.traceId && previous.sig === trace.sigIn) {
    anomaly(trace.fixtureId, trace.traceId, 'duplicate', { source: trace.source, sigIn: trace.sigIn });
  } else if (
    previous?.serverEmitAt != null &&
    trace.serverEmitAt != null &&
    trace.serverEmitAt + 1000 < previous.serverEmitAt
  ) {
    anomaly(trace.fixtureId, trace.traceId, 'out_of_order', {
      source: trace.source,
      sigPrev: previous.sig,
      sigIn: trace.sigIn,
    });
  }
  if (trace.decision === 'skipped' && trace.reason) {
    const regression = trace.reason === 'elapsed_regression' || trace.reason === 'goals_regression';
    if (regression || trace.reason === 'ws_after_fetch_start' || trace.reason === 'newer_http_response') {
      anomaly(trace.fixtureId, trace.traceId, regression ? 'regression' : 'stale', {
        source: trace.source,
        sigPrev: trace.sigBefore,
        sigIn: trace.sigIn,
        detail: trace.reason,
      });
    }
  }
  if (
    applied &&
    previous?.detectedAt != null &&
    trace.detectedAt != null &&
    trace.detectedAt + 1000 < previous.detectedAt
  ) {
    anomaly(trace.fixtureId, trace.traceId, 'overwritten', {
      source: trace.source,
      sigPrev: previous.sig,
      sigIn: trace.sigIn,
    });
  }
  if (trace.serverEmitAt != null && estimate) {
    const delta = crossClockDelta(trace.serverEmitAt, trace.recvWall, estimate);
    if (delta && delta.deltaMs > DELAY_ANOMALY_MS) {
      anomaly(trace.fixtureId, trace.traceId, 'delayed', {
        source: trace.source,
        latencyMs: Math.round(delta.deltaMs),
        detail: delta.lowConfidence ? 'low_confidence' : undefined,
      });
    }
  }
  if (applied && trace.overlayMono == null && nowMono - trace.openedMono >= TRACE_SETTLE_MS) {
    anomaly(trace.fixtureId, trace.traceId, 'missing_stage', {
      source: trace.source,
      detail: missing.join(','),
    });
  }
  if (applied) {
    lastApplied.set(trace.fixtureId, {
      sig: trace.sigAfter ?? trace.sigIn,
      serverEmitAt: trace.serverEmitAt,
      detectedAt: trace.detectedAt,
      traceId: trace.traceId,
    });
  }
}

export function recordStoreOutcome(input: StoreOutcome): void {
  if (!diagFlags.pipeline) return;
  if (input.decision === 'applied' && !isFixtureSampled(input.fixtureId, 'pipeline')) return;
  const now = monoNow();
  const previous = pending.get(input.fixtureId);
  if (previous) flushOne(previous, now);
  pending.set(input.fixtureId, {
    ...input,
    storeMono: input.decision === 'noop' ? undefined : now,
    openedMono: now,
  });
}

/** Stamp list-overlay time onto updates still waiting for their trace to close. */
export function noteOverlayForFixtures(changedIds: Iterable<string>, overlayMono: number): void {
  if (!diagFlags.pipeline) return;
  for (const id of changedIds) {
    const trace = pending.get(Number(id));
    if (trace && trace.overlayMono == null) trace.overlayMono = overlayMono;
  }
}

export function noteRowCommitForFixture(fixtureId: number, commitMono: number): void {
  if (!diagFlags.pipeline || fixtureId <= 0) return;
  const trace = pending.get(fixtureId);
  if (trace && trace.commitMono == null) trace.commitMono = commitMono;
}

/** Closes traces that have had time to reach overlay and commit. Driven by the live-sync intervals. */
export function pipelineHostTick(nowMono: number = monoNow(), force = false): void {
  if (!diagFlags.pipeline && pending.size === 0) return;
  for (const trace of [...pending.values()]) {
    if (force || nowMono - trace.openedMono >= TRACE_SETTLE_MS) flushOne(trace, nowMono);
  }
}

export function recordWsState(
  state: 'connect' | 'disconnect' | 'connect_error' | 'reconnect_attempt' | 'reconnect',
  extra: { reason?: string; attempt?: number } = {},
): void {
  if (!diagFlags.pipeline) return;
  const now = monoNow();
  if (state === 'connect_error' && now - lastWsErrorMono < WS_ERROR_MIN_INTERVAL_MS) return;
  if (state === 'connect_error') lastWsErrorMono = now;
  let connectedForMs: number | undefined;
  if (state === 'connect') connectedSinceWall = Date.now();
  if (state === 'disconnect' && connectedSinceWall != null) {
    connectedForMs = Math.max(0, Date.now() - connectedSinceWall);
    connectedSinceWall = null;
  }
  const reason = extra.reason?.replace(/[^\w .:|+\-/()#@,]/g, '').slice(0, 64);
  recordDiagEvent('ws_state', {
    screen: 'matches',
    data: defined({
      state,
      reason: reason || undefined,
      attempt: extra.attempt,
      connectedForMs,
    }),
  });
}

const HTTP_LABEL = /^[\w\-:.]+$/;

export function recordHttpFetch(input: {
  endpoint: string;
  status: number;
  durationMs: number;
  ok: boolean;
  bytes?: number;
  xCache?: string | null;
}): void {
  if (!diagFlags.pipeline) return;
  if (!HTTP_LABEL.test(input.endpoint) || input.endpoint.length > 64) return;
  const xCache = input.xCache && /^[\w\-:.]+$/.test(input.xCache) ? input.xCache.slice(0, 16) : undefined;
  recordDiagEvent('http_fetch', {
    screen: 'matches',
    data: defined({
      endpoint: input.endpoint,
      status: input.status,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      ok: input.ok,
      bytes: input.bytes != null && input.bytes >= 0 ? Math.round(input.bytes) : undefined,
      xCache,
    }),
  });
}

export function httpEndpointLabel(url: string): string {
  if (url.includes('/fixtures/live')) return 'live_feed';
  if (url.includes('/cached/matches/')) return 'calendar';
  if (url.includes('/world-cup') || url.includes('/worldcup')) return 'world_cup';
  return 'football';
}

export function resetPipelineForTests(): void {
  armed = null;
  pending.clear();
  lastApplied.clear();
  lastWsErrorMono = -Infinity;
  connectedSinceWall = null;
}
