import { mapScores365Events, overlay365LocalizedRosterNames } from '../scores365-experiment.service';

const baseFixture = {
  fixture: { id: 900001, date: '2026-06-01T18:00:00Z', status: { short: 'FT', long: 'Finished', elapsed: 90 } },
  teams: {
    home: { id: 100, name: 'Home FC', logo: 'h.png' },
    away: { id: 200, name: 'Away FC', logo: 'a.png' },
  },
  goals: { home: 1, away: 0 },
  score: { halftime: { home: 0, away: 0 }, fulltime: { home: 1, away: 0 } },
} as any;

function gameWithEvents(events: any[], members: any[]) {
  return {
    id: 4627937,
    homeCompetitor: { id: 1, name: 'Home FC', score: 1, lineups: { members: [] } },
    awayCompetitor: { id: 2, name: 'Away FC', score: 0, lineups: { members: [] } },
    members,
    events,
  } as any;
}

describe('mapScores365Events', () => {
  const members = [
    { id: 10, competitorId: 1, name: 'Scorer One', shortName: 'Scorer' },
    { id: 11, competitorId: 1, name: 'Assist Two', shortName: 'Assist' },
    { id: 20, competitorId: 1, name: 'Player Out', shortName: 'Out' },
    { id: 21, competitorId: 1, name: 'Player In', shortName: 'In' },
  ];

  it('maps 365 substitution (type 1000) with player in and out', () => {
    const events = mapScores365Events(
      gameWithEvents(
        [
          {
            competitorId: 1,
            gameTime: 54,
            playerId: 20,
            extraPlayers: [21],
            eventType: { id: 1000, name: 'Substitution' },
          },
        ],
        members,
      ),
      baseFixture,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('subst');
    expect(events[0].player).toEqual({ id: 21, name: 'In' });
    expect(events[0].assist).toEqual({ id: 20, name: 'Out' });
  });

  it('maps goal assists from extraPlayers', () => {
    const events = mapScores365Events(
      gameWithEvents(
        [
          {
            competitorId: 1,
            gameTime: 16,
            playerId: 10,
            extraPlayers: [11],
            eventType: { id: 1, name: 'Goal', subTypeName: 'Field Goal' },
          },
        ],
        members,
      ),
      baseFixture,
    );

    expect(events[0].type).toBe('Goal');
    expect(events[0].player.name).toBe('Scorer');
    expect(events[0].assist).toEqual({ id: 11, name: 'Assist' });
  });

  it('maps own goals from subTypeName', () => {
    const events = mapScores365Events(
      gameWithEvents(
        [
          {
            competitorId: 2,
            gameTime: 70,
            playerId: 10,
            eventType: { id: 1, name: 'Goal', subTypeName: 'Own Goal' },
          },
        ],
        members,
      ),
      baseFixture,
    );

    expect(events[0].detail).toBe('Own Goal');
    expect(events[0].team.id).toBe(100);
  });
});

describe('overlay365LocalizedRosterNames', () => {
  it('overlays localized athlete, assist, team, and coach names by id', () => {
    const events = [
      {
        type: 'Goal',
        team: { id: 100, name: 'Home FC' },
        player: { id: 10, name: 'Scorer' },
        assist: { id: 11, name: 'Assist' },
      },
    ];
    const lineups = [
      {
        team: { id: 100, name: 'Home FC' },
        coach: { id: 99, name: 'Coach En' },
        startXI: [
          {
            player: {
              id: 501,
              athleteId: 501,
              scores365MemberId: 10,
              name: 'Scorer One',
            },
          },
        ],
        substitutes: [],
      },
    ];
    const localized = {
      members: [
        { id: 10, athleteId: 501, name: 'الهداف', shortName: 'هداف' },
        { id: 11, athleteId: 502, name: 'صانع اللعب', shortName: 'صانع' },
        { id: 30, athleteId: 99, name: 'المدرب', shortName: 'مدرب' },
      ],
      homeCompetitor: { id: 1, name: 'الأهلي' },
      awayCompetitor: { id: 2, name: 'الزمالك' },
    } as any;

    const overlayed = overlay365LocalizedRosterNames(
      { events, lineups },
      localized,
      { home: { id: 100, name: 'الأهلي' }, away: { id: 200, name: 'الزمالك' } },
    );

    expect(overlayed.events?.[0].player.name).toBe('الهداف');
    expect(overlayed.events?.[0].assist.name).toBe('صانع اللعب');
    expect(overlayed.events?.[0].team.name).toBe('الأهلي');
    expect(overlayed.lineups?.[0].startXI[0].player.name).toBe('الهداف');
    expect(overlayed.lineups?.[0].coach.name).toBe('المدرب');
    expect(overlayed.lineups?.[0].team.name).toBe('الأهلي');
  });
});
