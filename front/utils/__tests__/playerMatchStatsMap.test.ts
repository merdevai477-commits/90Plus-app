import { buildMatchStatsDashboard, isPresentStatValue } from '../playerMatchStatsMap';

describe('isPresentStatValue', () => {
  it('treats 0 as present and null/empty as absent', () => {
    expect(isPresentStatValue(0)).toBe(true);
    expect(isPresentStatValue('0')).toBe(true);
    expect(isPresentStatValue(null)).toBe(false);
    expect(isPresentStatValue(undefined)).toBe(false);
    expect(isPresentStatValue('')).toBe(false);
    expect(isPresentStatValue('—')).toBe(false);
  });
});

describe('buildMatchStatsDashboard', () => {
  const sample = [
    { type: 0, name: 'Rating', value: '7.4', isTop: true },
    { type: 1, name: 'Goals', value: '0' },
    { type: 2, name: 'Assists', value: '1' },
    { type: 30, name: 'Minutes', value: "86'" },
    { type: 76, name: 'Expected Goals', value: '0.28' },
    { type: 3, name: 'Total Shots', value: '6' },
    { type: 4, name: 'Shots on Goal', value: '2' },
    { type: 19, name: 'Passes', value: '19/31 (61%)' },
    { type: 42, name: 'Fouls', value: '1' },
  ];

  it('extracts rating and overview without fabricating missing rows', () => {
    const model = buildMatchStatsDashboard(sample, 'en', 'Centre Forward');
    expect(model.rating).toBe(7.4);
    expect(model.overview.goals?.display).toBe('0');
    expect(model.overview.assists?.display).toBe('1');
    expect(model.overview.minutes?.display).toBe("86'");
    expect(model.keyStats.some((s) => s.key === 'xg')).toBe(true);
    // Key attacking metrics move to the key strip; advanced rows stay in sections.
    expect(model.sections.some((s) => s.id === 'passing')).toBe(true);
    expect(model.sections.some((s) => s.id === 'defense')).toBe(true);
  });

  it('skips absent values instead of coercing to zero', () => {
    const model = buildMatchStatsDashboard(
      [{ type: 3, name: 'Total Shots', value: null }],
      'en',
      'Midfielder',
    );
    expect(model.totalRaw).toBe(0);
    expect(model.keyStats).toHaveLength(0);
  });
});
