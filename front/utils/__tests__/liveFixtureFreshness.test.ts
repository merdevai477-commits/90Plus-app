import {
  applyLiveClockToMatch,
  clockFromFixture,
  clockFromMatch,
  decideLiveMerge,
  mergeIncomingLiveOntoFixture,
  withAuthoritativeLiveMinute,
} from '../liveFixtureFreshness';
import type { Fixture } from '../../services/apiFootball';
import type { Match } from '../../components/Matches/matchCardUtils';

function clock(partial: {
  short: string;
  elapsed: number | null;
  extra?: number | null;
  home?: number;
  away?: number;
}) {
  return {
    short: partial.short,
    elapsed: partial.elapsed,
    extra: partial.extra ?? null,
    home: partial.home ?? 0,
    away: partial.away ?? 0,
  };
}

describe('decideLiveMerge', () => {
  it('Test 1: elapsed 12 → 13 advances', () => {
    const d = decideLiveMerge(
      clock({ short: '1H', elapsed: 12 }),
      clock({ short: '1H', elapsed: 13 }),
    );
    expect(d).toEqual({ action: 'REPLACE', reason: 'ELAPSED_ADVANCE' });
  });

  it('Test 2: 0-0 → 1-0 at same elapsed is a score change', () => {
    const d = decideLiveMerge(
      clock({ short: '1H', elapsed: 12, home: 0, away: 0 }),
      clock({ short: '1H', elapsed: 12, home: 1, away: 0 }),
    );
    expect(d).toEqual({ action: 'REPLACE', reason: 'SCORE_CHANGE' });
  });

  it('Test 3: 1H 45 → HT 45 is a period change', () => {
    const d = decideLiveMerge(
      clock({ short: '1H', elapsed: 45 }),
      clock({ short: 'HT', elapsed: 45 }),
    );
    expect(d).toEqual({ action: 'REPLACE', reason: 'STATUS_CHANGE' });
  });

  it('Test 4: 27 1-0 is not replaced by 12 0-0', () => {
    const d = decideLiveMerge(
      clock({ short: '1H', elapsed: 27, home: 1, away: 0 }),
      clock({ short: '1H', elapsed: 12, home: 0, away: 0 }),
    );
    expect(d).toEqual({ action: 'KEEP', reason: 'OLDER' });
  });

  it('Test 5: HT is not replaced by earlier 1H', () => {
    const d = decideLiveMerge(
      clock({ short: 'HT', elapsed: 45 }),
      clock({ short: '1H', elapsed: 44 }),
    );
    expect(d).toEqual({ action: 'KEEP', reason: 'OLDER' });
  });

  it('Test 6: missing snapshot inserts incoming', () => {
    const d = decideLiveMerge(null, clock({ short: '1H', elapsed: 12 }));
    expect(d).toEqual({ action: 'INSERT', reason: 'INSERT' });
  });

  it('HT 45 → 2H 46 advances period', () => {
    const d = decideLiveMerge(
      clock({ short: 'HT', elapsed: 45 }),
      clock({ short: '2H', elapsed: 46 }),
    );
    expect(d).toEqual({ action: 'REPLACE', reason: 'STATUS_CHANGE' });
  });

  it('2H 90 → FT 90 advances period', () => {
    const d = decideLiveMerge(
      clock({ short: '2H', elapsed: 90 }),
      clock({ short: 'FT', elapsed: 90 }),
    );
    expect(d).toEqual({ action: 'REPLACE', reason: 'STATUS_CHANGE' });
  });

  it('does not revive FT with a live 2H row', () => {
    const d = decideLiveMerge(
      clock({ short: 'FT', elapsed: 90, home: 1, away: 0 }),
      clock({ short: '2H', elapsed: 90, home: 1, away: 0 }),
    );
    expect(d).toEqual({ action: 'KEEP', reason: 'OLDER' });
  });
});

function makeFixture(opts: {
  elapsed: number | null;
  short: string;
  home: number;
  away: number;
  homeName?: string;
  homeLogo?: string;
  leagueName?: string;
  extra?: number | null;
}): Fixture {
  return {
    fixture: {
      id: 4783857,
      referee: null,
      timezone: 'UTC',
      date: '2026-09-09T21:00:00+00:00',
      timestamp: 0,
      periods: { first: null, second: null },
      venue: { id: null, name: null, city: null },
      status: {
        long: opts.short,
        short: opts.short,
        elapsed: opts.elapsed,
        extra: opts.extra ?? null,
      },
    },
    league: {
      id: 39,
      name: opts.leagueName ?? 'Premier League',
      country: 'England',
      logo: 'https://league.logo/pl.png',
      flag: null,
      season: 2026,
      round: 'Regular',
    },
    teams: {
      home: {
        id: 10,
        name: opts.homeName ?? 'Home FC',
        logo: opts.homeLogo ?? 'https://cdn.example/home.png',
        winner: null,
      },
      away: {
        id: 20,
        name: 'Away FC',
        logo: 'https://cdn.example/away.png',
        winner: null,
      },
    },
    goals: { home: opts.home, away: opts.away },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

describe('mergeIncomingLiveOntoFixture', () => {
  it('Test 7: preserves team/league metadata when incoming live row is thin', () => {
    const existing = makeFixture({
      elapsed: 12,
      short: '1H',
      home: 0,
      away: 0,
      homeName: 'Complete Home',
      homeLogo: 'https://cdn.example/complete-home.png',
      leagueName: 'Complete League',
    });
    const incoming = makeFixture({
      elapsed: 27,
      short: '1H',
      home: 1,
      away: 0,
      homeName: '',
      homeLogo: '',
      leagueName: '',
    });
    incoming.teams.home.id = 0;
    incoming.league.id = 0;
    incoming.league.logo = '';

    const merged = mergeIncomingLiveOntoFixture(existing, incoming);
    expect(merged.fixture.status.elapsed).toBe(27);
    expect(merged.goals.home).toBe(1);
    expect(merged.teams.home.name).toBe('Complete Home');
    expect(merged.teams.home.logo).toBe('https://cdn.example/complete-home.png');
    expect(merged.teams.home.id).toBe(10);
    expect(merged.league.name).toBe('Complete League');
    expect(merged.league.logo).toBe('https://league.logo/pl.png');
  });
});

describe('clock helpers', () => {
  it('reads Match live fields', () => {
    const row = {
      id: '1',
      homeTeam: { name: 'H', logo: '' },
      awayTeam: { name: 'A', logo: '' },
      score: { home: 1, away: 0 },
      status: 'live' as const,
      statusShort: '1H',
      elapsed: 27,
      extra: null,
      league: { id: 1, name: 'L', logo: '' },
    } satisfies Match;
    expect(clockFromMatch(row)).toEqual({
      short: '1H',
      elapsed: 27,
      extra: null,
      home: 1,
      away: 0,
    });
    expect(clockFromFixture(makeFixture({ elapsed: 27, short: '1H', home: 1, away: 0 })).elapsed).toBe(27);
  });

  it('copies live fields onto a calendar row without dropping logos', () => {
    const row: Match = {
      id: '1',
      homeTeam: { name: 'H', logo: 'logo-h' },
      awayTeam: { name: 'A', logo: 'logo-a' },
      score: { home: 0, away: 0 },
      status: 'live',
      statusShort: '1H',
      elapsed: 12,
      extra: null,
      minute: "12'",
      league: { id: 1, name: 'L', logo: 'lg' },
      crowdPrediction: { homePercent: 40, drawPercent: 30, awayPercent: 30, totalVotes: 10 },
    };
    const live: Match = {
      ...row,
      score: { home: 1, away: 0 },
      elapsed: 27,
      minute: "27'",
      homeTeam: { name: 'H', logo: '' },
    };
    const next = applyLiveClockToMatch(row, live);
    expect(next.elapsed).toBe(27);
    expect(next.score.home).toBe(1);
    expect(next.homeTeam.logo).toBe('logo-h');
    expect(next.crowdPrediction?.totalVotes).toBe(10);
  });
});

describe('withAuthoritativeLiveMinute', () => {
  it('does not let baked minute 50 win over elapsed 64', () => {
    const row: Match = {
      id: '4812183',
      homeTeam: { name: 'H', logo: 'h.png' },
      awayTeam: { name: 'A', logo: 'a.png' },
      score: { home: 1, away: 2 },
      status: 'live',
      statusShort: '2H',
      elapsed: 64,
      extra: null,
      minute: "50'",
      league: { id: 39, name: 'EPL', logo: 'lg.png', country: 'England' },
    };
    const next = withAuthoritativeLiveMinute(row);
    expect(next.elapsed).toBe(64);
    expect(next.minute).toBe("64'");
    expect(next.homeTeam.logo).toBe('h.png');
  });

  it('formats 2H stoppage from extra while elapsed stays 90', () => {
    const row: Match = {
      id: '1',
      homeTeam: { name: 'H', logo: '' },
      awayTeam: { name: 'A', logo: '' },
      score: { home: 0, away: 0 },
      status: 'live',
      statusShort: '2H',
      elapsed: 90,
      extra: 4,
      minute: "90'",
      league: { id: 1, name: 'L', logo: '' },
    };
    expect(withAuthoritativeLiveMinute(row).minute).toBe("90+4'");
  });
});
