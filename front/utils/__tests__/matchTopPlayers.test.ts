import type { Competitor365Squad, Competitor365Stats } from '../../services/apiFootball';
import {
  classifyMatchPlayerPosition,
  formatTopPlayerStat,
  match365CompetitionId,
  parseLeaderValue,
  pickMatchTopPlayer,
} from '../matchTopPlayers';

const emptySquad = (competitorId: number): Competitor365Squad => ({
  competitorId,
  players: [],
  groups: {
    goalkeeper: [],
    defender: [],
    midfielder: [],
    forward: [],
    other: [],
  },
});

function squadWith(
  competitorId: number,
  players: Competitor365Squad['players'],
): Competitor365Squad {
  const groups = emptySquad(competitorId).groups;
  for (const player of players) groups[player.positionGroup].push(player);
  return { competitorId, players, groups };
}

describe('match365CompetitionId', () => {
  it('keeps World Cup competition id 1', () => {
    expect(match365CompetitionId(1)).toBe(1);
  });

  it('strips the 365 league offset', () => {
    expect(match365CompetitionId(7_000_007)).toBe(7);
  });

  it('rejects API-Football league ids', () => {
    expect(match365CompetitionId(39)).toBeNull();
  });
});

describe('parse / format', () => {
  it('parses comma decimals and strips noise', () => {
    expect(parseLeaderValue('7,4')).toBe(7.4);
    expect(parseLeaderValue('12')).toBe(12);
    expect(parseLeaderValue('')).toBe(0);
  });

  it('formats rating to one decimal and ints as-is', () => {
    expect(formatTopPlayerStat(7.42, 'rating')).toBe('7.4');
    expect(formatTopPlayerStat(0, 'rating')).toBe('0');
    expect(formatTopPlayerStat(8, 'int')).toBe('8');
  });
});

describe('classifyMatchPlayerPosition', () => {
  it('maps common 365 labels', () => {
    expect(classifyMatchPlayerPosition('Forward')).toBe('forward');
    expect(classifyMatchPlayerPosition('Midfielder')).toBe('midfielder');
    expect(classifyMatchPlayerPosition('Centre Back')).toBe('defender');
    expect(classifyMatchPlayerPosition('مهاجم')).toBe('forward');
  });
});

describe('pickMatchTopPlayer', () => {
  const stats: Competitor365Stats = {
    competitionId: 1,
    leaderboards: [
      {
        key: 1,
        name: 'Goals',
        rows: [
          {
            rank: 1,
            athleteId: 10,
            name: 'Mbappe',
            photo: 'https://img/mbappe.png',
            value: '8',
            competitorId: 100,
            leftClub: false,
            positionName: 'Forward',
          },
          {
            rank: 2,
            athleteId: 11,
            name: 'Giroud',
            photo: null,
            value: '3',
            competitorId: 100,
            leftClub: false,
            positionName: 'Forward',
          },
        ],
      },
      {
        key: 2,
        name: 'Assists',
        rows: [
          {
            rank: 1,
            athleteId: 20,
            name: 'Tchouameni',
            photo: null,
            value: '4',
            competitorId: 100,
            leftClub: false,
            positionName: 'Midfielder',
          },
          {
            rank: 2,
            athleteId: 10,
            name: 'Mbappe',
            photo: 'https://img/mbappe.png',
            value: '2',
            competitorId: 100,
            leftClub: false,
            positionName: 'Forward',
          },
        ],
      },
      {
        key: 3,
        name: 'Rating',
        rows: [
          {
            rank: 1,
            athleteId: 30,
            name: 'Saliba',
            photo: null,
            value: '7.6',
            competitorId: 100,
            leftClub: false,
            positionName: 'Centre Back',
          },
        ],
      },
    ],
  };

  it('picks the top scorer for attack', () => {
    const player = pickMatchTopPlayer(stats, emptySquad(100), 100, 'attack');
    expect(player).toMatchObject({ athleteId: 10, name: 'Mbappe', goals: 8, assists: 2 });
  });

  it('picks the top assister for midfield', () => {
    const player = pickMatchTopPlayer(stats, emptySquad(100), 100, 'midfield');
    expect(player).toMatchObject({ athleteId: 20, name: 'Tchouameni', assists: 4 });
  });

  it('picks the highest-rated defender', () => {
    const player = pickMatchTopPlayer(stats, emptySquad(100), 100, 'defense');
    expect(player).toMatchObject({ athleteId: 30, name: 'Saliba', rating: 7.6 });
  });

  it('uses squad grouping when the board has no position names', () => {
    const noPos: Competitor365Stats = {
      competitionId: 1,
      leaderboards: [
        {
          key: 1,
          name: 'Goals',
          rows: [
            {
              rank: 1,
              athleteId: 40,
              name: 'Kante',
              photo: null,
              value: '1',
              competitorId: 100,
              leftClub: false,
            },
          ],
        },
      ],
    };
    const squad = squadWith(100, [
      {
        athleteId: 40,
        name: 'Kante',
        shortName: 'Kante',
        position: 'CDM',
        positionGroup: 'midfielder',
        jerseyNumber: 13,
        photo: null,
      },
    ]);
    expect(pickMatchTopPlayer(noPos, squad, 100, 'midfield')?.athleteId).toBe(40);
    expect(pickMatchTopPlayer(noPos, squad, 100, 'attack')).toBeNull();
  });

  it('returns null when there is nothing to show', () => {
    expect(pickMatchTopPlayer(null, emptySquad(100), 100, 'attack')).toBeNull();
  });
});
