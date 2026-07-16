import {
  compareInternationalLeagues,
  getInternationalSortTier,
  INTERNATIONAL_TIER,
  isInternationalCompetition,
  resolveCanonicalLeagueId,
} from '../internationalCompetition';

describe('internationalCompetition', () => {
  test('resolveCanonicalLeagueId unwraps 365 synthetic ids', () => {
    expect(resolveCanonicalLeagueId(7_000_002)).toBe(2);
    expect(resolveCanonicalLeagueId(2)).toBe(2);
    expect(resolveCanonicalLeagueId(0)).toBeNull();
  });

  test('excludes World Cup league id and canonical id 1', () => {
    expect(
      isInternationalCompetition(
        { id: 1, name: 'World Cup', country: 'World' },
        { excludeLeagueId: 1 },
      ),
    ).toBe(false);
    expect(
      isInternationalCompetition({ id: 1, name: 'World Cup', country: 'World' }),
    ).toBe(false);
    expect(
      isInternationalCompetition(
        { id: 7_000_001, name: 'World Cup', country: 'World' },
        { excludeLeagueId: 1 },
      ),
    ).toBe(false);
  });

  test('classifies curated ids and continental countries', () => {
    expect(
      isInternationalCompetition({ id: 2, name: 'UEFA Champions League', country: 'Europe' }),
    ).toBe(true);
    expect(
      isInternationalCompetition({ id: 4, name: 'Euro Championship', country: 'Europe' }),
    ).toBe(true);
    expect(
      isInternationalCompetition({ id: 15, name: 'FIFA Club World Cup', country: 'World' }),
    ).toBe(true);
    expect(
      isInternationalCompetition({ id: 39, name: 'Premier League', country: 'England' }),
    ).toBe(false);
    expect(
      isInternationalCompetition({ id: 99999, name: 'Mystery Cup', country: 'Africa' }),
    ).toBe(true);
  });

  test('name / governing-body fallback for unknown ids', () => {
    expect(
      isInternationalCompetition({
        id: 900001,
        name: 'UEFA Youth League',
        country: 'Spain',
      }),
    ).toBe(true);
    expect(
      isInternationalCompetition({
        id: 900002,
        name: 'Copa América',
        country: 'Brazil',
      }),
    ).toBe(true);
  });

  test('sort tiers: major continental → UCL → top Europe → other', () => {
    expect(getInternationalSortTier({ id: 4, name: 'Euro' })).toBe(
      INTERNATIONAL_TIER.MAJOR_CONTINENTAL,
    );
    expect(getInternationalSortTier({ id: 2, name: 'UCL' })).toBe(INTERNATIONAL_TIER.UCL);
    expect(getInternationalSortTier({ id: 3, name: 'UEL' })).toBe(
      INTERNATIONAL_TIER.TOP_EUROPE,
    );
    expect(getInternationalSortTier({ id: 12, name: 'CAF CL' })).toBe(
      INTERNATIONAL_TIER.OTHER,
    );
  });

  test('compareInternationalLeagues orders by tier then alphabet', () => {
    const leagues = [
      { id: 12, name: 'CAF Champions League' },
      { id: 2, name: 'UEFA Champions League' },
      { id: 6, name: 'Africa Cup of Nations' },
      { id: 4, name: 'Euro Championship' },
      { id: 3, name: 'UEFA Europa League' },
      { id: 15, name: 'FIFA Club World Cup' },
    ];
    const sorted = [...leagues].sort(compareInternationalLeagues);
    expect(sorted.map((l) => l.id)).toEqual([6, 4, 15, 2, 3, 12]);
  });

  test('365 synthetic UCL id sorts as UCL tier', () => {
    expect(
      getInternationalSortTier({ id: 7_000_002, name: 'Champions League', country: 'Europe' }),
    ).toBe(INTERNATIONAL_TIER.UCL);
    expect(
      isInternationalCompetition(
        { id: 7_000_002, name: 'Champions League', country: 'Europe' },
        { excludeLeagueId: 1 },
      ),
    ).toBe(true);
  });
});
