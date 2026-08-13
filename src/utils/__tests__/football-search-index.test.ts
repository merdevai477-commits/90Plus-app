import {
  expandSearchQueries,
  isPlayerOrientedBoost,
  normalizeSearchText,
  scoreCompetitor,
  scoreSearchName,
  stripSearchStopwords,
} from '../football-search-index';

describe('football-search-index', () => {
  it('normalizes Arabic hamza, ya, ta marbuta, and tashkeel', () => {
    expect(normalizeSearchText('الأهلي')).toBe(normalizeSearchText('الاهلي'));
    expect(normalizeSearchText('الزمالكُ')).toBe('الزمالك');
    expect(normalizeSearchText('Kylian Mbappé')).toBe('kylian mbappe');
  });

  it('strips club stopwords so نادي الاهلي matches الأهلي', () => {
    const stripped = stripSearchStopwords(normalizeSearchText('نادي الاهلي'));
    expect(stripped).toBe(normalizeSearchText('الاهلي'));
  });

  it('expands الأهلي to Al Ahly SC entity 8200, not National Bank', () => {
    const exp = expandSearchQueries('الأهلي');
    expect(exp.boostedEntityIds.has(8200)).toBe(true);
    expect(exp.boostedEntityIds.has(50527)).toBe(false);
  });

  it('keeps البنك الأهلي on National Bank 50527 only', () => {
    const exp = expandSearchQueries('البنك الأهلي');
    expect(exp.boostedEntityIds.has(50527)).toBe(true);
    expect(exp.boostedEntityIds.has(8200)).toBe(false);
  });

  it('fuzzy-expands الزماك to Zamalek 8201', () => {
    const exp = expandSearchQueries('الزماك');
    expect(exp.boostedEntityIds.has(8201)).toBe(true);
    expect(exp.queries.some((q) => /zamalek/i.test(q))).toBe(true);
  });

  it('maps ميسي / مبابي / فينيسيوس to the correct player IDs', () => {
    expect(expandSearchQueries('ميسي').boostedEntityIds.has(874)).toBe(true);
    expect(expandSearchQueries('ليونيل').boostedEntityIds.has(874)).toBe(true);
    expect(expandSearchQueries('مبابي').boostedEntityIds.has(39820)).toBe(true);
    expect(expandSearchQueries('كيليان').boostedEntityIds.has(39820)).toBe(true);
    expect(expandSearchQueries('فينيسيوس').boostedEntityIds.has(48298)).toBe(true);
    expect(expandSearchQueries('فيني').boostedEntityIds.has(48298)).toBe(true);
  });

  it('treats ميسي as a player-oriented boost', () => {
    expect(isPlayerOrientedBoost(expandSearchQueries('ميسي').boostedEntityIds)).toBe(true);
    expect(isPlayerOrientedBoost(expandSearchQueries('الأهلي').boostedEntityIds)).toBe(false);
  });

  it('ranks exact الأهلي above البنك الأهلي token match', () => {
    const q = normalizeSearchText('الأهلي');
    const ahly = scoreCompetitor(
      { competitorId: 8200, name: 'الأهلي', countryId: 131, popularityRank: 15382 },
      q,
      new Set([8200]),
      131,
    );
    const bank = scoreCompetitor(
      { competitorId: 50527, name: 'البنك الأهلي', countryId: 131, popularityRank: 617 },
      q,
      new Set([8200]),
      131,
    );
    expect(ahly).toBeGreaterThan(bank);
    expect(scoreSearchName(q, 'البنك الأهلي')).toBeLessThan(scoreSearchName(q, 'الأهلي'));
  });
});
