import { useLiveFixtureStore } from '../../src/store/liveFixtureStore';
import { fixtureSignature } from './diagnosticsPrivacy';
import { recordDiagEvent } from './diagnosticsRecorder';
import { diagFlags, diagState, monoNow } from './diagnosticsState';

/**
 * 30-second render aggregates. Counters increment at the hook sites and one
 * summary event is emitted from the live-sync interval the app already runs.
 * The store subscription exists only while the render feature is on.
 */

const WINDOW_MS = 30_000;

interface RenderWindow {
  startedAtMono: number;
  rowRenders: number;
  redundantRenders: number;
  rowRenderMsSum: number;
  rowRenderMsMax: number;
  rowRenderSamples: number;
  storeSets: number;
  selectorRuns: number;
  selectorMsSampled: number;
  overlayRuns: number;
  overlayMsSum: number;
  overlayMsMax: number;
  groupMsMax: number;
  listCommits: number;
  rowCommits: number;
}

function emptyWindow(mono: number): RenderWindow {
  return {
    startedAtMono: mono,
    rowRenders: 0,
    redundantRenders: 0,
    rowRenderMsSum: 0,
    rowRenderMsMax: 0,
    rowRenderSamples: 0,
    storeSets: 0,
    selectorRuns: 0,
    selectorMsSampled: 0,
    overlayRuns: 0,
    overlayMsSum: 0,
    overlayMsMax: 0,
    groupMsMax: 0,
    listCommits: 0,
    rowCommits: 0,
  };
}

let window = emptyWindow(0);
const lastRowSig = new Map<string, string>();
let storeUnsub: (() => void) | null = null;

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function attachStore(): void {
  if (storeUnsub) return;
  storeUnsub = useLiveFixtureStore.subscribe(() => {
    if (diagFlags.render) window.storeSets += 1;
  });
}

function detachStore(): void {
  storeUnsub?.();
  storeUnsub = null;
}

export function noteMatchRowRendered(fixture: {
  id: string;
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
}): void {
  if (!diagFlags.render) return;
  window.rowRenders += 1;
  const sig = fixtureSignature({
    status: fixture.statusShort,
    elapsed: fixture.elapsed,
    extra: fixture.extra,
    home: fixture.homeScore,
    away: fixture.awayScore,
  });
  if (lastRowSig.get(fixture.id) === sig) window.redundantRenders += 1;
  else lastRowSig.set(fixture.id, sig);
}

export function noteMatchRowDuration(durationMs: number): void {
  if (!diagFlags.render || !Number.isFinite(durationMs) || durationMs < 0) return;
  window.rowRenderMsSum += durationMs;
  if (durationMs > window.rowRenderMsMax) window.rowRenderMsMax = durationMs;
  window.rowRenderSamples += 1;
}

export function noteRowCommitCount(): void {
  if (diagFlags.render) window.rowCommits += 1;
}

export function noteSelectorSample(durationMs: number): void {
  if (!diagFlags.render || !Number.isFinite(durationMs) || durationMs < 0) return;
  window.selectorRuns += 1;
  window.selectorMsSampled += durationMs;
}

export function noteOverlayDuration(durationMs: number): void {
  if (!diagFlags.render || !Number.isFinite(durationMs) || durationMs < 0) return;
  window.overlayRuns += 1;
  window.overlayMsSum += durationMs;
  if (durationMs > window.overlayMsMax) window.overlayMsMax = durationMs;
}

export function noteGroupDuration(durationMs: number): void {
  if (!diagFlags.render || !Number.isFinite(durationMs) || durationMs < 0) return;
  if (durationMs > window.groupMsMax) window.groupMsMax = durationMs;
}

export function noteListCommit(): void {
  if (diagFlags.render) window.listCommits += 1;
}

export function noteListLoad(list: string, elapsedMs: number): void {
  if (!diagFlags.render) return;
  recordDiagEvent('list_load', {
    screen: 'matches',
    component: 'FlashList',
    data: { list: list.slice(0, 24), elapsedMs: Math.max(0, Math.round(elapsedMs)) },
  });
}

function selectorRate(): number {
  const rate = diagState.session?.config.sampling.selectorTiming;
  return typeof rate === 'number' ? rate : 0;
}

/** True for a sampled selector-equality call. False whenever render tracing is off. */
export function shouldTimeSelector(): boolean {
  if (!diagFlags.render) return false;
  const rate = selectorRate();
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return Math.random() < rate;
}

function flushWindow(nowMono: number): void {
  const current = window;
  window = emptyWindow(nowMono);
  recordDiagEvent('render_window', {
    screen: 'matches',
    data: {
      windowMs: Math.max(0, Math.round(nowMono - current.startedAtMono)),
      rowRenders: current.rowRenders,
      redundantRenders: current.redundantRenders,
      rowRenderMsSum: round(current.rowRenderMsSum),
      rowRenderMsMax: round(current.rowRenderMsMax),
      rowRenderSamples: current.rowRenderSamples,
      storeSets: current.storeSets,
      selectorRuns: current.selectorRuns,
      selectorMsSampled: round(current.selectorMsSampled),
      overlayRuns: current.overlayRuns,
      overlayMsSum: round(current.overlayMsSum),
      overlayMsMax: round(current.overlayMsMax),
      groupMsMax: round(current.groupMsMax),
      listCommits: current.listCommits,
      rowCommits: current.rowCommits,
    },
  });
}

function windowHasActivity(current: RenderWindow): boolean {
  return (
    current.rowRenders + current.storeSets + current.overlayRuns + current.listCommits + current.rowCommits + current.selectorRuns >
    0
  );
}

export function renderHostTick(nowMono: number = monoNow(), force = false): void {
  if (!diagFlags.render) {
    detachStore();
    return;
  }
  attachStore();
  if (window.startedAtMono === 0) window.startedAtMono = nowMono;
  if (force) {
    if (windowHasActivity(window)) flushWindow(nowMono);
    return;
  }
  if (nowMono - window.startedAtMono >= WINDOW_MS) flushWindow(nowMono);
}

export function resetRenderForTests(): void {
  detachStore();
  window = emptyWindow(0);
  lastRowSig.clear();
}
