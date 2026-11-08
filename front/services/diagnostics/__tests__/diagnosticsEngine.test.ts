jest.mock('../../sentry.service', () => ({
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
}));
jest.mock('../../../utils/expoObserveSafe', () => ({
  readObserveStoredEntries: jest.fn(async () => []),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { getDiagSessionHeader, recordDiagEvent } from '../diagnosticsRecorder';
import { resetPersistenceForTests } from '../diagnosticsPersistence';
import { diagFlags, diagState, resetDiagStateForTests } from '../diagnosticsState';
import {
  diagnosticsHostTick,
  onDiagnosticsSessionChange,
  requestDiagnosticsDirective,
  resetDiagnosticsSessionForTests,
  startDiagnosticsEngine,
} from '../diagnosticsSession';
import { flushDiagnostics, resetUploaderForTests, setDiagnosticsApiBaseForTests } from '../diagnosticsUploader';

jest.mock('react-native', () => {
  const listeners: ((state: string) => void)[] = [];
  return {
    Platform: { OS: 'ios', Version: '18.1' },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn((_type: string, cb: (state: string) => void) => {
        listeners.push(cb);
        return {
          remove: () => {
            const index = listeners.indexOf(cb);
            if (index >= 0) listeners.splice(index, 1);
          },
        };
      }),
      __emit: (state: string) => listeners.slice().forEach((cb) => cb(state)),
    },
  };
});
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.1.4', nativeBuildVersion: '180' }));
jest.mock('expo-updates', () => ({ runtimeVersion: '1.1.4', updateId: null, channel: 'diagnostic' }));

const storage = AsyncStorage as unknown as {
  __resetStore(): void;
  __getStore(): Record<string, string>;
  getItem: jest.Mock;
  setItem: jest.Mock;
  multiSet: jest.Mock;
  multiGet: jest.Mock;
  multiRemove: jest.Mock;
};
const appState = AppState as unknown as { addEventListener: jest.Mock; __emit(state: string): void };
const netInfo = NetInfo as unknown as { addEventListener: jest.Mock };

const API = 'https://api.test/api';
const SESSION_ID = '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d';
const T0 = Date.UTC(2026, 10, 8, 20, 0, 0);
const MIN = 60_000;

interface FakeResponse {
  status: number;
  json?: unknown;
  headers?: Record<string, string>;
  /** Never resolves until the request is aborted. */
  hang?: boolean;
}
type Route = (body: any, init: RequestInit) => FakeResponse;

const routes: { directive: Route; events: Route } = {
  directive: () => ({ status: 200, json: { active: false, serverNow: Date.now() } }),
  events: (body) => ack(body),
};

const fetchMock = jest.fn((url: string, init: RequestInit) => {
  const body = init.body ? JSON.parse(String(init.body)) : null;
  const route = url === `${API}/diagnostics/directive` ? routes.directive : url === `${API}/diagnostics/events` ? routes.events : null;
  if (!route) return Promise.reject(new Error(`unexpected url ${url}`));
  const response = route(body, init);
  if (response.hang) {
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  }
  return Promise.resolve({
    status: response.status,
    json: async () => response.json ?? {},
    headers: { get: (key: string) => response.headers?.[key] ?? null },
  } as unknown as Response);
});

function directiveActive(overrides: Record<string, unknown> = {}): FakeResponse {
  const now = Date.now();
  return {
    status: 200,
    json: {
      active: true,
      sessionId: SESSION_ID,
      token: 'v1.session.device.123.sig',
      expiresAt: now + 30 * MIN,
      expiresInMs: 30 * MIN,
      uploadUntil: now + 30 * MIN + 24 * 3600_000,
      serverNow: now,
      config: {
        maxEvents: 20000,
        features: { pipeline: true, render: false, clock: true, sentryTags: true, observe: false, backendTrace: true },
        sampling: { pipeline: 1, render: 1, selectorTiming: 0.1 },
      },
      ...overrides,
    },
  };
}

function ack(body: { events: unknown[] }, overrides: Record<string, unknown> = {}): FakeResponse {
  const now = Date.now();
  return {
    status: 200,
    json: {
      ok: true,
      accepted: body.events.length,
      duplicates: 0,
      rejected: [],
      sessionState: 'active',
      maxEventsRemaining: 10_000,
      serverRecvAt: now,
      serverSendAt: now,
      ...overrides,
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 25; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

const eventCalls = () => fetchMock.mock.calls.filter(([url]) => url === `${API}/diagnostics/events`);
const directiveCalls = () => fetchMock.mock.calls.filter(([url]) => url === `${API}/diagnostics/directive`);
const sentEvents = () =>
  eventCalls().flatMap(([, init]) => (JSON.parse(String(init.body)) as { events: { type: string; data: any; eventId: string; seq: number }[] }).events);

function resetEngine(): void {
  resetDiagnosticsSessionForTests();
  resetUploaderForTests();
  resetPersistenceForTests();
  resetDiagStateForTests();
  setDiagnosticsApiBaseForTests(API);
}

async function startActive(): Promise<void> {
  routes.directive = () => directiveActive();
  await startDiagnosticsEngine();
  await settle();
}

beforeAll(() => {
  (global as { fetch: unknown }).fetch = fetchMock;
});

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.setSystemTime(T0);
  storage.__resetStore();
  jest.clearAllMocks();
  routes.directive = () => ({ status: 200, json: { active: false, serverNow: Date.now() } });
  routes.events = (body) => ack(body);
  resetEngine();
  process.env.EXPO_PUBLIC_DIAGNOSTICS = '1';
});

afterEach(() => {
  resetEngine();
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_DIAGNOSTICS;
});

describe('disabled build', () => {
  it('does no network, storage or listener work and records nothing', async () => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTICS;
    await startDiagnosticsEngine();
    recordDiagEvent('screen_focus', { data: { focused: true } });
    diagnosticsHostTick('sync', 5000);
    await flushDiagnostics();
    await requestDiagnosticsDirective('foreground');
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    for (const fn of [storage.getItem, storage.setItem, storage.multiSet, storage.multiGet, storage.multiRemove]) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(appState.addEventListener).not.toHaveBeenCalled();
    expect(netInfo.addEventListener).not.toHaveBeenCalled();
    expect(diagState.queue.size).toBe(0);
    expect(Object.values(diagFlags).every((flag) => flag === false)).toBe(true);
    expect(getDiagSessionHeader()).toBeNull();
  });
});

describe('capable build without a session', () => {
  it('asks for a directive once and stays idle when none is active', async () => {
    await startDiagnosticsEngine();
    await settle();
    expect(directiveCalls()).toHaveLength(1);
    const [, init] = directiveCalls()[0];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ schemaVersion: 1, app: { version: '1.1.4', build: '180', platform: 'ios', channel: 'diagnostic' } });
    expect(body.deviceId).toMatch(/^d_[A-Za-z0-9]{20}$/);
    expect(init.headers).not.toHaveProperty('Authorization');

    recordDiagEvent('screen_focus', { data: { focused: true } });
    diagnosticsHostTick('sync', 5000);
    await settle();
    expect(diagState.queue.size).toBe(0);
    expect(eventCalls()).toHaveLength(0);
    expect(diagFlags.active).toBe(false);
  });

  it('treats a 404 (server switch off) as no session', async () => {
    routes.directive = () => ({ status: 404, json: { error: 'not_found' } });
    await startDiagnosticsEngine();
    await settle();
    expect(diagFlags.active).toBe(false);
    expect(diagState.session).toBeNull();
  });

  it('debounces foreground directive checks to one per minute', async () => {
    await startDiagnosticsEngine();
    await settle();
    appState.__emit('background');
    appState.__emit('active');
    await settle();
    expect(directiveCalls()).toHaveLength(1);

    jest.advanceTimersByTime(61_000);
    appState.__emit('background');
    appState.__emit('active');
    await settle();
    expect(directiveCalls()).toHaveLength(2);
  });
});

describe('active session', () => {
  it('records, persists and uploads with the session token', async () => {
    const changes: unknown[] = [];
    onDiagnosticsSessionChange((info) => changes.push(info));
    await startActive();

    expect(diagFlags).toMatchObject({ active: true, pipeline: true, render: false, clock: true, observe: false });
    expect(getDiagSessionHeader()).toBe(SESSION_ID);
    expect(changes).toEqual([expect.objectContaining({ sessionId: SESSION_ID, recording: true })]);
    expect(storage.__getStore()['@90plus_diag_meta']).toBeDefined();
    expect(storage.__getStore()['@90plus_diag_meta']).toContain(SESSION_ID);

    recordDiagEvent('screen_focus', { screen: 'matches', data: { focused: true } });
    diagnosticsHostTick('sync', 5000);
    await settle();

    expect(eventCalls()).toHaveLength(1);
    const [, init] = eventCalls()[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Diag v1.session.device.123.sig');
    const envelope = JSON.parse(String(init.body));
    expect(envelope).toMatchObject({ schemaVersion: 1, sessionId: SESSION_ID, deviceId: diagState.deviceId });
    expect(envelope.batchId).toMatch(/^b_[A-Za-z0-9]{12}$/);
    expect(envelope.events.map((event: { type: string }) => event.type)).toEqual(['session_start', 'screen_focus']);
    expect(envelope.events[0].data).toMatchObject({ reason: 'cold_start', seqStart: 1 });
    expect(envelope.events[1]).toMatchObject({ seq: 2, screen: 'matches', priority: 'normal' });
    expect(diagState.queue.size).toBe(1);
    expect(diagState.queue.entries()[0].event.type).toBe('clock_offset_sample');
  });

  it('ends the session when the server directive turns inactive and drains the queue', async () => {
    await startActive();
    jest.advanceTimersByTime(61_000);
    routes.directive = () => ({ status: 200, json: { active: false, serverNow: Date.now() } });
    appState.__emit('background');
    appState.__emit('active');
    await settle();
    await flushDiagnostics({ maxBatches: 3 });
    await settle();

    expect(diagFlags.active).toBe(false);
    const end = sentEvents().find((event) => event.type === 'session_end');
    expect(end?.data).toMatchObject({ reason: 'stopped' });
    await flushDiagnostics();
    expect(diagState.session).toBeNull();
    expect(storage.__getStore()['@90plus_diag_meta']).toBeUndefined();
  });

  it('expires on the device clock without any timer and records the end', async () => {
    await startActive();
    jest.advanceTimersByTime(31 * MIN);
    recordDiagEvent('screen_focus', { data: { focused: true } });
    expect(diagFlags.active).toBe(false);
    const types = diagState.queue.entries().map((entry) => entry.event.type);
    expect(types).toContain('session_end');
    expect(types).not.toContain('screen_focus');
    const end = diagState.queue.entries().find((entry) => entry.event.type === 'session_end');
    expect(end?.event.data).toMatchObject({ reason: 'expired' });
  });

  it('ends with max_events when the server reports the cap', async () => {
    routes.events = (body) => ack(body, { sessionState: 'capped' });
    await startActive();
    await flushDiagnostics();
    await settle();
    expect(diagFlags.active).toBe(false);
    const end = sentEvents().find((event) => event.type === 'session_end');
    expect(end?.data).toMatchObject({ reason: 'max_events' });
  });

  it('reports host interval lateness as a JS stall', async () => {
    await startActive();
    diagnosticsHostTick('sync', 5000);
    jest.advanceTimersByTime(5400);
    diagnosticsHostTick('sync', 5000);
    const stall = diagState.queue.entries().find((entry) => entry.event.type === 'js_stall');
    expect(stall?.event.data).toEqual({ host: 'sync', latenessMs: 400, expectedMs: 5000 });
  });
});

describe('delivery', () => {
  it('backs off on 503, honours Retry-After and resends the same batch id', async () => {
    let status = 503;
    routes.events = (body) => (status === 503 ? { status: 503, headers: { 'Retry-After': '30' } } : ack(body));
    await startActive();
    await flushDiagnostics();
    expect(eventCalls()).toHaveLength(1);
    expect(diagState.backoffMs).toBeGreaterThanOrEqual(30_000);

    jest.advanceTimersByTime(10_000);
    await flushDiagnostics();
    expect(eventCalls()).toHaveLength(1);

    status = 200;
    jest.advanceTimersByTime(25_000);
    await flushDiagnostics();
    expect(eventCalls()).toHaveLength(2);
    const [first, second] = eventCalls().map(([, init]) => JSON.parse(String(init.body)));
    expect(second.batchId).toBe(first.batchId);
    expect(second.events.map((event: { eventId: string }) => event.eventId)).toEqual(
      first.events.map((event: { eventId: string }) => event.eventId),
    );
    expect(diagState.flushFailures).toBe(1);
  });

  it('does not send while offline and flushes on reconnect', async () => {
    await startActive();
    const listener = netInfo.addEventListener.mock.calls[0][0] as (state: { isConnected: boolean; isInternetReachable: boolean }) => void;
    listener({ isConnected: false, isInternetReachable: false });
    await flushDiagnostics();
    expect(eventCalls()).toHaveLength(0);

    listener({ isConnected: true, isInternetReachable: true });
    await settle();
    expect(eventCalls()).toHaveLength(1);
  });

  it('halves the batch after 413 and keeps every event', async () => {
    let first = true;
    routes.events = (body) => {
      if (first) {
        first = false;
        return { status: 413 };
      }
      return ack(body);
    };
    await startActive();
    for (let i = 0; i < 260; i += 1) recordDiagEvent('screen_focus', { data: { focused: i % 2 === 0 } });
    await settle();
    await flushDiagnostics({ maxBatches: 10 });

    const bodies = eventCalls().map(([, init]) => JSON.parse(String(init.body)) as { events: { eventId: string }[] });
    expect(bodies[0].events).toHaveLength(200);
    expect(Math.max(...bodies.slice(1).map((body) => body.events.length))).toBeLessThanOrEqual(100);
    const delivered = new Set(bodies.slice(1).flatMap((body) => body.events.map((event) => event.eventId)));
    for (const event of bodies[0].events) expect(delivered).toContain(event.eventId);
    // session_start + 260 recorded events, all delivered after the split.
    expect(sentEvents().slice(200).filter((event) => event.type !== 'clock_offset_sample')).toHaveLength(261);
    expect(diagState.queue.size).toBe(0);
  });

  it('abandons and deletes everything on 401', async () => {
    routes.events = () => ({ status: 401, json: { error: 'invalid_token' } });
    await startActive();
    await flushDiagnostics();
    await settle();
    expect(diagFlags.active).toBe(false);
    expect(diagState.session).toBeNull();
    expect(diagState.queue.size).toBe(0);
    expect(Object.keys(storage.__getStore()).filter((key) => key.startsWith('@90plus_diag_q_') || key === '@90plus_diag_meta')).toEqual([]);
  });

  it('drops a batch the server refuses with 400 instead of retrying it forever', async () => {
    routes.events = () => ({ status: 400, json: { error: 'invalid_envelope' } });
    await startActive();
    await flushDiagnostics();
    expect(diagState.queue.size).toBe(0);
    expect(diagState.rejectedByServer).toBe(1);
    await flushDiagnostics();
    expect(eventCalls()).toHaveLength(1);
  });

  it('aborts a stuck request on a later host tick and retries it', async () => {
    let hang = true;
    routes.events = (body) => (hang ? { status: 0, hang: true } : ack(body));
    await startActive();
    const pending = flushDiagnostics();
    await settle();
    expect(eventCalls()).toHaveLength(1);

    jest.advanceTimersByTime(31_000);
    diagnosticsHostTick('sync', 5000);
    await pending;
    expect(diagState.flushFailures).toBe(1);

    hang = false;
    jest.advanceTimersByTime(5 * MIN);
    await flushDiagnostics();
    expect(eventCalls()).toHaveLength(2);
    expect(diagState.queue.entries().map((entry) => entry.event.type)).not.toContain('session_start');
  });
});

describe('persistence across restarts', () => {
  it('restores unsent events and never reuses event ids', async () => {
    routes.events = () => ({ status: 503, headers: { 'Retry-After': '300' } });
    await startActive();
    for (let i = 0; i < 3; i += 1) recordDiagEvent('screen_focus', { data: { focused: true } });
    appState.__emit('background');
    await settle();
    const before = diagState.queue.entries().map((entry) => entry.event.eventId);
    const lastSeq = diagState.seq;

    // Simulated process restart: memory is gone, storage survives.
    resetEngine();
    routes.events = (body) => ack(body);
    routes.directive = () => directiveActive();
    await startDiagnosticsEngine();
    await settle();

    const after = diagState.queue.entries();
    const restoredIds = after.map((entry) => entry.event.eventId);
    for (const id of before) expect(restoredIds).toContain(id);
    const restart = after.find((entry) => entry.event.type === 'session_start' && entry.event.data.reason === 'restore');
    expect(restart?.event.data).toMatchObject({ restoredEvents: before.length });
    expect(restart!.event.seq).toBeGreaterThan(lastSeq);
    expect(new Set(restoredIds).size).toBe(restoredIds.length);
  });

  it('discards stored data once the upload window has closed', async () => {
    routes.events = () => ({ status: 503, headers: { 'Retry-After': '300' } });
    await startActive();
    appState.__emit('background');
    await settle();
    expect(storage.__getStore()['@90plus_diag_meta']).toBeDefined();

    resetEngine();
    routes.directive = () => ({ status: 200, json: { active: false, serverNow: Date.now() } });
    jest.advanceTimersByTime(25 * 3600_000);
    await startDiagnosticsEngine();
    await settle();
    expect(diagState.queue.size).toBe(0);
    expect(storage.__getStore()['@90plus_diag_meta']).toBeUndefined();
  });
});
