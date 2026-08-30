import { detailsRequestGate } from '../../../services/detailsRequestGate';
import { ApiFootballService } from '../../../services/apiFootball';
import {
  cancelFixtureHttpFetches,
  fetchFastSnapshot,
} from '../liveFixtureSync';
import { useLiveFixtureStore } from '../liveFixtureStore';
import type { Fixture } from '../../../services/apiFootball';

jest.mock('../../../services/apiFootball', () => ({
  ApiFootballService: {
    getFixtureDetailsBundle: jest.fn(),
    getFixtureById: jest.fn(),
    getFixtureEvents: jest.fn(),
  },
  isAbortError: (error: unknown) =>
    error instanceof DOMException && error.name === 'AbortError',
}));

const getFixtureDetailsBundle = ApiFootballService.getFixtureDetailsBundle as jest.Mock;
const getFixtureById = ApiFootballService.getFixtureById as jest.Mock;

function makeFixture(id: number, status = '2H'): Fixture {
  return {
    fixture: {
      id,
      referee: null,
      timezone: 'UTC',
      date: '2026-06-13T15:00:00+00:00',
      timestamp: 0,
      periods: { first: null, second: null },
      venue: { id: null, name: null, city: null },
      status: { long: status, short: status, elapsed: 60, extra: null },
    },
    league: {
      id: 39,
      name: 'League',
      country: 'England',
      logo: '',
      flag: null,
      season: 2025,
      round: '',
    },
    teams: {
      home: { id: 10, name: 'Home', logo: '', winner: null },
      away: { id: 20, name: 'Away', logo: '', winner: null },
    },
    goals: { home: 1, away: 0 },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

function resetStore(): void {
  useLiveFixtureStore.setState({
    snapshots: {},
    interestCounts: {},
    focusedFixtureId: null,
    evictionSchedule: {},
  });
}

describe('matchesStampede guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detailsRequestGate.clear();
    resetStore();
  });

  it('limits concurrent /details work to gate max under burst load', async () => {
    let peakConcurrent = 0;
    let active = 0;

    const tasks = Array.from({ length: 20 }, (_, i) =>
      detailsRequestGate.enqueue(async () => {
        active++;
        peakConcurrent = Math.max(peakConcurrent, active);
        await new Promise((resolve) => setTimeout(resolve, 30));
        active--;
        return i;
      }),
    );

    await Promise.all(tasks);

    expect(peakConcurrent).toBeLessThanOrEqual(detailsRequestGate.maxConcurrent);
  });

  it('refreshInterestedLive completes for many live interests without stampeding errors', async () => {
    getFixtureById.mockImplementation(async (fixtureId: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return makeFixture(fixtureId);
    });

    const fixtureIds = Array.from({ length: 20 }, (_, i) => i + 1);
    for (const id of fixtureIds) {
      useLiveFixtureStore.getState().registerInterest(id);
      useLiveFixtureStore.getState().ingestSnapshot({
        fixtureId: id,
        fixture: makeFixture(id),
        events: [],
        statistics: null,
        statsFromEvents: false,
        lineups: null,
        venue: null,
        revision: 1,
        updatedAt: Date.now(),
        lastHttpFetchAt: null,
        lastWsAppliedAt: null,
        lastSource: 'bootstrap',
        phase: 'live',
        lastFetchError: null,
      });
    }

    await useLiveFixtureStore.getState().refreshInterestedLive();

    expect(getFixtureById).toHaveBeenCalledTimes(20);
  });

  it('cancels in-flight fast fetch via cancelFixtureHttpFetches without lastFetchError', async () => {
    let capturedSignal: AbortSignal | undefined;

    getFixtureDetailsBundle.mockImplementation(
      (_fixtureId: number, options?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          capturedSignal = options?.signal;
          if (options?.signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
          setTimeout(
            () =>
              resolve({
                fixture: makeFixture(123),
                lineups: [],
                statistics: [],
                events: [],
                venue: null,
              }),
            500,
          );
        }),
    );

    const fetchPromise = fetchFastSnapshot(123);
    cancelFixtureHttpFetches(123);
    const result = await fetchPromise;

    expect(capturedSignal?.aborted).toBe(true);
    expect(result).toBeNull();
  });
});

describe('detailsRequestGate', () => {
  beforeEach(() => {
    detailsRequestGate.clear();
  });

  it('removes aborted queued work without taking a slot', async () => {
    const controller = new AbortController();
    const run = jest.fn(() => new Promise<string>(() => {}));

    // Fill active slots with slow work.
    const blockers = Array.from({ length: 3 }, () =>
      detailsRequestGate.enqueue(() => new Promise(() => {})),
    );
    void blockers;

    const queued = detailsRequestGate.enqueue(run, { signal: controller.signal });
    controller.abort();

    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    expect(run).not.toHaveBeenCalled();
  });
});
