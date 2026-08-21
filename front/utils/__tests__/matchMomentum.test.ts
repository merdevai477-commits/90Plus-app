import {
  buildMomentumFromEvents,
  hasMomentumEventCoverage,
  minuteToXRtl,
  toMomentumApiPayload,
  momentumSeriesFromPayload,
} from '../matchMomentum';
import type { FixtureEvent } from '../../services/apiFootball';

function ev(
  partial: Partial<FixtureEvent> & {
    elapsed: number;
    type: string;
    teamId: number;
    detail?: string;
  },
): FixtureEvent {
  return {
    time: { elapsed: partial.elapsed, extra: null },
    team: { id: partial.teamId, name: 'T', logo: '' },
    player: { id: 1, name: 'P' },
    assist: { id: null, name: null },
    type: partial.type,
    detail: partial.detail ?? '',
    comments: null,
  };
}

describe('matchMomentum coverage', () => {
  const home = 10;
  const away = 20;

  it('hides when too few significant events', () => {
    expect(
      hasMomentumEventCoverage({
        events: [ev({ elapsed: 12, type: 'Goal', teamId: home })],
        homeTeamId: home,
        awayTeamId: away,
        homeGoals: 1,
        awayGoals: 0,
        finished: true,
      }),
    ).toBe(false);
  });

  it('hides when score goals exceed event goals (incomplete feed)', () => {
    expect(
      hasMomentumEventCoverage({
        events: [
          ev({ elapsed: 10, type: 'Card', teamId: home, detail: 'Yellow Card' }),
          ev({ elapsed: 55, type: 'Card', teamId: away, detail: 'Yellow Card' }),
        ],
        homeTeamId: home,
        awayTeamId: away,
        homeGoals: 2,
        awayGoals: 1,
        finished: true,
      }),
    ).toBe(false);
  });

  it('shows for a finished match with spread significant events', () => {
    const events = [
      ev({ elapsed: 8, type: 'Card', teamId: home, detail: 'Yellow Card' }),
      ev({ elapsed: 33, type: 'Goal', teamId: home }),
      ev({ elapsed: 61, type: 'Card', teamId: away, detail: 'Yellow Card' }),
      ev({ elapsed: 78, type: 'Goal', teamId: away }),
    ];
    expect(
      hasMomentumEventCoverage({
        events,
        homeTeamId: home,
        awayTeamId: away,
        homeGoals: 1,
        awayGoals: 1,
        finished: true,
      }),
    ).toBe(true);

    const series = buildMomentumFromEvents({
      events,
      homeTeamId: home,
      awayTeamId: away,
      homeGoals: 1,
      awayGoals: 1,
      finished: true,
    });
    expect(series).not.toBeNull();
    expect(series!.duration).toBeGreaterThanOrEqual(90);
    expect(series!.markers.some((m) => m.kind === 'goal')).toBe(true);
  });
});

describe('matchMomentum gaussian series', () => {
  const home = 10;
  const away = 20;
  const events = [
    ev({ elapsed: 8, type: 'Card', teamId: home, detail: 'Yellow Card' }),
    ev({ elapsed: 33, type: 'Goal', teamId: home }),
    ev({ elapsed: 61, type: 'Card', teamId: away, detail: 'Yellow Card' }),
    ev({ elapsed: 78, type: 'Goal', teamId: away }),
  ];

  it('peaks near the goal minute rather than a flat decay tail', () => {
    const series = buildMomentumFromEvents({
      events,
      homeTeamId: home,
      awayTeamId: away,
      homeGoals: 1,
      awayGoals: 1,
      finished: true,
    });
    expect(series).not.toBeNull();
    expect(series!.home[33]).toBeGreaterThan(series!.home[10]);
    expect(series!.home[33]).toBeGreaterThan(series!.home[50]);
    expect(series!.away[78]).toBeGreaterThan(series!.away[45]);
  });

  it('round-trips through the API payload shape', () => {
    const series = buildMomentumFromEvents({
      events,
      homeTeamId: home,
      awayTeamId: away,
      homeGoals: 1,
      awayGoals: 1,
      finished: true,
    });
    const payload = toMomentumApiPayload(series);
    expect(payload.available).toBe(true);
    const restored = momentumSeriesFromPayload(payload);
    expect(restored?.home[33]).toBeCloseTo(series!.home[33], 5);
  });

  it('maps later minutes further left on the RTL axis', () => {
    expect(minuteToXRtl(90, 90, 100, 0)).toBeLessThan(minuteToXRtl(0, 90, 100, 0));
    expect(minuteToXRtl(0, 90, 100, 0)).toBe(100);
    expect(minuteToXRtl(90, 90, 100, 0)).toBe(0);
  });
});
