import {
  decide365LiveSnapshotWrite,
  MIN_ALLSCORES_CATALOGUE_FOR_EMPTY_LIVE_CLEAR,
} from '../scores365-live-snapshot-guard.util';

describe('decide365LiveSnapshotWrite', () => {
  it('replaces when upstream returns a healthy non-empty live snapshot', () => {
    expect(
      decide365LiveSnapshotWrite({
        incomingLiveCount: 54,
        previousLiveCount: 50,
        catalogueCount: 838,
      }),
    ).toEqual({ action: 'REPLACE', reason: 'VALID_UPSTREAM_SNAPSHOT' });
  });

  it('keeps previous when empty live arrives with a degraded thin catalogue', () => {
    expect(
      decide365LiveSnapshotWrite({
        incomingLiveCount: 0,
        previousLiveCount: 54,
        catalogueCount: 10,
      }),
    ).toEqual({ action: 'KEEP_PREVIOUS', reason: 'EMPTY_UPSTREAM_RESPONSE' });
  });

  it('allows clear when empty live arrives with no previous snapshot', () => {
    expect(
      decide365LiveSnapshotWrite({
        incomingLiveCount: 0,
        previousLiveCount: 0,
        catalogueCount: 0,
      }),
    ).toEqual({ action: 'CLEAR', reason: 'EMPTY_NO_PREVIOUS' });
  });

  it('allows clear when empty live arrives with a complete-enough catalogue', () => {
    expect(
      decide365LiveSnapshotWrite({
        incomingLiveCount: 0,
        previousLiveCount: 54,
        catalogueCount: MIN_ALLSCORES_CATALOGUE_FOR_EMPTY_LIVE_CLEAR,
      }),
    ).toEqual({ action: 'CLEAR', reason: 'LEGITIMATE_EMPTY_LIVE_SNAPSHOT' });
  });

  it('recovers by replacing when a later healthy snapshot arrives', () => {
    expect(
      decide365LiveSnapshotWrite({
        incomingLiveCount: 52,
        previousLiveCount: 54,
        catalogueCount: 840,
      }),
    ).toEqual({ action: 'REPLACE', reason: 'VALID_UPSTREAM_SNAPSHOT' });
  });

  it('follows the 54 → 0 → 53 → 0 → 51 fail-safe sequence', () => {
    const resulting: number[] = [];
    let previous = 54;
    const ticks = [
      { incoming: 0, catalogue: 10 },
      { incoming: 53, catalogue: 838 },
      { incoming: 0, catalogue: 8 },
      { incoming: 51, catalogue: 839 },
    ];

    for (const tick of ticks) {
      const decision = decide365LiveSnapshotWrite({
        incomingLiveCount: tick.incoming,
        previousLiveCount: previous,
        catalogueCount: tick.catalogue,
      });
      if (decision.action === 'KEEP_PREVIOUS') {
        resulting.push(previous);
      } else {
        previous = tick.incoming;
        resulting.push(previous);
      }
    }

    expect(resulting).toEqual([54, 53, 53, 51]);
  });

  it('does not keep forever when live quietly ends under a full catalogue', () => {
    const decision = decide365LiveSnapshotWrite({
      incomingLiveCount: 0,
      previousLiveCount: 3,
      catalogueCount: 900,
    });
    expect(decision.action).toBe('CLEAR');
    expect(decision.reason).toBe('LEGITIMATE_EMPTY_LIVE_SNAPSHOT');
  });
});
