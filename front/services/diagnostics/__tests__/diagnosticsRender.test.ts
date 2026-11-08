jest.mock('../../../src/store/liveFixtureStore', () => ({
  useLiveFixtureStore: { subscribe: jest.fn(() => jest.fn()) },
}));

import { noteMatchRowDuration, noteMatchRowRendered, renderHostTick, resetRenderForTests, shouldTimeSelector } from '../diagnosticsRender';
import { diagFlags, diagState, resetDiagStateForTests } from '../diagnosticsState';

describe('render windows', () => {
  beforeEach(() => {
    resetDiagStateForTests();
    resetRenderForTests();
    diagFlags.active = true;
    diagFlags.render = true;
    diagState.recording = true;
    diagState.deviceId = 'd_abcdefghij1234567890';
    diagState.session = {
      id: '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d',
      token: 'token',
      config: {
        maxEvents: 1000,
        features: { pipeline: false, render: true, clock: false, sentryTags: false, observe: false, backendTrace: false },
        sampling: { pipeline: 0, render: 1, selectorTiming: 0 },
      },
      expiresAtMono: Number.POSITIVE_INFINITY,
      expiresAtWall: Date.now() + 60_000,
      uploadUntilWall: Date.now() + 60_000,
      startedAtWall: Date.now(),
      startedAtMono: 0,
    };
  });

  it('counts redundant rows and summarizes a window', () => {
    const row = { id: '9', statusShort: '2H', elapsed: 10, extra: null, homeScore: 1, awayScore: 0 };
    noteMatchRowRendered(row);
    noteMatchRowRendered(row);
    noteMatchRowRendered({ ...row, homeScore: 2 });
    noteMatchRowDuration(1.5);
    renderHostTick(1_000, true);
    const summary = diagState.queue.entries().find((entry) => entry.event.type === 'render_window');
    expect(summary?.event.data).toMatchObject({
      rowRenders: 3,
      redundantRenders: 1,
      rowRenderSamples: 1,
      rowRenderMsSum: 1.5,
    });
  });

  it('does not time selectors or count rows when render tracing is off', () => {
    diagFlags.render = false;
    noteMatchRowRendered({ id: '1', statusShort: 'NS', elapsed: null, extra: null, homeScore: 0, awayScore: 0 });
    renderHostTick(1_000, true);
    expect(diagState.queue.size).toBe(0);
    expect(shouldTimeSelector()).toBe(false);
  });
});
