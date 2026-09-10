/**
 * One 1Hz ticker shared by every visible LiveMatchClock.
 * Bounded: N live rows → 1 interval, cleaned up when the last subscriber leaves.
 */

import { AppState, type NativeEventSubscription } from 'react-native';

type TickListener = () => void;

const listeners = new Set<TickListener>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let intervalStartCount = 0;

function notify(): void {
  for (const listener of listeners) listener();
}

function startInterval(): void {
  if (intervalId != null) return;
  intervalStartCount += 1;
  intervalId = setInterval(notify, 1000);
}

function stopInterval(): void {
  if (intervalId == null) return;
  clearInterval(intervalId);
  intervalId = null;
}

function onAppState(next: string): void {
  if (listeners.size === 0) return;
  if (next === 'active') {
    notify();
    startInterval();
    return;
  }
  stopInterval();
}

function ensureAppState(): void {
  if (appStateSub != null) return;
  if (typeof AppState?.addEventListener !== 'function') return;
  appStateSub = AppState.addEventListener('change', onAppState);
}

function releaseAppState(): void {
  appStateSub?.remove();
  appStateSub = null;
}

export function subscribeSharedSecondTicker(listener: TickListener): () => void {
  listeners.add(listener);
  ensureAppState();
  const state = typeof AppState?.currentState === 'string' ? AppState.currentState : 'active';
  if (state === 'active' || state === 'unknown') {
    startInterval();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopInterval();
      releaseAppState();
    }
  };
}

export function getSharedSecondTickerListenerCount(): number {
  return listeners.size;
}

export function isSharedSecondTickerRunning(): boolean {
  return intervalId != null;
}

export function getSharedSecondTickerStartCount(): number {
  return intervalStartCount;
}

/** Test-only: drop listeners/interval between cases. */
export function resetSharedSecondTickerForTests(): void {
  listeners.clear();
  stopInterval();
  releaseAppState();
  intervalStartCount = 0;
}
