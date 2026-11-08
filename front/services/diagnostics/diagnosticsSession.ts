import {
  DIAG_LIMITS,
  DIAG_SCHEMA_VERSION,
  isDiagnosticsCapableBuild,
  readDiagAppInfo,
  type DiagFeatures,
  type DiagSessionConfig,
} from './diagnosticsConfig';
import { clearPersisted, getOrCreateDiagDeviceId, loadPersisted, savePersisted } from './diagnosticsPersistence';
import { recordDiagEvent } from './diagnosticsRecorder';
import { diagFlags, diagState, monoNow, newOverheadWindow } from './diagnosticsState';
import {
  abortStuckUpload,
  clockEstimator,
  diagnosticsApiBase,
  discardPendingBatch,
  flushDiagnostics,
  setUploadHooks,
  type AbandonReason,
  type ServerSessionState,
} from './diagnosticsUploader';

/**
 * Remote session lifecycle on the device.
 *
 * The directive is requested on cold start and on foreground only (at most
 * once per minute); there is no polling loop and no timer. Periodic work
 * (expiry, persistence, upload, stats) runs from `diagnosticsHostTick`, which
 * the app's existing live-sync intervals call.
 */

export type SessionEndReason = 'expired' | 'stopped' | 'max_events' | 'disabled' | 'token_rejected' | 'error';

export interface DiagSessionInfo {
  sessionId: string;
  recording: boolean;
  features: DiagFeatures;
}

type SessionListener = (info: DiagSessionInfo | null) => void;

const DEFAULT_FEATURES: DiagFeatures = {
  pipeline: true,
  render: true,
  clock: true,
  sentryTags: true,
  observe: true,
  backendTrace: true,
};

let authTokenGetter: (() => Promise<string | null>) | null = null;
let directiveInFlight = false;
let lastDirectiveMono = -Infinity;
let appStateSub: { remove: () => void } | null = null;
let netInfoUnsub: (() => void) | null = null;
let lastAppState = 'active';
let hostLastMono: Record<string, number> = {};
let lastStatsMono = 0;
let persistInFlight: Promise<void> | null = null;
let persistAgain = false;
const listeners = new Set<SessionListener>();

export function setDiagnosticsAuthTokenGetter(getter: (() => Promise<string | null>) | null): void {
  authTokenGetter = getter;
}

export function onDiagnosticsSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentInfo(): DiagSessionInfo | null {
  const session = diagState.session;
  if (!session) return null;
  return { sessionId: session.id, recording: diagState.recording, features: { ...session.config.features } };
}

function notify(): void {
  const info = currentInfo();
  for (const listener of listeners) {
    try {
      listener(info);
    } catch {
      /* a listener must not break the engine */
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseConfig(raw: unknown): DiagSessionConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const features = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(features) as (keyof DiagFeatures)[]) {
    if (typeof source.features?.[key] === 'boolean') features[key] = source.features[key];
  }
  const rate = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : fallback;
  return {
    maxEvents: typeof source.maxEvents === 'number' && source.maxEvents > 0 ? source.maxEvents : 20_000,
    features,
    sampling: {
      pipeline: rate(source.sampling?.pipeline, 1),
      render: rate(source.sampling?.render, 1),
      selectorTiming: rate(source.sampling?.selectorTiming, 0.1),
    },
  };
}

function setRecordingFlags(features: DiagFeatures | null): void {
  diagFlags.pipeline = Boolean(features?.pipeline);
  diagFlags.render = Boolean(features?.render);
  diagFlags.clock = Boolean(features?.clock);
  diagFlags.sentryTags = Boolean(features?.sentryTags);
  diagFlags.observe = Boolean(features?.observe);
  diagFlags.backendTrace = Boolean(features?.backendTrace);
  diagFlags.active = features !== null;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistNow(): Promise<void> {
  const session = diagState.session;
  if (!session) return;
  diagState.persistDirty = false;
  diagState.lastPersistMono = monoNow();
  const seqFloor = diagState.seq + DIAG_LIMITS.seqReserve;
  try {
    const { jsMs } = await savePersisted(
      {
        sessionId: session.id,
        token: session.token,
        seqFloor,
        expiresAtWall: session.expiresAtWall,
        uploadUntilWall: session.uploadUntilWall,
        startedAtWall: session.startedAtWall,
        recording: diagState.recording,
        config: session.config,
      },
      diagState.queue.entries(),
    );
    diagState.seqFloorPersisted = seqFloor;
    diagState.overhead.persistMs += jsMs;
  } catch {
    diagState.persistDirty = true;
  }
}

/** Coalesces concurrent requests; `force` skips the minimum interval. */
export function requestDiagnosticsPersist(force: boolean): Promise<void> {
  if (!diagState.session) return Promise.resolve();
  if (!force && (!diagState.persistDirty || monoNow() - diagState.lastPersistMono < DIAG_LIMITS.persistMinIntervalMs)) {
    return persistInFlight ?? Promise.resolve();
  }
  if (persistInFlight) {
    persistAgain = true;
    return persistInFlight;
  }
  persistInFlight = (async () => {
    try {
      do {
        persistAgain = false;
        await persistNow();
      } while (persistAgain);
    } finally {
      persistInFlight = null;
    }
  })();
  return persistInFlight;
}

// ---------------------------------------------------------------------------
// Session transitions
// ---------------------------------------------------------------------------

function emitStats(mono: number): void {
  const window = diagState.overhead;
  const queue = diagState.queue;
  recordDiagEvent('queue_stats', {
    data: {
      size: queue.size,
      persisted: diagState.lastPersistMono > 0 ? queue.size : 0,
      dropped: { ...queue.dropped },
      criticalDropped: queue.dropped.critical,
      flushFailures: diagState.flushFailures,
      backoffMs: diagState.backoffMs,
      uploadedBatches: diagState.uploadedBatches,
      uploadedEvents: diagState.uploadedEvents,
      bytesUploaded: diagState.bytesUploaded,
      rejected: diagState.rejectedByServer,
    },
  });
  const round = (value: number) => Math.round(value * 1000) / 1000;
  recordDiagEvent('diag_overhead', {
    data: {
      windowMs: Math.round(mono - window.startedAtMono),
      recordMs: round(window.recordMs),
      flushMs: round(window.flushMs),
      persistMs: round(window.persistMs),
      serializeMs: round(window.serializeMs),
      events: window.events,
      bytes: window.bytes,
    },
  });
  diagState.overhead = newOverheadWindow(mono);
  lastStatsMono = mono;
}

export function endDiagnosticsSession(reason: SessionEndReason): void {
  if (!diagState.recording || !diagState.session) return;
  const session = diagState.session;
  diagState.closing = true;
  try {
    emitStats(monoNow());
    recordDiagEvent('session_end', {
      data: {
        reason,
        recorded: diagState.recorded,
        dropped: diagState.queue.droppedTotal,
        durationMs: Math.max(0, Date.now() - session.startedAtWall),
      },
    });
  } finally {
    diagState.closing = false;
  }
  diagState.recording = false;
  setRecordingFlags(null);
  notify();
  void requestDiagnosticsPersist(true);
  void flushDiagnostics({ maxBatches: 3 });
}

/** Stops recording and uploading and deletes everything stored for the session. */
function abandonSession(reason: AbandonReason): void {
  diagState.recording = false;
  setRecordingFlags(null);
  diagState.queue.clear();
  discardPendingBatch();
  diagState.session = null;
  void clearPersisted().catch(() => undefined);
  notify();
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info(`[DIAG] session abandoned: ${reason}`);
}

function finishUploadIfDone(): void {
  if (diagState.recording || !diagState.session || diagState.queue.size > 0) return;
  diagState.session = null;
  void clearPersisted().catch(() => undefined);
  notify();
}

function checkExpiry(mono: number = monoNow()): void {
  const session = diagState.session;
  if (!session || !diagState.recording) return;
  if (mono >= session.expiresAtMono || Date.now() >= session.expiresAtWall) endDiagnosticsSession('expired');
}

function activateSession(json: Record<string, unknown>, reason: 'cold_start' | 'foreground'): void {
  const now = Date.now();
  const mono = monoNow();
  const expiresInMs = clamp(Number(json.expiresInMs), 0, DIAG_LIMITS.maxSessionMs);
  if (!(expiresInMs > 0)) return;
  const serverNow = Number(json.serverNow);
  const uploadUntil = Number(json.uploadUntil);
  const uploadWindowMs =
    Number.isFinite(serverNow) && Number.isFinite(uploadUntil)
      ? clamp(uploadUntil - serverNow, expiresInMs, expiresInMs + 25 * 3600_000)
      : expiresInMs + 24 * 3600_000;

  const sessionId = String(json.sessionId);
  const config = parseConfig(json.config);
  const current = diagState.session;
  const sameSession = current?.id === sessionId;

  if (current && !sameSession) {
    if (diagState.recording) endDiagnosticsSession('stopped');
    diagState.queue.clear();
    discardPendingBatch();
  }
  if (!sameSession) {
    diagState.seq = 0;
    diagState.seqFloorPersisted = 0;
    diagState.recorded = 0;
    diagState.overhead = newOverheadWindow(mono);
    lastStatsMono = mono;
  }

  diagState.session = {
    id: sessionId,
    token: String(json.token),
    config,
    expiresAtMono: mono + expiresInMs,
    expiresAtWall: now + expiresInMs,
    uploadUntilWall: now + uploadWindowMs,
    startedAtWall: sameSession && current ? current.startedAtWall : now,
    startedAtMono: sameSession && current ? current.startedAtMono : mono,
  };

  const wasRecording = diagState.recording;
  diagState.recording = true;
  setRecordingFlags(config.features);
  if (!sameSession || !wasRecording) {
    recordDiagEvent('session_start', {
      data: {
        reason,
        features: { ...config.features },
        sampling: { ...config.sampling },
        expiresInMs: Math.round(expiresInMs),
        seqStart: diagState.seq + 1,
      },
    });
  }
  void requestDiagnosticsPersist(true);
  notify();
}

export async function requestDiagnosticsDirective(reason: 'cold_start' | 'foreground'): Promise<void> {
  if (!diagState.engineStarted || directiveInFlight || !diagState.app) return;
  const mono = monoNow();
  if (reason !== 'cold_start' && mono - lastDirectiveMono < DIAG_LIMITS.directiveDebounceMs) return;
  lastDirectiveMono = mono;
  directiveInFlight = true;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const bearer = authTokenGetter ? await authTokenGetter().catch(() => null) : null;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await fetch(`${diagnosticsApiBase()}/diagnostics/directive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ schemaVersion: DIAG_SCHEMA_VERSION, deviceId: diagState.deviceId, app: diagState.app }),
    });
    if (res.status !== 200) return;
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (json?.active === true && typeof json.sessionId === 'string' && typeof json.token === 'string') {
      activateSession(json, reason);
    } else if (json?.active === false && diagState.recording) {
      endDiagnosticsSession('stopped');
    }
  } catch {
    /* offline or server unavailable: try again on the next foreground */
  } finally {
    directiveInFlight = false;
  }
}

// ---------------------------------------------------------------------------
// Restore, lifecycle, host tick
// ---------------------------------------------------------------------------

async function restoreFromStorage(): Promise<void> {
  const restored = await loadPersisted();
  if (!restored) return;
  const { meta, events } = restored;
  const now = Date.now();
  if (meta.uploadUntilWall <= now) {
    await clearPersisted();
    return;
  }
  const mono = monoNow();
  diagState.session = {
    id: meta.sessionId,
    token: meta.token,
    config: parseConfig(meta.config),
    expiresAtWall: meta.expiresAtWall,
    expiresAtMono: mono + (meta.expiresAtWall - now),
    uploadUntilWall: meta.uploadUntilWall,
    startedAtWall: meta.startedAtWall,
    startedAtMono: mono - Math.max(0, now - meta.startedAtWall),
  };
  diagState.seq = Math.max(0, Number(meta.seqFloor) || 0);
  diagState.seqFloorPersisted = diagState.seq;
  const seen = new Set<string>();
  let restoredEvents = 0;
  for (const event of events) {
    if (!event || typeof event.eventId !== 'string' || seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    if (diagState.queue.push(event)) restoredEvents += 1;
  }
  if (meta.recording && meta.expiresAtWall > now) {
    diagState.recording = true;
    setRecordingFlags(diagState.session.config.features);
    recordDiagEvent('session_start', {
      data: {
        reason: 'restore',
        features: { ...diagState.session.config.features },
        sampling: { ...diagState.session.config.sampling },
        expiresInMs: Math.round(meta.expiresAtWall - now),
        restoredEvents,
        seqStart: diagState.seq + 1,
      },
    });
  }
  notify();
}

function onAppStateChange(next: string): void {
  const previous = lastAppState;
  lastAppState = next;
  const active = next === 'active';
  const wasActive = diagState.appActive;
  diagState.appActive = active;
  if (previous !== next) recordDiagEvent('app_state', { data: { from: previous, to: next } });
  if (!active) {
    hostLastMono = {};
    void requestDiagnosticsPersist(true);
    void flushDiagnostics({ maxBatches: 2 });
    return;
  }
  if (!wasActive) {
    clockEstimator.observeWall(Date.now(), monoNow());
    checkExpiry();
    void requestDiagnosticsDirective('foreground');
    void flushDiagnostics();
  }
}

function subscribeLifecycle(): void {
  try {
    const { AppState } = require('react-native') as typeof import('react-native');
    if (AppState && typeof AppState.addEventListener === 'function') {
      lastAppState = String(AppState.currentState ?? 'active');
      diagState.appActive = lastAppState === 'active';
      const sub = AppState.addEventListener('change', onAppStateChange);
      if (sub && typeof sub.remove === 'function') appStateSub = sub;
    }
  } catch {
    /* no AppState in this runtime */
  }
  try {
    const NetInfo = require('@react-native-community/netinfo').default as {
      addEventListener?: (cb: (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void) => () => void;
    };
    const unsubscribe = NetInfo?.addEventListener?.((state) => {
      const online = state?.isConnected !== false && state?.isInternetReachable !== false;
      const wasOnline = diagState.online;
      diagState.online = online;
      if (online && !wasOnline) void flushDiagnostics();
    });
    if (typeof unsubscribe === 'function') netInfoUnsub = unsubscribe;
  } catch {
    /* assume online */
  }
}

/**
 * Periodic diagnostics work, driven by intervals the app already runs
 * (`host` names the interval, `expectedMs` its period). Lateness of those
 * intervals while the app is in the foreground is reported as a JS stall.
 */
export function diagnosticsHostTick(host: string, expectedMs: number): void {
  if (!diagState.engineStarted) return;
  try {
    const mono = monoNow();
    const previous = hostLastMono[host];
    hostLastMono[host] = mono;
    if (diagState.recording && diagState.appActive && previous !== undefined) {
      const lateness = mono - previous - expectedMs;
      if (lateness > DIAG_LIMITS.stallThresholdMs && lateness < 10 * 60_000) {
        recordDiagEvent('js_stall', { data: { host, latenessMs: Math.round(lateness), expectedMs } });
      }
    }

    checkExpiry(mono);
    if (diagState.recording && diagState.appActive) {
      const jump = clockEstimator.observeWall(Date.now(), mono);
      if (jump !== null) recordDiagEvent('clock_offset_sample', { data: { kind: 'wall_jump', wallJumpMs: Math.round(jump) } });
    }
    if (diagState.recording && mono - lastStatsMono >= DIAG_LIMITS.statsWindowMs) {
      emitStats(mono);
      sampleMemory();
    }
    abortStuckUpload(mono);
    void requestDiagnosticsPersist(false);
    void flushDiagnostics();
  } catch {
    /* host intervals must never be affected */
  }
}

function sampleMemory(): void {
  if (!diagFlags.render) return;
  try {
    const hermes = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => Record<string, number> } })
      .HermesInternal;
    const stats = hermes?.getInstrumentedStats?.();
    if (!stats) return;
    recordDiagEvent('memory_sample', {
      data: { source: 'hermes', jsHeapSize: stats.js_heapSize, jsAllocated: stats.js_allocatedBytes },
    });
  } catch {
    /* not available in this build */
  }
}

/** Mounted once after first interactions. No-op unless this is a diagnostics-capable build. */
export async function startDiagnosticsEngine(): Promise<void> {
  if (!isDiagnosticsCapableBuild() || diagState.engineStarted) return;
  diagState.engineStarted = true;
  try {
    diagState.app = readDiagAppInfo();
    diagState.deviceId = await getOrCreateDiagDeviceId();
    diagState.onCritical = () => {
      void requestDiagnosticsPersist(true);
    };
    diagState.onBatchReady = () => {
      void flushDiagnostics();
    };
    diagState.onExpired = () => checkExpiry();
    setUploadHooks({
      onSessionState: (state: ServerSessionState) =>
        endDiagnosticsSession(state === 'capped' ? 'max_events' : state === 'expired' ? 'expired' : 'stopped'),
      onAbandon: abandonSession,
      onDrained: finishUploadIfDone,
      ensureSeqPersisted: () => requestDiagnosticsPersist(true),
    });
    await restoreFromStorage();
    subscribeLifecycle();
    await requestDiagnosticsDirective('cold_start');
  } catch {
    /* diagnostics must never affect startup */
  }
}

export function resetDiagnosticsSessionForTests(): void {
  appStateSub?.remove();
  appStateSub = null;
  netInfoUnsub?.();
  netInfoUnsub = null;
  authTokenGetter = null;
  directiveInFlight = false;
  lastDirectiveMono = -Infinity;
  lastAppState = 'active';
  hostLastMono = {};
  lastStatsMono = 0;
  persistInFlight = null;
  persistAgain = false;
  listeners.clear();
  setUploadHooks(null);
}
