import { SCORES365_LEAGUE_ID_OFFSET } from '../scores365-league-id.util';
import {
  findReplacedSyntheticFixture,
  isHotAllScoresPersistItem,
} from '../scores365-live-identity.util';

describe('findReplacedSyntheticFixture', () => {
  const kickoff = new Date('2026-08-24T17:00:00.000Z');

  it('maps a new 365 gameId onto the old LIVE synthetic row for the same match', () => {
    const old = {
      fixtureId: 4_751_186,
      leagueId: SCORES365_LEAGUE_ID_OFFSET + 7,
      homeTeamName: 'Granada',
      awayTeamName: 'Mallorca',
      matchDate: kickoff,
      matchTimestamp: Math.floor(kickoff.getTime() / 1000),
      status: '1H',
    };

    const replaced = findReplacedSyntheticFixture(
      {
        gameId: 4_822_440,
        startTime: kickoff.toISOString(),
        homeName: 'Granada',
        awayName: 'Mallorca',
        competitionId: 7,
      },
      [old],
    );

    expect(replaced?.fixtureId).toBe(4_751_186);
  });

  it('does not remap API-Football rows or different kickoff days', () => {
    const apiRow = {
      fixtureId: 1_234_567,
      leagueId: 140,
      homeTeamName: 'Granada',
      awayTeamName: 'Mallorca',
      matchDate: kickoff,
      matchTimestamp: Math.floor(kickoff.getTime() / 1000),
      status: '1H',
    };
    expect(
      findReplacedSyntheticFixture(
        {
          gameId: 4_822_440,
          startTime: kickoff.toISOString(),
          homeName: 'Granada',
          awayName: 'Mallorca',
          competitionId: 7,
        },
        [apiRow],
      ),
    ).toBeNull();
  });
});

describe('isHotAllScoresPersistItem', () => {
  it('keeps live rows and recently finished just-ended rows', () => {
    const now = Date.parse('2026-08-24T20:00:00.000Z');
    expect(isHotAllScoresPersistItem({ phase: 'live' }, now)).toBe(true);
    expect(
      isHotAllScoresPersistItem(
        { phase: 'finished', startTime: '2026-08-24T17:00:00.000Z' },
        now,
      ),
    ).toBe(true);
    expect(
      isHotAllScoresPersistItem(
        { phase: 'finished', startTime: '2026-08-23T08:00:00.000Z' },
        now,
      ),
    ).toBe(false);
    expect(isHotAllScoresPersistItem({ phase: 'upcoming' }, now)).toBe(false);
  });
});
