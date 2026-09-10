import {
  hasNonLatinDigits,
  localeWithLatinNumerals,
  toLatinDigits,
} from '../latinDigits';
import { ar } from '../../../locales/ar';

function collectNonLatinDigitStrings(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    return hasNonLatinDigits(value) ? [`${path}: ${value}`] : [];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      collectNonLatinDigitStrings(child, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe('latinDigits', () => {
  it('converts Eastern Arabic-Indic digits to 0-9', () => {
    expect(toLatinDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
  });

  it('converts Persian digits and Arabic separators', () => {
    expect(toLatinDigits('۱٬۲۵۰٫۵٪')).toBe('1,250.5%');
  });

  it('leaves Latin digits unchanged', () => {
    expect(toLatinDigits('90+ 1,250 XP')).toBe('90+ 1,250 XP');
  });

  it('pins Arabic locales to Latin numbering', () => {
    expect(localeWithLatinNumerals('ar')).toBe('ar-EG-u-nu-latn');
    expect(localeWithLatinNumerals('ar-SA')).toBe('ar-EG-u-nu-latn');
    expect(localeWithLatinNumerals('en')).toBe('en-US');
  });

  it('keeps Intl Arabic output on Western digits', () => {
    const formatted = new Intl.NumberFormat('ar-EG').format(1234);
    expect(hasNonLatinDigits(formatted)).toBe(false);
    expect(formatted).toMatch(/1/);
  });

  it('keeps date numbers Latin when the locale is Arabic', () => {
    const formatted = new Date(2026, 8, 11).toLocaleDateString('ar-EG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    expect(hasNonLatinDigits(formatted)).toBe(false);
    expect(formatted).toMatch(/2026/);
  });

  it('does not store Eastern digits in Arabic copy', () => {
    expect(collectNonLatinDigitStrings(ar)).toEqual([]);
  });
});
