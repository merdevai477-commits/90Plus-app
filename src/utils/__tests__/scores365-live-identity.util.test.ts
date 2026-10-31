import { SCORES365_LEAGUE_ID_OFFSET } from '../scores365-league-id.util';
import {
  findReplacedSyntheticFixture,
  isHotAllScoresPersistItem,
  isAllScoresLiveItem,
  coerceAllScoresLiveStatus,
  isStale365InPlayClock,
  parseStoppageFromDisplay,
} from '../scores365-live-identity.util';

describe('parseStoppageFromDisplay', () => {
  it('reads stoppage only from an explicit plus', () => {
    expect(parseStoppageFromDisplay("90+3'", 90)).toBe(3);
    expect(parseStoppageFromDisplay('90+3', 93)).toBe(3);
    expect(parseStoppageFromDisplay("90'+3", 90)).toBe(3);
    expect(parseStoppageFromDisplay("45+2'", 45)).toBe(2);
    expect(parseStoppageFromDisplay("+4'", 90)).toBe(4);
    expect(parseStoppageFromDisplay("120+1'", 120)).toBe(1);
  });

  it('does not read a plain period-end minute as stoppage', () => {
    expect(parseStoppageFromDisplay("45'", 45)).toBeNull();
    expect(parseStoppageFromDisplay("90'", 90)).toBeNull();
    expect(parseStoppageFromDisplay('90', 90)).toBeNull();
    expect(parseStoppageFromDisplay("105'", 105)).toBeNull();
    expect(parseStoppageFromDisplay("120’", 120)).toBeNull();
    expect(parseStoppageFromDisplay("67'", 67)).toBeNull();
  });

  it('caps implausible stoppage at the stale threshold', () => {
    expect(parseStoppageFromDisplay("90+35'", 90)).toBe(20);
  });
});

describe('isStale365InPlayClock', () => {
  const secondHalf = { statusGroup: 3, statusText: '2nd Half', shortStatusText: '2nd Half' };

  it('does not end a match whose clock reads a plain 90\'', () => {
    expect(isStale365InPlayClock({ ...secondHalf, gameTime: 90, gameTimeDisplay: "90'" })).toBe(false);
    expect(isStale365InPlayClock({ ...secondHalf, gameTime: 91, gameTimeDisplay: "90'" })).toBe(false);
  });

  it('still ends a clock stuck at 90+20', () => {
    expect(isStale365InPlayClock({ ...secondHalf, gameTime: 90, gameTimeDisplay: "90+20'" })).toBe(true);
  });

  it('never ends extra time on the 110\' second-half cap', () => {
    expect(
      isStale365InPlayClock({ statusGroup: 3, statusText: 'ET', shortStatusText: 'ET2', gameTime: 112 }),
    ).toBe(false);
  });
});

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

  it('does not treat a stuck 90+20 statusGroup-3 clock as live', () => {
    expect(
      isAllScoresLiveItem({
        phase: 'finished',
        raw: {
          statusGroup: 3,
          statusText: '2nd Half',
          shortStatusText: '2nd Half',
          gameTime: 90,
          gameTimeDisplay: '90+20',
        },
      }),
    ).toBe(false);
  });

  it('keeps a match at a plain 90\' in the live list', () => {
    expect(
      isAllScoresLiveItem({
        phase: 'live',
        raw: {
          statusGroup: 3,
          statusText: '2nd Half',
          shortStatusText: '2nd Half',
          gameTime: 90,
          gameTimeDisplay: "90'",
        },
      }),
    ).toBe(true);
  });

  it('keeps a long but real 90+12 stoppage live', () => {
    expect(
      isAllScoresLiveItem({
        phase: 'live',
        raw: {
          statusGroup: 3,
          statusText: '2nd Half',
          shortStatusText: '2nd Half',
          gameTime: 90,
          gameTimeDisplay: '90+12',
          startTime: new Date(Date.now() - 135 * 60_000).toISOString(),
        },
      }),
    ).toBe(true);
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

  it('keeps a plain 90\' row in 2H instead of finishing it', () => {
    const fixture = {
      fixture: { status: { short: '2H', long: 'Second Half', elapsed: 90, extra: null } },
    };
    const coerced = coerceAllScoresLiveStatus(fixture, {
      statusGroup: 3,
      statusText: '2nd Half',
      shortStatusText: '2nd Half',
      gameTime: 90,
      gameTimeDisplay: "90'",
    });
    expect(coerced.fixture.status.short).toBe('2H');
  });

  it('does not coerce a stuck 90+20 FT classification back to 2H', () => {
    const fixture = {
      fixture: { status: { short: 'FT', long: 'Match Finished', elapsed: 90, extra: 20 } },
    };
    const coerced = coerceAllScoresLiveStatus(fixture, {
      statusGroup: 3,
      statusText: '2nd Half',
      shortStatusText: '2nd Half',
      gameTime: 90,
      gameTimeDisplay: '90+20',
    });
    expect(coerced.fixture.status.short).toBe('FT');
    expect(coerced.fixture.status.extra).toBeNull();
  });

  it('coerces first-half stoppage (gameTime past 45) to 1H, not 2H', () => {
    const fixture = {
      fixture: { status: { short: 'FT', long: 'Match Finished', elapsed: 47, extra: null } },
    };
    const coerced = coerceAllScoresLiveStatus(fixture, {
      statusGroup: 3,
      statusText: '1st Half',
      shortStatusText: '1st Half',
      gameTime: 47,
      gameTimeDisplay: '45+2',
    });
    expect(coerced.fixture.status.short).toBe('1H');
  });
});
