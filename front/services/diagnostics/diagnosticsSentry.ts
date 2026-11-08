import { diagFlags, diagState } from './diagnosticsState';
import { recordDiagEvent } from './diagnosticsRecorder';
import { addBreadcrumb, setContext, setTag } from '../sentry.service';
import type { DiagSessionInfo } from './diagnosticsSession';

/**
 * Sentry stays the error owner. A diagnostics session only tags events that
 * Sentry was already going to send, and stores the event id in the timeline.
 */

let appliedSessionId: string | null = null;

function clearTag(key: string): void {
  // Sentry treats an undefined tag value as removal on the current scope.
  setTag(key, undefined as unknown as string);
}

export function clearDiagnosticsSentry(): void {
  if (!appliedSessionId) return;
  clearTag('diag_session');
  clearTag('diag_screen');
  clearTag('diag_fixture');
  setContext('diagnostics', {});
  addBreadcrumb('diagnostics session ended', 'diagnostics', 'info', { sessionId: appliedSessionId });
  appliedSessionId = null;
}

export function syncSentryToSession(info: DiagSessionInfo | null): void {
  if (!info?.features.sentryTags || !diagFlags.sentryTags) {
    clearDiagnosticsSentry();
    return;
  }
  if (appliedSessionId === info.sessionId) return;
  appliedSessionId = info.sessionId;
  const app = diagState.app;
  setTag('diag_session', info.sessionId);
  setContext('diagnostics', {
    session: info.sessionId,
    build: app?.build ?? '',
    channel: app?.channel ?? '',
    updateId: app?.updateId ?? '',
    platform: app?.platform ?? '',
  });
  addBreadcrumb('diagnostics session started', 'diagnostics', 'info', { sessionId: info.sessionId });
}

export function setDiagnosticsScreen(screen: string): void {
  if (!diagFlags.sentryTags) return;
  setTag('diag_screen', screen.slice(0, 32));
}

export function setDiagnosticsFixture(fixtureId: number | null): void {
  if (!diagFlags.sentryTags) return;
  if (fixtureId && fixtureId > 0) setTag('diag_fixture', String(fixtureId));
  else clearTag('diag_fixture');
}

const LEVELS = new Set(['fatal', 'error', 'warning', 'info', 'debug', 'log']);

/** Called from Sentry beforeSend. Never includes the message or the request body. */
export function noteSentryEventForDiagnostics(event: {
  event_id?: string;
  level?: string;
  exception?: { values?: Array<{ type?: string }> };
}): void {
  if (!diagFlags.sentryTags) return;
  const sentryEventId = event.event_id ?? '';
  if (!/^[a-f0-9]{32}$/.test(sentryEventId)) return;
  const level = LEVELS.has(event.level ?? '') ? event.level! : 'error';
  const exceptionType = event.exception?.values?.[0]?.type?.replace(/[^\w.$:]/g, '').slice(0, 96);
  recordDiagEvent('sentry_event_ref', {
    severity: level === 'fatal' || level === 'error' ? 'error' : 'info',
    data: {
      sentryEventId,
      level,
      ...(exceptionType ? { exceptionType } : {}),
    },
  });
}

export function resetDiagnosticsSentryForTests(): void {
  appliedSessionId = null;
}
