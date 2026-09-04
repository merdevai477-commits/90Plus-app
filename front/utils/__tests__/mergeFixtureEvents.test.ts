import { mergeFixtureEvents, fixtureEventDedupeKey } from '../mergeFixtureEvents';
import type { FixtureEvent } from '../services/apiFootball';

const goal = (minute: number): FixtureEvent => ({
  time: { elapsed: minute, extra: null },
  team: { id: 1, name: 'Home', logo: '' },
  player: { id: 10, name: 'P' },
  assist: { id: null, name: null },
  type: 'Goal',
  detail: 'Normal Goal',
  comments: null,
});

describe('mergeFixtureEvents', () => {
  it('merges WS-pushed events without waiting for poll', () => {
    const existing = [goal(10)];
    const incoming = [goal(12)];
    const merged = mergeFixtureEvents(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[1].time.elapsed).toBe(12);
  });

  it('dedupes identical events', () => {
    const e = goal(20);
    const merged = mergeFixtureEvents([e], [e]);
    expect(merged).toHaveLength(1);
    expect(fixtureEventDedupeKey(merged[0])).toBe(fixtureEventDedupeKey(e));
  });
});
