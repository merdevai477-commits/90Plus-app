jest.mock('../../sentry.service', () => ({
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

import { addBreadcrumb, setContext, setTag } from '../../sentry.service';
import {
  clearDiagnosticsSentry,
  noteSentryEventForDiagnostics,
  resetDiagnosticsSentryForTests,
  syncSentryToSession,
} from '../diagnosticsSentry';
import { recordObserveSummary } from '../diagnosticsObserve';
import { diagFlags, diagState, resetDiagStateForTests } from '../diagnosticsState';

jest.mock('../../../utils/expoObserveSafe', () => ({
  readObserveStoredEntries: jest.fn(async () => [
    { sessionId: 'obs-1', name: 'tti', value: 1200 },
    { sessionId: 'not valid', name: 'user typed', value: 1 },
  ]),
}));

const sentry = { setTag, setContext, addBreadcrumb } as {
  setTag: jest.Mock;
  setContext: jest.Mock;
  addBreadcrumb: jest.Mock;
};

function enable(): void {
  resetDiagStateForTests();
  resetDiagnosticsSentryForTests();
  diagFlags.active = true;
  diagFlags.sentryTags = true;
  diagFlags.observe = true;
  diagState.recording = true;
  diagState.deviceId = 'd_abcdefghij1234567890';
  diagState.app = {
    version: '1.1.4',
    build: '180',
    platform: 'ios',
    channel: 'diagnostic',
    updateId: null,
    environment: 'production',
  };
  diagState.session = {
    id: '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d',
    token: 'token',
    config: {
      maxEvents: 1000,
      features: { pipeline: false, render: false, clock: false, sentryTags: true, observe: true, backendTrace: false },
      sampling: { pipeline: 0, render: 0, selectorTiming: 0 },
    },
    expiresAtMono: Number.POSITIVE_INFINITY,
    expiresAtWall: Date.now() + 60_000,
    uploadUntilWall: Date.now() + 60_000,
    startedAtWall: Date.now(),
    startedAtMono: 0,
  };
}

describe('diagnostics sentry and observe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    enable();
  });

  it('tags the session and clears the tag when the session ends', () => {
    const info = {
      sessionId: diagState.session!.id,
      recording: true,
      features: diagState.session!.config.features,
    };
    syncSentryToSession(info);
    syncSentryToSession(info);
    expect(sentry.setTag).toHaveBeenCalledTimes(1);
    expect(sentry.setTag).toHaveBeenCalledWith('diag_session', info.sessionId);
    expect(sentry.setContext).toHaveBeenCalledWith('diagnostics', expect.objectContaining({ build: '180', platform: 'ios' }));
    expect(JSON.stringify(sentry.setContext.mock.calls)).not.toContain('@');

    clearDiagnosticsSentry();
    expect(sentry.setTag).toHaveBeenCalledWith('diag_session', undefined);
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
      'diagnostics session ended',
      'diagnostics',
      'info',
      expect.objectContaining({ sessionId: info.sessionId }),
    );
  });

  it('stores a sentry event id without the message', () => {
    noteSentryEventForDiagnostics({
      event_id: 'a'.repeat(32),
      level: 'error',
      exception: { values: [{ type: 'TypeError' }] },
    } as { event_id: string; level: string; exception: { values: Array<{ type: string }> } });
    const event = diagState.queue.entries()[0].event;
    expect(event.type).toBe('sentry_event_ref');
    expect(event.data).toEqual({ sentryEventId: 'a'.repeat(32), level: 'error', exceptionType: 'TypeError' });
  });

  it('summarizes stored Observe entries and drops free text', async () => {
    await recordObserveSummary();
    const event = diagState.queue.entries()[0].event;
    expect(event.type).toBe('observe_entries_summary');
    expect(event.data).toEqual({ count: 2, observeSessionIds: ['obs-1'], metrics: { tti: 1200 } });
  });
});
