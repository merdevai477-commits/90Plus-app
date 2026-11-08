import { clockEstimator, resetUploaderForTests } from '../diagnosticsUploader';
import {
  armWsMatchUpdate,
  clearWsArm,
  httpEndpointLabel,
  noteOverlayForFixtures,
  noteRowCommitForFixture,
  peekWsCapture,
  pipelineHostTick,
  recordHttpFetch,
  recordStoreOutcome,
  resetPipelineForTests,
} from '../diagnosticsPipeline';
import { diagFlags, diagState, monoNow, resetDiagStateForTests } from '../diagnosticsState';

const WALL = 1_780_000_000_000;

function enable(sampling = 1): void {
  resetDiagStateForTests();
  resetUploaderForTests();
  resetPipelineForTests();
  diagFlags.active = true;
  diagFlags.pipeline = true;
  diagState.recording = true;
  diagState.deviceId = 'd_abcdefghij1234567890';
  diagState.session = {
    id: '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d',
    token: 'token',
    config: {
      maxEvents: 1000,
      features: { pipeline: true, render: true, clock: false, sentryTags: false, observe: false, backendTrace: false },
      sampling: { pipeline: sampling, render: 1, selectorTiming: 1 },
    },
    expiresAtMono: Number.POSITIVE_INFINITY,
    expiresAtWall: WALL + 60_000,
    uploadUntilWall: WALL + 60_000,
    startedAtWall: WALL,
    startedAtMono: 0,
  };
}

function events() {
  return diagState.queue.entries().map((entry) => entry.event);
}

describe('pipeline traces', () => {
  beforeEach(() => enable());

  it('does nothing while the pipeline feature is off', () => {
    diagFlags.pipeline = false;
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 1,
      decision: 'applied',
      sigIn: '2H|10|null|0-0',
      recvWall: WALL,
      recvMono: 10,
    });
    pipelineHostTick(10_000, true);
    expect(diagState.queue.size).toBe(0);
  });

  it('keeps the envelope only for the synchronous listener turn', () => {
    armWsMatchUpdate({
      timestamp: WALL - 40,
      payload: { matchId: 9, status: '2H', minute: 67, extra: null, homeScore: 1, awayScore: 0 },
      trace: { id: 'tr-1', detectedAt: WALL - 80, gen: 4, instanceId: 'api-1' },
    });
    const capture = peekWsCapture(9);
    expect(capture).toMatchObject({
      fixtureId: 9,
      serverEmitAt: WALL - 40,
      traceId: 'tr-1',
      detectedAt: WALL - 80,
      traceGen: 4,
      instanceId: 'api-1',
      sigIn: '2H|67|null|1-0',
    });
    expect(peekWsCapture(8)).toBeNull();
    clearWsArm();
    expect(peekWsCapture(9)).toBeNull();
  });

  it('emits one trace with overlay and commit stamps and no missing-stage anomaly', () => {
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 9,
      decision: 'applied',
      sigBefore: '2H|66|null|1-0',
      sigIn: '2H|67|null|1-0',
      sigAfter: '2H|67|null|1-0',
      recvWall: WALL,
      recvMono: 100,
      traceId: 'tr-9',
      serverEmitAt: WALL - 30,
    });
    noteOverlayForFixtures(['9'], 140);
    noteRowCommitForFixture(9, 180);
    pipelineHostTick(10_000, true);
    const trace = events().find((event) => event.type === 'pipeline_trace');
    expect(trace?.data).toMatchObject({
      source: 'ws',
      decision: 'applied',
      sigBefore: '2H|66|null|1-0',
      overlayMono: 140,
      commitMono: 180,
    });
    expect(trace?.traceId).toBe('tr-9');
    expect(trace?.data).not.toHaveProperty('missingStages');
    expect(events().some((event) => event.type === 'pipeline_anomaly')).toBe(false);
  });

  it('reports a duplicate delivery and an out-of-order emit time', () => {
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 3,
      decision: 'applied',
      sigIn: '1H|10|null|0-0',
      sigAfter: '1H|10|null|0-0',
      recvWall: WALL,
      recvMono: 1,
      traceId: 'same',
      serverEmitAt: WALL,
    });
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 3,
      decision: 'applied',
      sigIn: '1H|10|null|0-0',
      sigAfter: '1H|10|null|0-0',
      recvWall: WALL + 1000,
      recvMono: 2,
      traceId: 'same',
      serverEmitAt: WALL + 1000,
    });
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 8,
      decision: 'applied',
      sigIn: '1H|20|null|0-0',
      sigAfter: '1H|20|null|0-0',
      recvWall: WALL,
      recvMono: 3,
      traceId: 'newer',
      serverEmitAt: WALL + 2000,
    });
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 8,
      decision: 'applied',
      sigIn: '1H|19|null|0-0',
      sigAfter: '1H|19|null|0-0',
      recvWall: WALL + 3000,
      recvMono: 4,
      traceId: 'older',
      serverEmitAt: WALL,
    });
    pipelineHostTick(10_000, true);
    const kinds = events()
      .filter((event) => event.type === 'pipeline_anomaly')
      .map((event) => event.data.kind);
    expect(kinds).toEqual(['duplicate', 'out_of_order']);
  });

  it('reports a skipped regression without calling it a confirmed cause', () => {
    recordStoreOutcome({
      source: 'http_fast',
      fixtureId: 4,
      decision: 'skipped',
      reason: 'goals_regression',
      sigBefore: '2H|60|null|2-1',
      sigIn: '2H|60|null|1-1',
      recvWall: WALL,
      recvMono: 1,
    });
    pipelineHostTick(10_000, true);
    const anomaly = events().find((event) => event.type === 'pipeline_anomaly');
    expect(anomaly?.data).toMatchObject({ kind: 'regression', detail: 'goals_regression', source: 'http_fast' });
  });

  it('reports delivery delay only together with its confidence bound', () => {
    clockEstimator.add({ t0: 0, t1: 0, t2: 0, t3: 0, offsetMs: 0, rttMs: 20, atMono: 1 });
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 5,
      decision: 'applied',
      sigIn: '2H|12|null|0-0',
      sigAfter: '2H|12|null|1-0',
      recvWall: WALL,
      recvMono: 50,
      serverEmitAt: WALL - 8_000,
    });
    pipelineHostTick(10_000, true);
    const anomaly = events().find((event) => event.data.kind === 'delayed');
    expect(anomaly?.data).toMatchObject({ latencyMs: 8000 });
    expect(anomaly?.data).not.toHaveProperty('detail');
  });

  it('flags a missing overlay only after the trace had time to render', () => {
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 6,
      decision: 'applied',
      sigIn: '2H|1|null|0-0',
      sigAfter: '2H|1|null|0-0',
      recvWall: WALL,
      recvMono: 10,
    });
    pipelineHostTick(monoNow() + 500);
    expect(events().some((event) => event.data.kind === 'missing_stage')).toBe(false);
    pipelineHostTick(monoNow() + 5_000, true);
    const anomaly = events().find((event) => event.data.kind === 'missing_stage');
    expect(String(anomaly?.data.detail)).toContain('overlay');
  });

  it('drops sampled applied updates when the session sampling rate is zero, and still keeps skips', () => {
    enable(0);
    recordStoreOutcome({
      source: 'ws',
      fixtureId: 1,
      decision: 'applied',
      sigIn: 'NS|null|null|0-0',
      recvWall: WALL,
      recvMono: 1,
    });
    recordStoreOutcome({
      source: 'http_fast',
      fixtureId: 1,
      decision: 'skipped',
      reason: 'stale_http',
      sigIn: 'NS|null|null|0-0',
      recvWall: WALL,
      recvMono: 1,
    });
    pipelineHostTick(10_000, true);
    const traces = events().filter((event) => event.type === 'pipeline_trace');
    expect(traces).toHaveLength(1);
    expect(traces[0].data).toMatchObject({ decision: 'skipped' });
  });

  it('labels list endpoints and records a fetch without the url', () => {
    expect(httpEndpointLabel('https://api.test/api/football/fixtures/live')).toBe('live_feed');
    expect(httpEndpointLabel('https://api.test/api/football/cached/matches/2026-11-08')).toBe('calendar');
    recordHttpFetch({
      endpoint: 'calendar',
      status: 200,
      durationMs: 120.4,
      ok: true,
      bytes: 2048,
      xCache: 'HIT',
    });
    expect(events()[0].data).toEqual({
      endpoint: 'calendar',
      status: 200,
      durationMs: 120,
      ok: true,
      bytes: 2048,
      xCache: 'HIT',
    });
    expect(JSON.stringify(events()[0])).not.toContain('https://');
  });
});
