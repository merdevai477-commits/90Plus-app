import { DIAG_LIMITS, DIAG_SCHEMA_VERSION } from './diagnosticsConfig';
import { ClockOffsetEstimator, computeOffsetSample } from './diagnosticsClockSync';
import { randomDiagId } from './diagnosticsPersistence';
import type { QueueEntry } from './diagnosticsQueue';
import { recordDiagEvent } from './diagnosticsRecorder';
import { diagState, monoNow } from './diagnosticsState';

/**
 * Delivery engine: one request in flight, batches of at most 200 events /
 * 200 KB, exponential backoff with jitter that honours Retry-After, and an
 * acknowledgement only after the server has stored the batch. A failed batch
 * is re-sent unchanged (same batchId) so the server can recognise it.
 */

export type ServerSessionState = 'stopped' | 'expired' | 'capped';
export type AbandonReason = 'token_rejected' | 'session_gone' | 'environment_mismatch' | 'disabled' | 'upload_window_closed';

export interface UploadHooks {
  onSessionState(state: ServerSessionState): void;
  onAbandon(reason: AbandonReason): void;
  onDrained(): void;
  /** Called before an upload whose events could reuse ids after a restart. */
  ensureSeqPersisted(): Promise<void>;
}

interface PendingBatch {
  batchId: string;
  entries: QueueEntry[];
}

const OFFSET_EVENT_MIN_INTERVAL_MS = 60_000;

export const clockEstimator = new ClockOffsetEstimator();

let hooks: UploadHooks | null = null;
let pendingBatch: PendingBatch | null = null;
let requestInFlight = false;
let inFlightSinceMono = 0;
let controller: AbortController | null = null;
let failures = 0;
let nextAttemptMono = 0;
let maxBatchEvents: number = DIAG_LIMITS.batchMaxEvents;
let lastOffsetEventMono = -Infinity;
let bestRecordedRtt = Infinity;
let apiBaseOverride: string | null = null;

export function setUploadHooks(next: UploadHooks | null): void {
  hooks = next;
}

export function setDiagnosticsApiBaseForTests(base: string | null): void {
  apiBaseOverride = base;
}

export function diagnosticsApiBase(): string {
  if (apiBaseOverride) return apiBaseOverride;
  const { getApiUrl } = require('../../config/api.config') as typeof import('../../config/api.config');
  return getApiUrl().replace(/\/$/, '');
}

export function isUploadInFlight(): boolean {
  return requestInFlight;
}

/** Host-tick check: a request older than the limit is aborted, then retried with backoff. */
export function abortStuckUpload(mono: number = monoNow()): boolean {
  if (!requestInFlight || mono - inFlightSinceMono <= DIAG_LIMITS.stuckRequestMs) return false;
  controller?.abort();
  return true;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildBody(batch: PendingBatch, sentAtWall: number, sentAtMono: number): string {
  const session = diagState.session!;
  const head = JSON.stringify({
    schemaVersion: DIAG_SCHEMA_VERSION,
    sessionId: session.id,
    batchId: batch.batchId,
    deviceId: diagState.deviceId,
    sentAtWall,
    sentAtMono: round3(sentAtMono),
    app: diagState.app,
  });
  return `${head.slice(0, -1)},"events":[${batch.entries.map((entry) => entry.json).join(',')}]}`;
}

function scheduleRetry(retryAfterHeader: string | null): void {
  failures += 1;
  diagState.flushFailures += 1;
  const exp = Math.min(DIAG_LIMITS.backoffMaxMs, DIAG_LIMITS.backoffBaseMs * 2 ** (failures - 1));
  let delay = exp * (0.5 + Math.random() * 0.5);
  const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    delay = Math.max(delay, Math.min(DIAG_LIMITS.backoffMaxMs, retryAfterSec * 1000));
  }
  diagState.backoffMs = Math.round(delay);
  nextAttemptMono = monoNow() + delay;
}

function noteOffset(t0Wall: number, t0Mono: number, t3Mono: number, json: Record<string, unknown>): void {
  const sample = computeOffsetSample({
    t0Wall,
    t0Mono,
    t3Mono,
    serverRecvAt: Number(json.serverRecvAt),
    serverSendAt: Number(json.serverSendAt),
  });
  if (!sample) return;
  clockEstimator.add(sample);
  const improves = sample.rttMs < bestRecordedRtt;
  if (!improves && t3Mono - lastOffsetEventMono < OFFSET_EVENT_MIN_INTERVAL_MS) return;
  lastOffsetEventMono = t3Mono;
  bestRecordedRtt = Math.min(bestRecordedRtt, sample.rttMs);
  recordDiagEvent('clock_offset_sample', {
    data: {
      kind: 'sample',
      t0: sample.t0,
      t1: sample.t1,
      t2: sample.t2,
      t3: round3(sample.t3),
      offsetMs: round3(sample.offsetMs),
      rttMs: round3(sample.rttMs),
    },
  });
}

type Outcome =
  | { kind: 'acked'; sessionState: ServerSessionState | null }
  | { kind: 'retry'; retryAfter: string | null }
  | { kind: 'split' }
  | { kind: 'abandon'; reason: AbandonReason };

async function sendOnce(batch: PendingBatch): Promise<Outcome> {
  const session = diagState.session!;
  const jsStarted = monoNow();
  const t0Wall = Date.now();
  const t0Mono = monoNow();
  const body = buildBody(batch, t0Wall, t0Mono);
  const jsMs = monoNow() - jsStarted;
  diagState.overhead.serializeMs += jsMs;
  diagState.overhead.flushMs += jsMs;

  controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  requestInFlight = true;
  inFlightSinceMono = t0Mono;
  let res: Response;
  try {
    res = await fetch(`${diagnosticsApiBase()}/diagnostics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Diag ${session.token}` },
      body,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch {
    return { kind: 'retry', retryAfter: null };
  }
  const t3Mono = monoNow();

  if (res.status === 200) {
    const json = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    diagState.uploadedBatches += 1;
    diagState.uploadedEvents += batch.entries.length;
    diagState.bytesUploaded += body.length;
    diagState.overhead.bytes += body.length;
    if (Array.isArray(json.rejected)) diagState.rejectedByServer += json.rejected.length;
    noteOffset(t0Wall, t0Mono, t3Mono, json);
    const state = json.sessionState;
    return {
      kind: 'acked',
      sessionState: state === 'stopped' || state === 'expired' || state === 'capped' ? state : null,
    };
  }
  if (res.status === 400) {
    // The envelope itself was refused; resending it unchanged can never succeed.
    diagState.rejectedByServer += batch.entries.length;
    return { kind: 'acked', sessionState: null };
  }
  if (res.status === 413) return { kind: 'split' };
  if (res.status === 401) return { kind: 'abandon', reason: 'token_rejected' };
  if (res.status === 403) return { kind: 'abandon', reason: 'environment_mismatch' };
  if (res.status === 404) return { kind: 'abandon', reason: 'disabled' };
  if (res.status === 410) return { kind: 'abandon', reason: 'session_gone' };
  return { kind: 'retry', retryAfter: res.headers?.get?.('Retry-After') ?? null };
}

/**
 * Uploads queued events. Safe to call from any trigger (host tick,
 * foreground, reconnect, batch threshold): it returns at once while a
 * request is in flight, while offline, or during backoff.
 */
export async function flushDiagnostics(options: { maxBatches?: number } = {}): Promise<void> {
  const maxBatches = Math.max(1, options.maxBatches ?? 1);
  for (let sent = 0; sent < maxBatches; sent += 1) {
    const session = diagState.session;
    if (!session || !diagState.app) return;
    const mono = monoNow();
    if (requestInFlight) {
      abortStuckUpload(mono);
      return;
    }
    if (!diagState.online || mono < nextAttemptMono) return;
    if (Date.now() > session.uploadUntilWall) {
      hooks?.onAbandon('upload_window_closed');
      return;
    }

    if (!pendingBatch) {
      const entries = diagState.queue.takeBatch(maxBatchEvents, DIAG_LIMITS.batchMaxBytes);
      if (!entries) {
        hooks?.onDrained();
        return;
      }
      pendingBatch = { batchId: `b_${randomDiagId(12)}`, entries };
    }
    const batch = pendingBatch;
    const maxSeq = batch.entries.reduce((max, entry) => Math.max(max, entry.event.seq), 0);
    if (maxSeq >= diagState.seqFloorPersisted && hooks) {
      requestInFlight = true;
      try {
        await hooks.ensureSeqPersisted();
      } finally {
        requestInFlight = false;
      }
    }

    let outcome: Outcome;
    try {
      outcome = await sendOnce(batch);
    } catch {
      outcome = { kind: 'retry', retryAfter: null };
    } finally {
      requestInFlight = false;
      controller = null;
    }

    if (outcome.kind === 'acked') {
      diagState.queue.ackInFlight();
      pendingBatch = null;
      failures = 0;
      nextAttemptMono = 0;
      diagState.backoffMs = 0;
      diagState.persistDirty = true;
      if (outcome.sessionState) hooks?.onSessionState(outcome.sessionState);
      continue;
    }
    if (outcome.kind === 'split') {
      diagState.queue.releaseInFlight();
      pendingBatch = null;
      maxBatchEvents = Math.max(10, Math.floor(maxBatchEvents / 2));
      continue;
    }
    if (outcome.kind === 'abandon') {
      pendingBatch = null;
      hooks?.onAbandon(outcome.reason);
      return;
    }
    scheduleRetry(outcome.retryAfter);
    return;
  }
}

export function resetUploaderForTests(): void {
  hooks = null;
  pendingBatch = null;
  requestInFlight = false;
  inFlightSinceMono = 0;
  controller = null;
  failures = 0;
  nextAttemptMono = 0;
  maxBatchEvents = DIAG_LIMITS.batchMaxEvents;
  lastOffsetEventMono = -Infinity;
  bestRecordedRtt = Infinity;
  apiBaseOverride = null;
  clockEstimator.reset();
}

/** Drops the pinned batch, e.g. when switching sessions. */
export function discardPendingBatch(): void {
  pendingBatch = null;
}
