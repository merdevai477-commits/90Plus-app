/**
 * Leagues without a 365 events feed still show a score. The synthetic goals log records
 * score deltas seen by the live sync and replays them as goal events when — and only
 * when — the provider has no goals and the tally matches the current score.
 */

const hashes = new Map<string, Map<string, string>>();

const fakeRedis = {
  hgetall: jest.fn(async (key: string) => Object.fromEntries(hashes.get(key) ?? [])),
  hsetnx: jest.fn(async (key: string, field: string, value: string) => {
    const bucket = hashes.get(key) ?? new Map<string, string>();
    if (bucket.has(field)) return 0;
    bucket.set(field, value);
    hashes.set(key, bucket);
    return 1;
  }),
  hdel: jest.fn(async (key: string, field: string) => {
    hashes.get(key)?.delete(field);
    return 1;
  }),
  expire: jest.fn(async () => 1),
  del: jest.fn(async (key: string) => {
    hashes.delete(key);
    return 1;
  }),
};

jest.mock('../lib/redis', () => ({
  getRedisClient: jest.fn(() => fakeRedis),
  isRedisConnected: jest.fn(() => true),
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import {
  buildSyntheticGoalEvents,
  clearSyntheticGoals,
  feedHasGoalEvents,
  mergeSyntheticGoalsIntoEvents,
  readSyntheticGoals,
  reconcileSyntheticGoals,
  resolveEventsFeedAvailability,
  tallySyntheticGoals,
} from '../services/synthetic-goals.service';

const teams = {
  home: { id: 11, name: 'Villarreal B', logo: 'h.png' },
  away: { id: 22, name: 'Algeciras', logo: 'a.png' },
};

describe('synthetic goals', () => {
  beforeEach(async () => {
    hashes.clear();
    jest.clearAllMocks();
    await clearSyntheticGoals(4752417);
  });

  it('records a witnessed goal with its minute and is idempotent per goal', async () => {
    await reconcileSyntheticGoals(4752417, { home: 0, away: 0 }, { home: 1, away: 0 }, 23);
    await reconcileSyntheticGoals(4752417, { home: 0, away: 0 }, { home: 1, away: 0 }, 23);

    const goals = await readSyntheticGoals(4752417);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ side: 'home', index: 1, minute: 23, placeholder: false });
    expect(fakeRedis.hsetnx).toHaveBeenCalledTimes(1);
  });

  it('backfills minute-less placeholders for goals it never saw', async () => {
    // First sighting is already 2-1: nothing was witnessed.
    await reconcileSyntheticGoals(4752417, null, { home: 2, away: 1 }, 61);
    const goals = await readSyntheticGoals(4752417);
    expect(goals).toHaveLength(3);
    expect(goals.every((goal) => goal.placeholder && goal.minute == null)).toBe(true);
    expect(tallySyntheticGoals(goals)).toEqual({ home: 2, away: 1 });

    // The next goal is witnessed and gets its minute.
    await reconcileSyntheticGoals(4752417, { home: 2, away: 1 }, { home: 2, away: 2 }, 78);
    const after = await readSyntheticGoals(4752417);
    expect(after).toHaveLength(4);
    const witnessed = after.find((goal) => goal.side === 'away' && goal.index === 2);
    expect(witnessed).toMatchObject({ minute: 78, placeholder: false });
  });

  it('retracts the latest goal of a side when the score goes down (VAR)', async () => {
    await reconcileSyntheticGoals(4752417, { home: 0, away: 0 }, { home: 1, away: 0 }, 10);
    await reconcileSyntheticGoals(4752417, { home: 1, away: 0 }, { home: 2, away: 0 }, 40);
    await reconcileSyntheticGoals(4752417, { home: 2, away: 0 }, { home: 1, away: 0 }, 42);

    const goals = await readSyntheticGoals(4752417);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ side: 'home', index: 1, minute: 10 });
    expect(fakeRedis.hdel).toHaveBeenCalledWith('football:synthetic-goals:4752417', 'home:2');
  });

  it('builds API-Football shaped goal events only when the tally matches the score', async () => {
    await reconcileSyntheticGoals(4752417, { home: 0, away: 0 }, { home: 1, away: 0 }, 23);
    const goals = await readSyntheticGoals(4752417);

    const events = buildSyntheticGoalEvents(goals, teams, { home: 1, away: 0 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'Goal',
      detail: 'Normal Goal',
      team: { id: 11, name: 'Villarreal B' },
      time: { elapsed: 23, extra: null },
      player: { id: null, name: null },
      _synthetic: true,
    });

    // Score moved on before the sync recorded it: never show a tally that contradicts it.
    expect(buildSyntheticGoalEvents(goals, teams, { home: 2, away: 0 })).toEqual([]);
  });

  it('merges into a feed only when the provider has no goals and the score is non-zero', async () => {
    await reconcileSyntheticGoals(4752417, { home: 0, away: 0 }, { home: 0, away: 1 }, 55);

    const merged = await mergeSyntheticGoalsIntoEvents(4752417, [], teams, { home: 0, away: 1 });
    expect(merged.synthesized).toBe(1);
    expect(merged.events[0]).toMatchObject({ team: { id: 22 }, _synthetic: true });

    const providerGoal = {
      time: { elapsed: 55, extra: null },
      team: { id: 22, name: 'Algeciras', logo: '' },
      player: { id: 7, name: 'Someone' },
      assist: { id: null, name: null },
      type: 'Goal',
      detail: 'Normal Goal',
      comments: null,
    };
    const untouched = await mergeSyntheticGoalsIntoEvents(
      4752417,
      [providerGoal],
      teams,
      { home: 0, away: 1 },
    );
    expect(untouched.synthesized).toBe(0);
    expect(untouched.events).toEqual([providerGoal]);

    const nilNil = await mergeSyntheticGoalsIntoEvents(4752417, [], teams, { home: 0, away: 0 });
    expect(nilNil.events).toEqual([]);
  });

  it('keeps provider cards and slots synthetic goals in minute order', async () => {
    await reconcileSyntheticGoals(4752417, { home: 0, away: 0 }, { home: 1, away: 0 }, 30);
    const card = {
      time: { elapsed: 12, extra: null },
      team: { id: 22, name: 'Algeciras', logo: '' },
      player: { id: 9, name: 'Defender' },
      assist: { id: null, name: null },
      type: 'Card',
      detail: 'Yellow Card',
      comments: null,
    };
    const merged = await mergeSyntheticGoalsIntoEvents(4752417, [card], teams, { home: 1, away: 0 });
    expect(merged.events.map((event: any) => event.type)).toEqual(['Card', 'Goal']);
    expect(feedHasGoalEvents([card])).toBe(false);
  });

  it('reports feed availability honestly', () => {
    const synthetic = { type: 'Goal', _synthetic: true };
    expect(resolveEventsFeedAvailability([{ type: 'Card' }])).toBe(true);
    expect(resolveEventsFeedAvailability([synthetic])).toBe(false);
    expect(resolveEventsFeedAvailability([], { home: 1, away: 0 })).toBe(false);
    expect(resolveEventsFeedAvailability([], { home: 0, away: 0 })).toBeNull();
    expect(resolveEventsFeedAvailability([])).toBeNull();
  });
});
