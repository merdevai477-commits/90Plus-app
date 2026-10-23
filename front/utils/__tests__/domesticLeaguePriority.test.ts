import { getDomesticLeaguePriority } from '../domesticLeaguePriority';

describe('getDomesticLeaguePriority', () => {
  test('ranks Premier League above Championship for API-Football and 365 ids', () => {
    expect(getDomesticLeaguePriority({ id: 39, name: 'Premier League', country: 'England' })).toBeLessThan(
      getDomesticLeaguePriority({ id: 40, name: 'Championship', country: 'England' }),
    );
    expect(
      getDomesticLeaguePriority({ id: 7_000_007, name: 'Premier League', country: 'England' }),
    ).toBeLessThan(
      getDomesticLeaguePriority({ id: 7_000_001, name: 'Championship', country: 'England' }),
    );
  });

  test('uses name fallback when id is unknown', () => {
    expect(
      getDomesticLeaguePriority({ id: 999999, name: 'Premier League', country: 'England' }),
    ).toBeLessThan(
      getDomesticLeaguePriority({ id: 999998, name: 'Championship', country: 'England' }),
    );
  });

  test('ranks bare LaLiga above LaLiga 2 without country on the ref', () => {
    expect(getDomesticLeaguePriority({ name: 'LaLiga' })).toBeLessThan(
      getDomesticLeaguePriority({ name: 'LaLiga 2' }),
    );
  });
});
