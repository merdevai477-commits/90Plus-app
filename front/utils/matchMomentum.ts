import type { FixtureEvent } from '../services/apiFootball';

export type MomentumSide = 'home' | 'away';

export type MomentumMarkerKind = 'goal' | 'card' | 'var' | 'subst' | 'corner';

export type MomentumMarker = {
  minute: number;
  side: MomentumSide;
  kind: MomentumMarkerKind;
  detail: string;
  /** Peak pressure used to place the icon (0–100). */
  intensity: number;
};

export type MomentumSeries = {
  /** Inclusive minutes 0..duration */
  duration: number;
  home: number[];
  away: number[];
  markers: MomentumMarker[];
};

export type MomentumCoverageInput = {
  events: FixtureEvent[];
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  /** Fixture clock minute when available. */
  matchElapsed?: number | null;
  finished?: boolean;
};

export type MomentumApiPayload = {
  available: boolean;
  duration: number;
  series: Array<{ minute: number; home: number; away: number }>;
  markers: MomentumMarker[];
};

/** Wire shape from JSON/API — `kind` may be a plain string. */
export type MomentumWirePayload = {
  available: boolean;
  duration: number;
  series: Array<{ minute: number; home: number; away: number }>;
  markers?: Array<{
    minute: number;
    side: string;
    kind: string;
    detail: string;
    intensity?: number;
  }>;
};

const MARKER_KINDS: readonly MomentumMarkerKind[] = [
  'goal',
  'card',
  'var',
  'subst',
  'corner',
];

function normalizeMarkerKind(kind: string): MomentumMarkerKind | null {
  return (MARKER_KINDS as readonly string[]).includes(kind)
    ? (kind as MomentumMarkerKind)
    : null;
}

function normalizeMarkerSide(side: string): MomentumSide | null {
  return side === 'home' || side === 'away' ? side : null;
}

const GOAL_WEIGHT = 38;
const RED_WEIGHT = 18;
const YELLOW_WEIGHT = 9;
const VAR_WEIGHT = 14;
const SUBST_WEIGHT = 5;
const CORNER_WEIGHT = 7;
const GAUSSIAN_SIGMA = 5;
const MAX_PRESSURE = 100;
const BASELINE = 8;
const MARKER_CAP = 14;

function isGoalEvent(e: FixtureEvent): boolean {
  return e.type === 'Goal' && !/missed penalty/i.test(e.detail ?? '');
}

function isCornerEvent(e: FixtureEvent): boolean {
  const blob = `${e.type ?? ''} ${e.detail ?? ''}`;
  return /corner/i.test(blob);
}

function isSignificantMarker(e: FixtureEvent): boolean {
  if (isGoalEvent(e)) return true;
  if (e.type === 'Card') return true;
  if (e.type === 'Var') return true;
  if (isCornerEvent(e)) return true;
  return false;
}

function eventWeight(e: FixtureEvent): number {
  if (isGoalEvent(e)) return GOAL_WEIGHT;
  if (isCornerEvent(e)) return CORNER_WEIGHT;
  if (e.type === 'Card') return /red/i.test(e.detail ?? '') ? RED_WEIGHT : YELLOW_WEIGHT;
  if (e.type === 'Var') return VAR_WEIGHT;
  if (e.type === 'subst') return SUBST_WEIGHT;
  return 0;
}

function markerKind(e: FixtureEvent): MomentumMarkerKind | null {
  if (isGoalEvent(e)) return 'goal';
  if (isCornerEvent(e)) return 'corner';
  if (e.type === 'Card') return 'card';
  if (e.type === 'Var') return 'var';
  if (e.type === 'subst') return 'subst';
  return null;
}

function resolveSide(
  e: FixtureEvent,
  homeTeamId?: number | null,
  awayTeamId?: number | null,
): MomentumSide | null {
  if (homeTeamId != null && e.team?.id === homeTeamId) return 'home';
  if (awayTeamId != null && e.team?.id === awayTeamId) return 'away';
  if (homeTeamId == null && awayTeamId == null) return 'home';
  return null;
}

function eventMinute(e: FixtureEvent): number | null {
  const elapsed = e.time?.elapsed;
  if (elapsed == null || !Number.isFinite(elapsed) || elapsed < 0) return null;
  const extra = e.time?.extra;
  if (extra != null && Number.isFinite(extra) && extra > 0 && elapsed >= 90) {
    return Math.min(105, elapsed + Math.min(extra, 15));
  }
  return Math.min(105, elapsed);
}

function countGoalEvents(events: FixtureEvent[]): number {
  return events.filter(isGoalEvent).length;
}

function gaussian(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/**
 * Hide the widget when the feed looks incomplete / too thin to draw a fair rhythm chart.
 */
export function hasMomentumEventCoverage(input: MomentumCoverageInput): boolean {
  const {
    events,
    homeTeamId,
    awayTeamId,
    homeGoals = 0,
    awayGoals = 0,
    matchElapsed = null,
    finished = false,
  } = input;

  if (!events?.length) return false;

  const timed = events.filter((e) => eventMinute(e) != null);
  if (timed.length < 2) return false;

  const withSide = timed.filter((e) => resolveSide(e, homeTeamId, awayTeamId) != null);
  if (withSide.length < 2) return false;

  const significant = withSide.filter(isSignificantMarker);
  if (significant.length < 2) return false;

  const scoreGoals = Math.max(0, Number(homeGoals) || 0) + Math.max(0, Number(awayGoals) || 0);
  const eventGoals = countGoalEvents(withSide);
  if (scoreGoals > 0 && eventGoals < scoreGoals) return false;

  const minutes = withSide.map((e) => eventMinute(e)!);
  const maxMin = Math.max(...minutes);
  const minMin = Math.min(...minutes);
  const span = maxMin - minMin;

  const clock =
    matchElapsed != null && Number.isFinite(matchElapsed)
      ? matchElapsed
      : finished
        ? 90
        : maxMin;

  if (finished || clock >= 70) {
    if (span < 20 && significant.length < 4) return false;
    const firstHalf = significant.filter((e) => (eventMinute(e) ?? 0) <= 45).length;
    const secondHalf = significant.filter((e) => (eventMinute(e) ?? 0) > 45).length;
    if ((firstHalf === 0 || secondHalf === 0) && significant.length < 4) return false;
    if (finished && maxMin < 40 && significant.length < 4) return false;
  }

  return true;
}

function smooth(values: number[], window = 3): number[] {
  if (values.length === 0) return values;
  const out = new Array(values.length);
  const half = Math.floor(window / 2);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= values.length) continue;
      sum += values[j];
      n += 1;
    }
    out[i] = sum / n;
  }
  return out;
}

function resolveDuration(
  usableMinutes: number[],
  matchElapsed: number | null,
  finished: boolean,
): number {
  const maxEventMin = usableMinutes.length ? Math.max(0, ...usableMinutes) : 0;
  const clock =
    matchElapsed != null && Number.isFinite(matchElapsed) ? matchElapsed : maxEventMin;
  return Math.max(
    finished ? 90 : Math.min(105, Math.max(45, Math.ceil(clock))),
    Math.min(105, Math.ceil(maxEventMin)),
    90,
  );
}

function pickMarkers(
  usable: Array<{
    minute: number;
    side: MomentumSide;
    kind: MomentumMarkerKind;
    detail: string;
    weight: number;
  }>,
  home: number[],
  away: number[],
  duration: number,
): MomentumMarker[] {
  const rank: Record<MomentumMarkerKind, number> = {
    goal: 0,
    card: 1,
    var: 2,
    corner: 3,
    subst: 4,
  };
  return usable
    .slice()
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.minute - b.minute)
    .slice(0, MARKER_CAP)
    .map((u) => {
      const minute = Math.min(duration, Math.round(u.minute));
      const series = u.side === 'home' ? home : away;
      return {
        minute,
        side: u.side,
        kind: u.kind,
        detail: u.detail,
        intensity: series[minute] ?? u.weight,
      };
    })
    .sort((a, b) => a.minute - b.minute);
}

/**
 * Build a mirrored home/away pressure series from discrete match events (no AI).
 * Each event is a Gaussian bump (σ ≈ 5 minutes), then lightly smoothed.
 */
export function buildMomentumFromEvents(input: MomentumCoverageInput): MomentumSeries | null {
  if (!hasMomentumEventCoverage(input)) return null;

  const { events, homeTeamId, awayTeamId, matchElapsed = null, finished = false } = input;

  const usable = events
    .map((e) => {
      const minute = eventMinute(e);
      const side = resolveSide(e, homeTeamId, awayTeamId);
      const weight = eventWeight(e);
      const kind = markerKind(e);
      if (minute == null || side == null || weight <= 0 || !kind) return null;
      return { minute, side, weight, kind, detail: e.detail ?? '' };
    })
    .filter(Boolean) as Array<{
    minute: number;
    side: MomentumSide;
    weight: number;
    kind: MomentumMarkerKind;
    detail: string;
  }>;

  const duration = resolveDuration(
    usable.map((u) => u.minute),
    matchElapsed,
    finished,
  );

  const homeRaw = new Array(duration + 1).fill(BASELINE);
  const awayRaw = new Array(duration + 1).fill(BASELINE);

  for (const u of usable) {
    const mu = Math.min(duration, u.minute);
    const target = u.side === 'home' ? homeRaw : awayRaw;
    const reach = Math.ceil(GAUSSIAN_SIGMA * 3);
    const from = Math.max(0, Math.floor(mu - reach));
    const to = Math.min(duration, Math.ceil(mu + reach));
    for (let m = from; m <= to; m++) {
      target[m] += u.weight * gaussian(m, mu, GAUSSIAN_SIGMA);
    }
  }

  const home = smooth(
    homeRaw.map((v) => Math.min(MAX_PRESSURE, v)),
    5,
  );
  const away = smooth(
    awayRaw.map((v) => Math.min(MAX_PRESSURE, v)),
    5,
  );

  return {
    duration,
    home,
    away,
    markers: pickMarkers(usable, home, away, duration),
  };
}

export function toMomentumApiPayload(series: MomentumSeries | null): MomentumApiPayload {
  if (!series) {
    return { available: false, duration: 90, series: [], markers: [] };
  }
  return {
    available: true,
    duration: series.duration,
    series: series.home.map((h, minute) => ({
      minute,
      home: h,
      away: series.away[minute] ?? 0,
    })),
    markers: series.markers,
  };
}

export function momentumSeriesFromPayload(
  payload: MomentumWirePayload | MomentumApiPayload | null | undefined,
): MomentumSeries | null {
  if (!payload?.available || !payload.series?.length) return null;
  const duration = Math.max(0, Math.round(payload.duration) || payload.series.length - 1);
  const home = new Array(duration + 1).fill(0);
  const away = new Array(duration + 1).fill(0);
  for (const pt of payload.series) {
    const m = Math.round(pt.minute);
    if (m < 0 || m > duration) continue;
    home[m] = pt.home;
    away[m] = pt.away;
  }
  const markers: MomentumMarker[] = [];
  for (const raw of payload.markers ?? []) {
    const kind = normalizeMarkerKind(String(raw.kind));
    const side = normalizeMarkerSide(String(raw.side));
    if (!kind || !side) continue;
    const minute = Math.min(duration, Math.max(0, Math.round(raw.minute)));
    markers.push({
      minute,
      side,
      kind,
      detail: String(raw.detail ?? ''),
      intensity:
        raw.intensity != null && Number.isFinite(raw.intensity)
          ? Number(raw.intensity)
          : (side === 'home' ? home[minute] : away[minute]) ?? 0,
    });
  }
  return {
    duration,
    home,
    away,
    markers,
  };
}

/** RTL timeline: 90' on the left, 0' on the right. */
export function minuteToXRtl(minute: number, duration: number, innerW: number, padX: number): number {
  const t = duration <= 0 ? 0 : minute / duration;
  return padX + (1 - t) * innerW;
}
