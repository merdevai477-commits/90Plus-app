/**
 * Phase 0A client clock baseline. Off unless EXPO_PUBLIC_CLOCK_BASELINE=1.
 * Records into a bounded ring buffer only. Never uploads and never calls Sentry.
 * Does not own match data and does not tick on its own.
 */

import type { LiveDisplayClockInput } from './liveDisplayClock';
import { resolveLiveDisplayClock } from './liveDisplayClock';
import { diagFlags } from '../services/diagnostics/diagnosticsState';

export const CLOCK_BASELINE_CAPACITY = 2000;
export const CLOCK_BASELINE_FLUSH_MS = 30_000;
export const TICK_INTERVAL_MS = 1000;
export const MISSED_TICK_GAP_MS = 1500;
const LIST_MINUTE_CAP = 64;

export type ClockBaselineEvent = {
  sessionId: string;
  type: string;
  t: string;
  mono: number;
  [key: string]: unknown;
};

export type ClockBaselineSession = {
  sessionId: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  fixtureId: string | null;
};

type RenderKey = 'detailsHeader' | 'clockHook' | 'listRow';

type ListMinuteRow = {
  displayedMinute: number | null;
  serverElapsed: number | null;
};

const buffer: ClockBaselineEvent[] = [];
let droppedEvents = 0;
let session: ClockBaselineSession | null = null;
let sessionAnnounced = false;
let tickerSeq = 0;
let lastTickMono: number | null = null;
let lastSubscriberCount = 0;
let lastFlushMono = 0;
let lifecycleSub: { remove: () => void } | null = null;
let awaitingForegroundSample = false;
let foregroundAtMono: number | null = null;
let lastTickBeforeBackgroundMono: number | null = null;
let lastAppState = '';
let lastAppStateMono = -1e15;
/** Test seam. `undefined` means read the focused fixture from Zustand. */
let focusedFixtureForTests: string | null | undefined;
const lastPresentationSeq = new Map<string, number>();
const lastReanchorKey = new Map<string, string>();
const mountedLiveRows = new Set<string>();
const listMinutes = new Map<string, ListMinuteRow>();
const intervalCounts: Record<RenderKey, number> = { detailsHeader: 0, clockHook: 0, listRow: 0 };
const totalCounts: Record<RenderKey, number> = { detailsHeader: 0, clockHook: 0, listRow: 0 };

export function isClockBaselineEnabled(): boolean {
  if (diagFlags.clock) return true;
  const flag = process.env.EXPO_PUBLIC_CLOCK_BASELINE;
  return flag === '1' || flag === 'true';
}

export function monoNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return 0;
}

function epochIso(atMs = Date.now()): string {
  return new Date(atMs).toISOString();
}

function createSessionId(): string {
  return `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readPlatform(): { platform: string; osVersion: string } {
  try {
    const { Platform } = require('react-native') as typeof import('react-native');
    return {
      platform: String(Platform?.OS ?? 'unknown'),
      osVersion: String(Platform?.Version ?? 'unknown'),
    };
  } catch {
    return { platform: 'unknown', osVersion: 'unknown' };
  }
}

function readAppVersion(): string {
  try {
    const Constants = require('expo-constants').default as {
      expoConfig?: { version?: string };
      nativeAppVersion?: string | null;
    };
    return Constants?.expoConfig?.version ?? Constants?.nativeAppVersion ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function setClockBaselineFocusedFixtureForTests(fixtureId: string | null | undefined): void {
  focusedFixtureForTests = fixtureId;
}

function readFocusedFixtureId(): string | null {
  if (focusedFixtureForTests !== undefined) return focusedFixtureForTests;
  try {
    const { useLiveFixtureStore } = require('../src/store/liveFixtureStore') as typeof import('../src/store/liveFixtureStore');
    const id = useLiveFixtureStore.getState().focusedFixtureId;
    return id == null ? null : String(id);
  } catch {
    return null;
  }
}

function publishDumpHandle(): void {
  (globalThis as { __dumpClockBaseline?: () => string }).__dumpClockBaseline = exportClockBaselineJsonl;
}

type ClockSink = (type: 'clock_summary' | 'clock_reanchor' | 'list_minute_mismatch', data: Record<string, unknown>, fixtureId?: number) => void;
let clockSink: ClockSink | null = null;
let reanchorsInWindow = 0;

/** Diagnostics sessions register this. The env-flag baseline never uploads. */
export function setClockBaselineSink(next: ClockSink | null): void {
  clockSink = next;
}

function forwardClock(type: 'clock_summary' | 'clock_reanchor' | 'list_minute_mismatch', data: Record<string, unknown>, fixtureId?: number): void {
  if (!diagFlags.clock || !clockSink) return;
  try {
    clockSink(type, data, fixtureId);
  } catch {
    /* the clock must not depend on diagnostics */
  }
}

function push(partial: Omit<ClockBaselineEvent, 'sessionId' | 't' | 'mono'> & { mono?: number; t?: string }): void {
  if (!session) return;
  const event = {
    ...partial,
    sessionId: session.sessionId,
    t: partial.t ?? epochIso(),
    mono: partial.mono ?? monoNow(),
  } as ClockBaselineEvent;
  if (buffer.length >= CLOCK_BASELINE_CAPACITY) {
    buffer.shift();
    droppedEvents += 1;
  }
  buffer.push(event);
}

function ensureSession(): void {
  if (!isClockBaselineEnabled()) return;
  if (!session) {
    const platform = readPlatform();
    session = {
      sessionId: createSessionId(),
      platform: platform.platform,
      osVersion: platform.osVersion,
      appVersion: readAppVersion(),
      fixtureId: null,
    };
    push({ type: 'session', ...session, mono: monoNow() });
    ensureLifecycle();
    publishDumpHandle();
  }
  if (!sessionAnnounced) {
    sessionAnnounced = true;
    console.info(
      `[CLOCK-BASELINE] session ${session.sessionId} recording in memory. Call __dumpClockBaseline() for JSONL. Not sent to Sentry.`,
    );
  }
}

function ensureLifecycle(): void {
  if (lifecycleSub || !isClockBaselineEnabled()) return;
  try {
    const { AppState } = require('react-native') as typeof import('react-native');
    if (typeof AppState?.addEventListener !== 'function') return;
    const sub = AppState.addEventListener('change', (next: string) => {
      noteAppState(next);
    });
    if (sub && typeof sub.remove === 'function') lifecycleSub = sub;
  } catch {
    /* baseline must not affect the app */
  }
}

export function getClockBaselineSession(): ClockBaselineSession | null {
  return session ? { ...session } : null;
}

export function exportClockBaselineJsonl(): string {
  return buffer.map((event) => JSON.stringify(event)).join('\n');
}

export function computeTickJitter(
  previousMono: number | null,
  actualMono: number,
): { expectedMono: number; jitterMs: number; missedTicks: number; gapMs: number | null } {
  if (previousMono == null || !Number.isFinite(previousMono)) {
    return { expectedMono: actualMono, jitterMs: 0, missedTicks: 0, gapMs: null };
  }
  const expectedMono = previousMono + TICK_INTERVAL_MS;
  const jitterMs = actualMono - expectedMono;
  const gapMs = actualMono - previousMono;
  const missedTicks =
    gapMs >= MISSED_TICK_GAP_MS ? Math.max(1, Math.round(gapMs / TICK_INTERVAL_MS) - 1) : 0;
  return { expectedMono, jitterMs, missedTicks, gapMs };
}

export function computePresentationDrift(args: {
  nowMs: number;
  anchorMs: number;
  actualDisplaySeconds: number | null;
  input: LiveDisplayClockInput;
}): { expectedDisplaySeconds: number | null; driftMs: number | null } {
  const expectedDisplaySeconds = resolveLiveDisplayClock({
    ...args.input,
    nowMs: args.nowMs,
    anchorMs: args.anchorMs,
  }).displaySeconds;
  if (expectedDisplaySeconds == null || args.actualDisplaySeconds == null) {
    return { expectedDisplaySeconds, driftMs: null };
  }
  return {
    expectedDisplaySeconds,
    driftMs: (args.actualDisplaySeconds - expectedDisplaySeconds) * 1000,
  };
}

export function parseDisplayedMinute(label: string): number | null {
  const match = /^\s*(\d+)/.exec(label);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function consumeForegroundRecovery(mono: number): number | null {
  if (!awaitingForegroundSample || foregroundAtMono == null) return null;
  awaitingForegroundSample = false;
  return mono - foregroundAtMono;
}

function listSummary(): {
  visibleLiveFixtures: number;
  listCompared: number;
  listMismatch: number;
  listMaxAbsDeltaMin: number;
  listSamples: Array<{
    fixtureId: string;
    displayedMinute: number;
    serverElapsed: number;
    deltaMin: number;
  }>;
} {
  let listCompared = 0;
  let listMismatch = 0;
  let listMaxAbsDeltaMin = 0;
  const listSamples: Array<{
    fixtureId: string;
    displayedMinute: number;
    serverElapsed: number;
    deltaMin: number;
  }> = [];
  for (const [fixtureId, row] of listMinutes) {
    if (row.displayedMinute == null || row.serverElapsed == null) continue;
    listCompared += 1;
    const deltaMin = row.displayedMinute - row.serverElapsed;
    if (deltaMin === 0) continue;
    listMismatch += 1;
    listMaxAbsDeltaMin = Math.max(listMaxAbsDeltaMin, Math.abs(deltaMin));
    if (listSamples.length < 8) {
      listSamples.push({
        fixtureId,
        displayedMinute: row.displayedMinute,
        serverElapsed: row.serverElapsed,
        deltaMin,
      });
    }
  }
  return {
    visibleLiveFixtures: mountedLiveRows.size,
    listCompared,
    listMismatch,
    listMaxAbsDeltaMin,
    listSamples,
  };
}

function maybeFlush(mono: number): void {
  if (lastFlushMono === 0) {
    lastFlushMono = mono;
    return;
  }
  if (mono - lastFlushMono < CLOCK_BASELINE_FLUSH_MS) return;
  const windowMs = mono - lastFlushMono;
  lastFlushMono = mono;
  const summary = listSummary();
  push({
    type: 'render_counters',
    mono,
    windowMs,
    detailsHeader: intervalCounts.detailsHeader,
    clockHook: intervalCounts.clockHook,
    listRow: intervalCounts.listRow,
    detailsHeaderTotal: totalCounts.detailsHeader,
    clockHookTotal: totalCounts.clockHook,
    listRowTotal: totalCounts.listRow,
    droppedEvents,
    subscribers: lastSubscriberCount,
    ...summary,
  });
  forwardClock('clock_summary', {
    windowMs: Math.round(windowMs),
    detailsRenders: intervalCounts.detailsHeader,
    listRows: summary.listCompared,
    listMismatches: summary.listMismatch,
    reanchors: reanchorsInWindow,
    droppedEvents,
  });
  for (const sample of summary.listSamples) {
    const fixtureId = Number(sample.fixtureId);
    forwardClock(
      'list_minute_mismatch',
      {
        label: String(sample.displayedMinute).slice(0, 16),
        elapsed: sample.serverElapsed,
        deltaMin: Math.max(-300, Math.min(300, sample.deltaMin)),
      },
      Number.isFinite(fixtureId) && fixtureId > 0 ? fixtureId : undefined,
    );
  }
  reanchorsInWindow = 0;
  intervalCounts.detailsHeader = 0;
  intervalCounts.clockHook = 0;
  intervalCounts.listRow = 0;
}

function bump(key: RenderKey): void {
  if (!isClockBaselineEnabled()) return;
  try {
    ensureSession();
    intervalCounts[key] += 1;
    totalCounts[key] += 1;
    maybeFlush(monoNow());
  } catch {
    /* baseline must not affect rendering */
  }
}

export function noteDetailsHeaderRender(): void {
  bump('detailsHeader');
}

export function noteClockHookRender(): void {
  bump('clockHook');
}

export function noteListRowRender(): void {
  bump('listRow');
}

export function noteLiveRowMounted(fixtureId: string): () => void {
  if (!isClockBaselineEnabled()) return () => undefined;
  try {
    ensureSession();
    mountedLiveRows.add(fixtureId);
    maybeFlush(monoNow());
  } catch {
    /* ignore */
  }
  return () => {
    mountedLiveRows.delete(fixtureId);
  };
}

export function noteListMinute(
  fixtureId: string,
  displayedLabel: string,
  serverElapsed: number | null | undefined,
): void {
  if (!isClockBaselineEnabled()) return;
  try {
    ensureSession();
    const mono = monoNow();
    if (listMinutes.size >= LIST_MINUTE_CAP && !listMinutes.has(fixtureId)) {
      const oldest = listMinutes.keys().next().value;
      if (oldest != null) listMinutes.delete(oldest);
    }
    listMinutes.set(fixtureId, {
      displayedMinute: parseDisplayedMinute(displayedLabel),
      serverElapsed:
        serverElapsed == null || !Number.isFinite(serverElapsed) ? null : serverElapsed,
    });
    const foregroundRecoveryMs = consumeForegroundRecovery(mono);
    if (foregroundRecoveryMs != null) {
      push({
        type: 'foreground_recovery',
        mono,
        source: 'list',
        foregroundRecoveryMs,
        lastTickBeforeBackgroundMono,
      });
    }
    maybeFlush(mono);
  } catch {
    /* baseline must not affect the list label */
  }
}

export function noteAppState(next: string): void {
  if (!isClockBaselineEnabled()) return;
  try {
    const mono = monoNow();
    if (lastAppState === next && mono - lastAppStateMono < 50) return;
    const prev = lastAppState;
    lastAppState = next;
    lastAppStateMono = mono;
    ensureSession();
    if (next !== 'active') {
      lastTickBeforeBackgroundMono = lastTickMono;
    }
    if ((prev === 'background' || prev === 'inactive') && next === 'active') {
      awaitingForegroundSample = true;
      foregroundAtMono = mono;
    }
    push({
      type: 'app_state',
      mono,
      prev: prev || null,
      next,
      atMs: Date.now(),
      lastTickMono,
      lastTickBeforeBackgroundMono: next === 'active' ? null : lastTickBeforeBackgroundMono,
      subscribers: lastSubscriberCount,
    });
  } catch {
    /* baseline must not affect lifecycle */
  }
}

/** One record per shared-ticker notification, regardless of subscriber count. */
export function recordTickerSample(subscribers: number): void {
  if (!isClockBaselineEnabled()) return;
  try {
    ensureSession();
    const actualMono = monoNow();
    const stats = computeTickJitter(lastTickMono, actualMono);
    const foregroundRecoveryMs = consumeForegroundRecovery(actualMono);
    const resumedFromBackground = foregroundRecoveryMs != null;
    lastTickMono = actualMono;
    lastSubscriberCount = subscribers;
    tickerSeq += 1;
    push({
      type: 'tick',
      mono: actualMono,
      seq: tickerSeq,
      expectedMono: stats.expectedMono,
      actualMono,
      jitterMs: resumedFromBackground ? 0 : stats.jitterMs,
      rawJitterMs: stats.jitterMs,
      missedTicks: resumedFromBackground ? 0 : stats.missedTicks,
      gapMs: stats.gapMs,
      subscribers,
      resumedFromBackground,
      foregroundRecoveryMs,
      lastTickBeforeBackgroundMono: resumedFromBackground ? lastTickBeforeBackgroundMono : null,
    });
    maybeFlush(actualMono);
  } catch {
    /* baseline must not affect the ticker */
  }
}

export function recordClockPresentation(args: {
  fixtureId: string;
  anchorMs: number;
  nowMs: number;
  actualDisplaySeconds: number | null;
  input: LiveDisplayClockInput;
  reanchored: boolean;
  reanchorReason: string | null;
  serverElapsed: number | null;
  statusShort: string | null;
}): void {
  if (!isClockBaselineEnabled()) return;
  try {
    ensureSession();
    const focusedId = readFocusedFixtureId();
    if (focusedId == null || focusedId !== args.fixtureId) return;
    if (session) session.fixtureId = args.fixtureId;
    const mono = monoNow();
    if (args.reanchored) {
      const reanchorKey = `${args.fixtureId}|${args.statusShort ?? ''}|${args.serverElapsed ?? ''}|${args.anchorMs}`;
      if (lastReanchorKey.get(args.fixtureId) !== reanchorKey) {
        lastReanchorKey.set(args.fixtureId, reanchorKey);
        push({
          type: 'reanchor',
          mono,
          fixtureId: args.fixtureId,
          anchorMs: args.anchorMs,
          reason: args.reanchorReason,
          serverElapsed: args.serverElapsed,
          statusShort: args.statusShort,
        });
        reanchorsInWindow += 1;
        const fixtureId = Number(args.fixtureId);
        forwardClock(
          'clock_reanchor',
          {
            reason: String(args.reanchorReason ?? 'unknown').replace(/[^\w\-:.]/g, '').slice(0, 32) || 'unknown',
            serverElapsed: args.serverElapsed,
            status: args.statusShort ? String(args.statusShort).slice(0, 8) : null,
          },
          Number.isFinite(fixtureId) && fixtureId > 0 ? fixtureId : undefined,
        );
      }
    }
    if (lastPresentationSeq.get(args.fixtureId) === tickerSeq) return;
    lastPresentationSeq.set(args.fixtureId, tickerSeq);
    const drift = computePresentationDrift({
      nowMs: args.nowMs,
      anchorMs: args.anchorMs,
      actualDisplaySeconds: args.actualDisplaySeconds,
      input: args.input,
    });
    const foregroundRecoveryMs = consumeForegroundRecovery(mono);
    push({
      type: 'clock',
      mono,
      fixtureId: args.fixtureId,
      anchorMs: args.anchorMs,
      nowMs: args.nowMs,
      serverElapsed: args.serverElapsed,
      statusShort: args.statusShort,
      expectedDisplaySeconds: drift.expectedDisplaySeconds,
      actualDisplaySeconds: args.actualDisplaySeconds,
      driftMs: drift.driftMs,
      renderLagMs: lastTickMono == null ? null : mono - lastTickMono,
      subSecondOffsetMs: Math.max(0, args.nowMs - args.anchorMs) % 1000,
      tickerSeq,
      foregroundRecoveryMs,
    });
    maybeFlush(mono);
  } catch {
    /* baseline must not affect the displayed clock */
  }
}

export function resetClockBaselineForTests(): void {
  buffer.length = 0;
  droppedEvents = 0;
  session = null;
  sessionAnnounced = false;
  tickerSeq = 0;
  lastTickMono = null;
  lastSubscriberCount = 0;
  lastFlushMono = 0;
  reanchorsInWindow = 0;
  clockSink = null;
  awaitingForegroundSample = false;
  foregroundAtMono = null;
  lastTickBeforeBackgroundMono = null;
  lastAppState = '';
  lastAppStateMono = -1e15;
  lastPresentationSeq.clear();
  lastReanchorKey.clear();
  mountedLiveRows.clear();
  listMinutes.clear();
  intervalCounts.detailsHeader = 0;
  intervalCounts.clockHook = 0;
  intervalCounts.listRow = 0;
  totalCounts.detailsHeader = 0;
  totalCounts.clockHook = 0;
  totalCounts.listRow = 0;
  lifecycleSub?.remove();
  lifecycleSub = null;
  focusedFixtureForTests = undefined;
  delete (globalThis as { __dumpClockBaseline?: () => string }).__dumpClockBaseline;
}
