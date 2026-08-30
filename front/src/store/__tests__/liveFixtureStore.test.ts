import {
  applyWebSocketToFixture,
  buildSnapshotFromRaw,
  isValidStatusTransition,
  shouldSkipHttpIngest,
} from '../liveFixtureSync';
import type { Fixture } from '../../../services/apiFootball';
import type { LiveFixtureSnapshot } from '../liveFixtureStore.types';

jest.mock('../../../services/apiFootball', () => ({
  ApiFootballService: {
    getFixtureDetailsBundle: jest.fn(),
    getFixtureById: jest.fn(),
    getFixtureEvents: jest.fn(),
  },
}));

function makeFixture(elapsed: number, status: string, home: number, away: number, extra?: number | null): Fixture {
  return {
    fixture: {
      id: 1,
      referee: null,
      timezone: 'UTC',
      date: '2026-06-13T15:00:00+00:00',
      timestamp: 0,
      periods: { first: null, second: null },
      venue: { id: null, name: null, city: null },
      status: { long: status, short: status, elapsed, extra: extra ?? null },
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
    goals: { home, away },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

function baseSnapshot(fixture: Fixture, events: [] = []): LiveFixtureSnapshot {
  return buildSnapshotFromRaw({
    fixtureId: 1,
    fixture,
    events,
    source: 'http-fast',
  })!;
}

describe('liveFixtureSync WS merge', () => {
  it('does not regress elapsed when WS minute is lower', () => {
    const snap = baseSnapshot(makeFixture(60, '2H', 1, 0));
    const patched = applyWebSocketToFixture(snap, {
      homeScore: 1,
      awayScore: 0,
      status: '2H',
      minute: 59,
    });
    expect(patched.fixture.status.elapsed).toBe(60);
  });

  it('allows HT status transition', () => {
    const snap = baseSnapshot(makeFixture(45, '1H', 0, 0));
    const patched = applyWebSocketToFixture(snap, {
      homeScore: 0,
      awayScore: 0,
      status: 'HT',
      minute: 45,
    });
    expect(patched.fixture.status.short).toBe('HT');
  });

  it('clears stoppage extra when WS reports FT', () => {
    const snap = baseSnapshot(makeFixture(90, '2H', 2, 3, 4));
    const patched = applyWebSocketToFixture(snap, {
      homeScore: 2,
      awayScore: 3,
      status: 'FT',
      minute: 90,
      extra: null,
    });
    expect(patched.fixture.status.short).toBe('FT');
    expect(patched.fixture.status.extra).toBeNull();
  });

  it('reconcile runs once in buildSnapshotFromRaw', () => {
    const fixture = makeFixture(46, '2H', 0, 0);
    const events = [
      {
        time: { elapsed: 60, extra: null },
        team: { id: 10, name: 'Home', logo: '' },
        player: { id: 1, name: 'P' },
        assist: { id: null, name: null },
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null,
      },
    ];
    const snap = buildSnapshotFromRaw({
      fixtureId: 1,
      fixture,
      events,
      source: 'http-fast',
    });
    expect(snap?.fixture.fixture.status.elapsed).toBe(60);
    expect(snap?.fixture.goals.home).toBe(1);
  });
});

describe('shouldSkipHttpIngest', () => {
  it('skips when WS applied during in-flight HTTP fetch', () => {
    const fixture = makeFixture(55, '2H', 2, 1);
    const current = baseSnapshot(fixture);
    current.lastWsAppliedAt = 1000;
    current.lastSource = 'websocket';
    const incoming = baseSnapshot(makeFixture(50, '2H', 1, 1));
    expect(shouldSkipHttpIngest(current, incoming, 900)).toBe(true);
  });

  it('skips when HTTP would regress WS score', () => {
    const current = baseSnapshot(makeFixture(60, '2H', 2, 1));
    current.lastWsAppliedAt = 500;
    current.lastSource = 'websocket';
    const incoming = baseSnapshot(makeFixture(60, '2H', 1, 1));
    expect(shouldSkipHttpIngest(current, incoming, 100)).toBe(true);
  });

  it('skips when HTTP would regress WS minute', () => {
    const current = baseSnapshot(makeFixture(62, '2H', 1, 0));
    current.lastWsAppliedAt = 500;
    current.lastSource = 'websocket';
    const incoming = baseSnapshot(makeFixture(58, '2H', 1, 0));
    expect(shouldSkipHttpIngest(current, incoming, 100)).toBe(true);
  });

  it('allows HTTP to replace a calendar bootstrap preview', () => {
    const current = buildSnapshotFromRaw({
      fixtureId: 1,
      fixture: makeFixture(0, 'NS', 0, 0),
      events: [],
      source: 'bootstrap',
    })!;
    const incoming = baseSnapshot(makeFixture(12, '1H', 1, 0));
    expect(shouldSkipHttpIngest(current, incoming, 100)).toBe(false);
  });

  it('allows HTTP when no fresher WS state exists', () => {
    const current = baseSnapshot(makeFixture(50, '2H', 1, 0));
    current.lastWsAppliedAt = null;
    current.lastHttpFetchAt = 50;
    const incoming = baseSnapshot(makeFixture(55, '2H', 2, 0));
    expect(shouldSkipHttpIngest(current, incoming, 100)).toBe(false);
  });

  it('skips stale HTTP 1-1 after WS applied 2-1 (goal regression guard)', () => {
    const current = baseSnapshot(makeFixture(60, '2H', 2, 1));
    current.lastWsAppliedAt = 1000;
    current.lastSource = 'websocket';
    const incoming = baseSnapshot(makeFixture(58, '2H', 1, 1));
    expect(shouldSkipHttpIngest(current, incoming, 500)).toBe(true);
  });
});

describe('isValidStatusTransition', () => {
  it('accepts HT from 1H', () => {
    expect(isValidStatusTransition('1H', 'HT')).toBe(true);
  });

  it('accepts 2H from HT', () => {
    expect(isValidStatusTransition('HT', '2H')).toBe(true);
  });
});
