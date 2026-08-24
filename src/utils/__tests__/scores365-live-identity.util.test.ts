import { SCORES365_LEAGUE_ID_OFFSET } from '../scores365-league-id.util';
import {
  findReplacedSyntheticFixture,
  isHotAllScoresPersistItem,
  isAllScoresLiveItem,
  coerceAllScoresLiveStatus,
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

describe('isAllScoresLiveItem', () => {
  it('treats statusGroup 3 as live even if our phase classifier said finished', () => {
    expect(isAllScoresLiveItem({ phase: 'finished', raw: { statusGroup: 3 } })).toBe(true);
    expect(isAllScoresLiveItem({ phase: 'live', raw: { statusGroup: 2 } })).toBe(true);
    expect(isAllScoresLiveItem({ phase: 'upcoming', raw: { statusGroup: 2 } })).toBe(false);
  });
});

describe('coerceAllScoresLiveStatus', () => {
  it('keeps a 2H row that 365 still marks statusGroup 3', () => {
    const fixture = {
      fixture: { status: { short: 'FT', long: 'Match Finished', elapsed: 90 } },
    };
    const coerced = coerceAllScoresLiveStatus(fixture, {
      statusGroup: 3,
      statusText: '2nd Half',
      shortStatusText: '2nd Half',
      gameTime: 77,
    });
    expect(coerced.fixture.status.short).toBe('2H');
  });
});
