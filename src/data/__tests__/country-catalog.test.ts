import {
  mapCountryInput,
  shouldSeedCountry,
  countriesMatch,
  NEW_USER_COUNTRY_SEED_MAX_AGE_MS,
} from '../country-catalog';

describe('mapCountryInput', () => {
  it('maps Clerk-style names, ISO codes, and aliases', () => {
    expect(mapCountryInput('Egypt')?.id).toBe('eg');
    expect(mapCountryInput('EG')?.flag).toBe('🇪🇬');
    expect(mapCountryInput('eg')?.name).toBe('مصر');
    expect(mapCountryInput('Saudi Arabia')?.id).toBe('sa');
    expect(mapCountryInput('KSA')?.id).toBe('sa');
    expect(mapCountryInput('United States')?.id).toBe('us');
    expect(mapCountryInput('GB')?.id).toBe('gb');
    expect(mapCountryInput('England')?.id).toBe('gb');
  });

  it('returns null for unknown or empty values', () => {
    expect(mapCountryInput('')).toBeNull();
    expect(mapCountryInput(null)).toBeNull();
    expect(mapCountryInput('Narnia')).toBeNull();
  });
});

describe('countriesMatch', () => {
  it('treats Egypt / eg / EG as the same country', () => {
    expect(countriesMatch('eg', 'Egypt')).toBe(true);
    expect(countriesMatch('EG', 'مصر')).toBe(true);
    expect(countriesMatch('eg', 'sa')).toBe(false);
  });
});

describe('shouldSeedCountry', () => {
  const now = Date.parse('2026-09-06T12:00:00.000Z');

  it('seeds only new users with empty country and flag', () => {
    expect(
      shouldSeedCountry(
        { country: null, countryFlag: null, createdAt: new Date(now - 60_000) },
        now,
      ),
    ).toBe(true);
  });

  it('does not overwrite an existing country or flag', () => {
    expect(
      shouldSeedCountry(
        { country: 'eg', countryFlag: null, createdAt: new Date(now - 60_000) },
        now,
      ),
    ).toBe(false);
    expect(
      shouldSeedCountry(
        { country: null, countryFlag: '🇪🇬', createdAt: new Date(now - 60_000) },
        now,
      ),
    ).toBe(false);
  });

  it('does not seed old accounts', () => {
    expect(
      shouldSeedCountry(
        {
          country: null,
          countryFlag: null,
          createdAt: new Date(now - NEW_USER_COUNTRY_SEED_MAX_AGE_MS - 1000),
        },
        now,
      ),
    ).toBe(false);
  });
});
