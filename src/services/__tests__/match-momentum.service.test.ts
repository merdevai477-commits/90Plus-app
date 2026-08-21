import { buildMomentumPayload, hasMomentumEventCoverage } from '../match-momentum.service';

function ev(elapsed: number, type: string, teamId: number, detail = '') {
  return {
    time: { elapsed, extra: null },
    team: { id: teamId, name: 'T', logo: '' },
    player: { id: 1, name: 'P' },
    assist: { id: null, name: null },
    type,
    detail,
    comments: null,
  };
}

describe('match-momentum.service', () => {
  const home = 10;
  const away = 20;
  const events = [
    ev(8, 'Card', home, 'Yellow Card'),
    ev(33, 'Goal', home),
    ev(61, 'Card', away, 'Yellow Card'),
    ev(78, 'Goal', away),
  ];

  it('hides incomplete coverage', () => {
    expect(
      hasMomentumEventCoverage({
        events: [ev(12, 'Goal', home)],
        homeTeamId: home,
        awayTeamId: away,
        homeGoals: 1,
        finished: true,
      }),
    ).toBe(false);
  });

  it('builds an available payload with a Gaussian peak near the goal', () => {
    const payload = buildMomentumPayload({
      events,
      homeTeamId: home,
      awayTeamId: away,
      homeGoals: 1,
      awayGoals: 1,
      finished: true,
    });
    expect(payload.available).toBe(true);
    const at33 = payload.series.find((p) => p.minute === 33);
    const at10 = payload.series.find((p) => p.minute === 10);
    expect(at33 && at10).toBeTruthy();
    expect(at33!.home).toBeGreaterThan(at10!.home);
  });
});
