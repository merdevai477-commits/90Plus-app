/**
 * Client-side gate for a finished voice recording. A usability shortcut only —
 * the server re-validates format, duration and quota on every upload.
 */

export const MIN_VOICE_DURATION_MS = 1000;
export const MAX_VOICE_DURATION_MS = 30_000;

/**
 * Peak normalized level below which a clip counts as silent (≈ -42 dBFS).
 * Quiet speech sits around -35 dBFS (≈ 0.4), room noise around -55 (≈ 0).
 */
export const SILENCE_PEAK_THRESHOLD = 0.26;
/** Meters that never move (unsupported / stuck at a floor value) are ignored. */
const MIN_METER_SPREAD_DB = 0.5;
const MIN_METER_SAMPLES = 3;

/** Metering is dBFS (≈ -60 silence … 0 loud); map to 0…1 for the level visuals. */
export function normalizeLevel(db: number | undefined): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 55) / 50));
}

export type MeterStats = {
  samples: number;
  peakLevel: number;
  minDb: number;
  maxDb: number;
};

export function emptyMeterStats(): MeterStats {
  return { samples: 0, peakLevel: 0, minDb: Infinity, maxDb: -Infinity };
}

export function addMeterSample(stats: MeterStats, db: number | undefined): MeterStats {
  if (typeof db !== 'number' || !Number.isFinite(db)) return stats;
  return {
    samples: stats.samples + 1,
    peakLevel: Math.max(stats.peakLevel, normalizeLevel(db)),
    minDb: Math.min(stats.minDb, db),
    maxDb: Math.max(stats.maxDb, db),
  };
}

/**
 * Where a recording auto-stops: the per-clip cap, or the voice time left
 * today when that is shorter (null = unknown/unlimited).
 */
export function recordingCapMs(remainingSeconds: number | null | undefined): number {
  if (typeof remainingSeconds !== 'number' || !Number.isFinite(remainingSeconds)) return MAX_VOICE_DURATION_MS;
  return Math.max(MIN_VOICE_DURATION_MS, Math.min(MAX_VOICE_DURATION_MS, Math.floor(remainingSeconds) * 1000));
}

export type RecordingVerdict = 'ok' | 'tooShort' | 'silent';

export function evaluateRecording(durationMs: number, meter: MeterStats): RecordingVerdict {
  if (!(durationMs >= MIN_VOICE_DURATION_MS)) return 'tooShort';
  const meterReliable =
    meter.samples >= MIN_METER_SAMPLES && meter.maxDb - meter.minDb >= MIN_METER_SPREAD_DB;
  if (meterReliable && meter.peakLevel < SILENCE_PEAK_THRESHOLD) return 'silent';
  return 'ok';
}

/** Stable per-recording key so a retried upload is recognised by the server. */
export function makeVoiceIdempotencyKey(): string {
  return `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
