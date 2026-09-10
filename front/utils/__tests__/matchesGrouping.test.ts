import type { Match } from '../../components/Matches/matchCardUtils';
import {
  groupMatchesByCountry,
  groupMatchesByCountryIncremental,
  groupMatchesByLeague,
} from '../matchesGrouping';

function makeMatch(
  id: string,
  opts: {
    leagueId: number;
    leagueName: string;
    country: string;
    status?: Match['status'];
    date?: string;
  },
): Match {
  return {
    id,
    homeTeam: { name: `H${id}`, logo: '' },
    awayTeam: { name: `A${id}`, logo: '' },
    score: { home: 0, away: 0 },
    status: opts.status ?? 'upcoming',
    statusShort: opts.status === 'live' ? '1H' : 'NS',
    elapsed: null,
    extra: null,
    minute: '',
    time: '18:00',
    fixtureDate: opts.date ?? '2026-09-04T18:00:00.000Z',
    league: {
      id: opts.leagueId,
      name: opts.leagueName,
      logo: '',
      country: opts.country,
      countryFlag: null,
    },
  };
}

function buildDay(n: number): Match[] {
  const countries = ['England', 'Spain', 'Italy', 'France', 'Germany', 'Egypt', 'World'];
  const out: Match[] = [];
  for (let i = 0; i < n; i++) {
    const leagueId = (i % 20) + 1;
    // Production invariant: one leagueId → one country.
    const country = countries[leagueId % countries.length];
    out.push(
      makeMatch(String(i + 1), {
        leagueId,
        leagueName: `League ${leagueId}`,
        country,
        status: i % 17 === 0 ? 'live' : 'upcoming',
      }),
    );
  }
  return out;
}

describe('matchesGrouping incremental (P1-5)', () => {
  it.each([10, 150, 318, 876])(
    'incremental output matches full regroup for %s fixtures',
    (n) => {
      const matches = buildDay(n);
      const full = groupMatchesByCountry(matches);
      const prev = groupMatchesByCountry(matches);

      for (const pattern of [
        new Set([matches[0].id]),
        new Set(matches.slice(0, Math.min(10, n)).map((m) => m.id)),
        new Set(matches.map((m) => m.id)),
      ]) {
        const patched = matches.map((m) =>
          pattern.has(m.id)
            ? { ...m, score: { home: 1, away: 0 }, status: 'live' as const, statusShort: '1H' }
            : m,
        );
        const incremental = groupMatchesByCountryIncremental(patched, pattern, prev);
        const expected = groupMatchesByCountry(patched);
        expect(JSON.stringify(incremental)).toEqual(JSON.stringify(expected));
        // full baseline still valid shape
        expect(full.length).toBeGreaterThan(0);
      }
    },
  );

  it('preserves sibling country group references when one fixture changes', () => {
    const matches = [
      makeMatch('1', { leagueId: 1, leagueName: 'EPL', country: 'England', status: 'live' }),
      makeMatch('2', { leagueId: 1, leagueName: 'EPL', country: 'England' }),
      makeMatch('3', { leagueId: 2, leagueName: 'La Liga', country: 'Spain' }),
      makeMatch('4', { leagueId: 3, leagueName: 'Serie A', country: 'Italy' }),
    ];
    const previous = groupMatchesByCountry(matches);
    const spainPrev = previous.find((c) => c.country === 'Spain');
    const italyPrev = previous.find((c) => c.country === 'Italy');

    const patched = matches.map((m) =>
      m.id === '1' ? { ...m, score: { home: 2, away: 1 } } : m,
    );
    const next = groupMatchesByCountryIncremental(patched, new Set(['1']), previous);

    expect(next.find((c) => c.country === 'Spain')).toBe(spainPrev);
    expect(next.find((c) => c.country === 'Italy')).toBe(italyPrev);
    expect(next.find((c) => c.country === 'England')).not.toBe(
      previous.find((c) => c.country === 'England'),
    );
  });

  it('prints grouping timing baseline for review', () => {
    const rows = [
      { fixtures: 318, matches: buildDay(318) },
      { fixtures: 876, matches: buildDay(876) },
    ].map(({ fixtures, matches }) => {
      const t0 = Date.now();
      const full = groupMatchesByCountry(matches);
      const fullMs = Date.now() - t0;
      const prev = full;
      const changed = new Set([matches[0].id]);
      const patched = matches.map((m, i) =>
        i === 0 ? { ...m, score: { home: 1, away: 0 } } : m,
      );
      const t1 = Date.now();
      groupMatchesByCountryIncremental(patched, changed, prev);
      const incrMs = Date.now() - t1;
      return { fixtures, fullMs, incrMs, countries: full.length };
    });
    // eslint-disable-next-line no-console
    console.table(rows);
    expect(rows[0].countries).toBeGreaterThan(0);
  });

  it('groupMatchesByLeague sorts live first', () => {
    const matches = [
      makeMatch('1', { leagueId: 1, leagueName: 'L', country: 'England', status: 'upcoming', date: '2026-09-04T16:00:00.000Z' }),
      makeMatch('2', { leagueId: 1, leagueName: 'L', country: 'England', status: 'live', date: '2026-09-04T15:00:00.000Z' }),
    ];
    const groups = groupMatchesByLeague(matches);
    expect(groups[0].matches[0].id).toBe('2');
  });

  it('rebuilds the live row when changedIds is empty but fingerprint advanced (PTR/freeze)', () => {
    const stale = makeMatch('4812183', {
      leagueId: 39,
      leagueName: 'EPL',
      country: 'England',
      status: 'live',
    });
    stale.elapsed = 50;
    stale.minute = "50'";
    stale.statusShort = '2H';
    stale.score = { home: 1, away: 2 };

    const fresh = { ...stale, elapsed: 64, minute: "64'" };
    const spain = makeMatch('9', { leagueId: 2, leagueName: 'La Liga', country: 'Spain' });
    const italy = makeMatch('10', { leagueId: 3, leagueName: 'Serie A', country: 'Italy' });
    const france = makeMatch('11', { leagueId: 4, leagueName: 'Ligue 1', country: 'France' });
    const germany = makeMatch('12', { leagueId: 5, leagueName: 'Bundesliga', country: 'Germany' });
    const previous = groupMatchesByCountry([stale, spain, italy, france, germany]);
    const spainPrev = previous.find((c) => c.country === 'Spain');

    const next = groupMatchesByCountryIncremental(
      [fresh, spain, italy, france, germany],
      new Set(),
      previous,
    );
    const grouped = next
      .flatMap((c) => c.leagues)
      .flatMap((l) => l.matches)
      .find((m) => m.id === '4812183');
    expect(grouped?.elapsed).toBe(64);
    expect(grouped?.minute).toBe("64'");
    expect(next.find((c) => c.country === 'Spain')).toBe(spainPrev);
  });
});
