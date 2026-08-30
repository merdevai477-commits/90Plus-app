import {
  formatNationalDisplay,
  isStorePhoneValid,
  normalizeNationalDigits,
  sponsorPhoneLine,
} from '../sponsorPhone';

describe('sponsorPhone', () => {
  it('normalizes Egypt numbers', () => {
    expect(normalizeNationalDigits('01012345678', 'egypt')).toBe('1012345678');
    expect(formatNationalDisplay('1012345678', 'egypt')).toBe('10 1234 5678');
  });

  it('validates Egypt numbers', () => {
    expect(isStorePhoneValid('egypt', '1012345678')).toBe(true);
    expect(isStorePhoneValid('egypt', '10123')).toBe(false);
    expect(isStorePhoneValid('egypt', '')).toBe(true);
  });

  it('formats phone line for cards', () => {
    expect(
      sponsorPhoneLine({
        phoneCountryId: 'egypt',
        phoneNational: '1012345678',
      }),
    ).toBe('+20 10 1234 5678');
  });
});
