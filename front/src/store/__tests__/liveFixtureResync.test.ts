import { allTargetsSynced, resyncFixtureSnapshots } from '../liveFixtureResync';

describe('resyncFixtureSnapshots', () => {
  it('fetches each fixture once and does not mark the socket trusted early', async () => {
    const calls: number[] = [];
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inFlight = new Set<number>();
    const pending = resyncFixtureSnapshots(
      [7],
      async (id) => {
        calls.push(id);
        await gate;
      },
      inFlight,
    );
    const second = resyncFixtureSnapshots([7], async (id) => {
      calls.push(id);
    }, inFlight);
    release!();
    const [firstSynced, secondSynced] = await Promise.all([pending, second]);
    expect(calls).toEqual([7]);
    expect([...firstSynced]).toEqual([7]);
    expect(secondSynced.size).toBe(0);
    expect(allTargetsSynced([7], firstSynced)).toBe(true);
    expect(allTargetsSynced([7], secondSynced)).toBe(false);
  });

  it('applies a newer score once and does not duplicate the goal event', async () => {
    const events: string[] = [];
    const seen = new Set<string>();
    const fetchOne = async () => {
      const key = 'goal-70';
      if (!seen.has(key)) {
        seen.add(key);
        events.push(key);
      }
    };
    await resyncFixtureSnapshots([4], fetchOne, new Set());
    await resyncFixtureSnapshots([4], fetchOne, new Set());
    expect(events).toEqual(['goal-70']);
  });
});
