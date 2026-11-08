import type { DiagAppInfo, DiagSessionConfig } from './diagnosticsConfig';
import { DiagnosticsQueue } from './diagnosticsQueue';

/**
 * The only state hook sites read. Every guarded call site checks one of
 * these booleans first; they are all false unless a remote session is
 * recording on a diagnostics-capable build.
 */
export const diagFlags = {
  active: false,
  pipeline: false,
  render: false,
  clock: false,
  sentryTags: false,
  observe: false,
  backendTrace: false,
};

export interface DiagSession {
  id: string;
  token: string;
  config: DiagSessionConfig;
  expiresAtMono: number;
  expiresAtWall: number;
  uploadUntilWall: number;
  startedAtWall: number;
  startedAtMono: number;
}

export interface DiagOverheadWindow {
  startedAtMono: number;
  recordMs: number;
  flushMs: number;
  persistMs: number;
  serializeMs: number;
  events: number;
  bytes: number;
}

export function newOverheadWindow(mono: number): DiagOverheadWindow {
  return { startedAtMono: mono, recordMs: 0, flushMs: 0, persistMs: 0, serializeMs: 0, events: 0, bytes: 0 };
}

export const diagState = {
  engineStarted: false,
  deviceId: '',
  app: null as DiagAppInfo | null,
  /** Session we upload for. Kept after recording ends until the queue drains or the upload window closes. */
  session: null as DiagSession | null,
  recording: false,
  /** True while the session's closing events are recorded after expiry. */
  closing: false,
  seq: 0,
  seqFloorPersisted: 0,
  recorded: 0,
  queue: new DiagnosticsQueue(),
  online: true,
  appActive: true,
  persistDirty: false,
  lastPersistMono: 0,
  uploadedBatches: 0,
  uploadedEvents: 0,
  bytesUploaded: 0,
  rejectedByServer: 0,
  flushFailures: 0,
  backoffMs: 0,
  overhead: newOverheadWindow(0),
  /** Set by the session engine so the recorder can request work without importing it. */
  onCritical: null as null | (() => void),
  onBatchReady: null as null | (() => void),
  onExpired: null as null | (() => void),
  /** Pipeline and render windows flush here before a session stops recording. */
  onFlushSurfaces: null as null | (() => void),
};

export function monoNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function resetDiagStateForTests(): void {
  for (const key of Object.keys(diagFlags) as (keyof typeof diagFlags)[]) diagFlags[key] = false;
  diagState.engineStarted = false;
  diagState.deviceId = '';
  diagState.app = null;
  diagState.session = null;
  diagState.recording = false;
  diagState.closing = false;
  diagState.seq = 0;
  diagState.seqFloorPersisted = 0;
  diagState.recorded = 0;
  diagState.queue = new DiagnosticsQueue();
  diagState.online = true;
  diagState.appActive = true;
  diagState.persistDirty = false;
  diagState.lastPersistMono = 0;
  diagState.uploadedBatches = 0;
  diagState.uploadedEvents = 0;
  diagState.bytesUploaded = 0;
  diagState.rejectedByServer = 0;
  diagState.flushFailures = 0;
  diagState.backoffMs = 0;
  diagState.overhead = newOverheadWindow(0);
  diagState.onCritical = null;
  diagState.onBatchReady = null;
  diagState.onExpired = null;
  diagState.onFlushSurfaces = null;
}
