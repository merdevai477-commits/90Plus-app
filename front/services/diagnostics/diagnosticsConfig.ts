/**
 * Remote diagnostics: build capability and limits.
 *
 * Only builds made with the EAS `diagnostic` profile set
 * EXPO_PUBLIC_DIAGNOSTICS=1. In every other build each diagnostics entry point
 * returns immediately, so nothing is recorded, stored or sent.
 */

export const DIAG_SCHEMA_VERSION = 1;

export function isDiagnosticsCapableBuild(): boolean {
  const flag = process.env.EXPO_PUBLIC_DIAGNOSTICS;
  return flag === '1' || flag === 'true';
}

export const DIAG_LIMITS = {
  queueCap: 3000,
  batchMaxEvents: 200,
  /** Server limit is 256 KB; stay under it including the envelope. */
  batchMaxBytes: 200 * 1024,
  directiveDebounceMs: 60_000,
  /** A request older than this is aborted on the next host tick (no timeout timer). */
  stuckRequestMs: 30_000,
  backoffBaseMs: 2_000,
  backoffMaxMs: 5 * 60_000,
  persistMinIntervalMs: 15_000,
  persistChunkEvents: 250,
  statsWindowMs: 60_000,
  /** Host intervals running this much later than scheduled are reported as JS stalls. */
  stallThresholdMs: 250,
  /** Reserved seq headroom so event ids stay unique across app restarts. */
  seqReserve: 5_000,
  maxSessionMs: 3 * 60 * 60 * 1000,
} as const;

export type DiagPriority = 'critical' | 'high' | 'normal' | 'low';
export type DiagSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type DiagEventType =
  | 'session_start'
  | 'session_end'
  | 'session_summary'
  | 'app_state'
  | 'screen_focus'
  | 'category_switch'
  | 'details_open'
  | 'details_return'
  | 'foreground_recovery'
  | 'pull_refresh'
  | 'pipeline_trace'
  | 'pipeline_anomaly'
  | 'room_sub'
  | 'ws_state'
  | 'http_fetch'
  | 'render_window'
  | 'js_stall'
  | 'memory_sample'
  | 'list_load'
  | 'clock_summary'
  | 'clock_reanchor'
  | 'list_minute_mismatch'
  | 'clock_offset_sample'
  | 'queue_stats'
  | 'diag_overhead'
  | 'sentry_event_ref'
  | 'observe_entries_summary';

export const DEFAULT_PRIORITY: Record<DiagEventType, DiagPriority> = {
  session_start: 'critical',
  session_end: 'critical',
  session_summary: 'critical',
  sentry_event_ref: 'critical',
  app_state: 'high',
  category_switch: 'high',
  details_open: 'high',
  details_return: 'high',
  foreground_recovery: 'high',
  pipeline_anomaly: 'high',
  ws_state: 'high',
  js_stall: 'high',
  screen_focus: 'normal',
  pull_refresh: 'normal',
  pipeline_trace: 'normal',
  room_sub: 'normal',
  http_fetch: 'normal',
  render_window: 'normal',
  list_load: 'normal',
  clock_summary: 'normal',
  clock_reanchor: 'normal',
  list_minute_mismatch: 'normal',
  clock_offset_sample: 'normal',
  queue_stats: 'normal',
  diag_overhead: 'normal',
  observe_entries_summary: 'normal',
  memory_sample: 'low',
};

export interface DiagFeatures {
  pipeline: boolean;
  render: boolean;
  clock: boolean;
  sentryTags: boolean;
  observe: boolean;
  backendTrace: boolean;
}

export interface DiagSampling {
  pipeline: number;
  render: number;
  selectorTiming: number;
}

export interface DiagSessionConfig {
  maxEvents: number;
  features: DiagFeatures;
  sampling: DiagSampling;
}

export interface DiagAppInfo {
  version: string;
  build: string;
  platform: 'ios' | 'android' | 'web';
  osVersion?: string;
  runtimeVersion?: string;
  updateId?: string | null;
  channel?: string | null;
  environment: 'production' | 'development';
}

function clean(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/[^\w .:|+\-/()#@,]/g, '').slice(0, max);
  return text || undefined;
}

/** Read once per engine start; every native module is optional. */
export function readDiagAppInfo(): DiagAppInfo {
  let platform: DiagAppInfo['platform'] = 'ios';
  let osVersion: string | undefined;
  try {
    const { Platform } = require('react-native') as typeof import('react-native');
    const os = String(Platform?.OS ?? 'ios');
    platform = os === 'android' ? 'android' : os === 'web' ? 'web' : 'ios';
    osVersion = clean(Platform?.Version, 32);
  } catch {
    /* defaults */
  }

  let version: string | undefined;
  let build: string | undefined;
  try {
    const Application = require('expo-application') as {
      nativeApplicationVersion?: string | null;
      nativeBuildVersion?: string | null;
    };
    version = clean(Application?.nativeApplicationVersion, 32);
    build = clean(Application?.nativeBuildVersion, 16);
  } catch {
    /* fall back to expo-constants */
  }
  if (!version) {
    try {
      const Constants = require('expo-constants').default as { expoConfig?: { version?: string } };
      version = clean(Constants?.expoConfig?.version, 32);
    } catch {
      /* unknown */
    }
  }

  let runtimeVersion: string | undefined;
  let updateId: string | null = null;
  let channel: string | null = null;
  try {
    const Updates = require('expo-updates') as {
      runtimeVersion?: string | null;
      updateId?: string | null;
      channel?: string | null;
    };
    runtimeVersion = clean(Updates?.runtimeVersion, 32);
    updateId = Updates?.updateId ? String(Updates.updateId).replace(/[^\w-]/g, '').slice(0, 64) || null : null;
    channel = clean(Updates?.channel, 32) ?? null;
  } catch {
    /* not available in this runtime */
  }

  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  return {
    version: version ?? 'unknown',
    build: build ?? 'unknown',
    platform,
    ...(osVersion ? { osVersion } : {}),
    ...(runtimeVersion ? { runtimeVersion } : {}),
    updateId,
    channel,
    environment: dev ? 'development' : 'production',
  };
}
