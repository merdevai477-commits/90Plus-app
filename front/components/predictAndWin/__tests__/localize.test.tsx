/**
 * Regression tests for "Arabic text appears in the English app".
 *
 * Each case here maps to a place the feature leaked Arabic into the English
 * build:
 *  - `PrizeCategory` only stored `nameAr` / an Arabic `description`, and the
 *    grid rendered those columns directly, so every category card was Arabic
 *    regardless of language.
 *  - The competition detail screen's countdown built its string from hardcoded
 *    "س / د / ث" suffixes, so English read "10 س 42 د 45 ث".
 *  - The API's error prose is Arabic only and was surfaced verbatim in toasts.
 */

import { renderHook } from '@testing-library/react-native';

import { usePWLocalize } from '../localize';
import { CompetitionApiError } from '../../../services/competitions.service';
import { useTranslation } from '../../../src/i18n';
import en from '../../../locales/en';
import ar from '../../../locales/ar';

jest.mock('../../../src/i18n', () => ({ useTranslation: jest.fn() }));

const mockedUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

function speaking(language: 'en' | 'ar') {
  mockedUseTranslation.mockReturnValue({
    t: language === 'ar' ? ar : en,
    language,
    isRTL: language === 'ar',
  } as never);
  return renderHook(() => usePWLocalize()).result;
}

const CASH = {
  key: 'cash',
  nameAr: 'كاش',
  nameEn: null,
  description: 'جوائز مالية ومبالغ نقدية من 100 جنيه إلى أكثر',
  descriptionEn: null,
};

const ARABIC = /[؀-ۿ]/;

describe('usePWLocalize', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('server-provided category names', () => {
    it('never renders the Arabic column in the English build', () => {
      const { current } = speaking('en');
      expect(current.categoryName(CASH)).toBe('Cash');
      expect(ARABIC.test(current.categoryName(CASH))).toBe(false);
      expect(ARABIC.test(current.categoryDescription(CASH))).toBe(false);
    });

    it('prefers the API English columns once the migration has landed', () => {
      const { current } = speaking('en');
      expect(
        current.categoryName({ ...CASH, nameEn: 'Cash prizes' }),
      ).toBe('Cash prizes');
      expect(
        current.categoryDescription({ ...CASH, descriptionEn: 'From 100 EGP' }),
      ).toBe('From 100 EGP');
    });

    it('falls back to the Arabic column for a key the app does not know', () => {
      const { current } = speaking('en');
      const custom = { key: 'mystery-box', nameAr: 'صندوق', nameEn: null };
      expect(current.categoryName(custom)).toBe('صندوق');
    });

    it('still renders Arabic in the Arabic build', () => {
      const { current } = speaking('ar');
      expect(current.categoryName({ ...CASH, nameEn: 'Cash' })).toBe('كاش');
    });
  });

  describe('countdown suffixes', () => {
    it('uses Latin unit letters in English', () => {
      const { current } = speaking('en');
      const text = current.formatRemaining((10 * 3600 + 42 * 60 + 45) * 1000);
      expect(text).toBe('10 h 42 m 45 s');
      expect(ARABIC.test(text)).toBe(false);
    });

    it('uses Arabic unit letters in Arabic', () => {
      const { current } = speaking('ar');
      expect(current.formatRemaining((10 * 3600 + 42 * 60 + 45) * 1000)).toBe(
        '10 س 42 د 45 ث',
      );
    });

    it('switches to days once more than 24 hours remain', () => {
      const { current } = speaking('en');
      expect(current.formatRemaining((50 * 3600) * 1000)).toBe('2 d 2 h');
    });
  });

  describe('server errors', () => {
    it('renders the code, not the API’s Arabic prose', () => {
      const { current } = speaking('en');
      const error = new CompetitionApiError('DEADLINE_PASSED', 'انتهى وقت التوقع لهذه المسابقة');
      expect(current.errorMessage(error)).toBe(
        'Predictions are closed for this competition',
      );
      expect(ARABIC.test(current.errorMessage(error))).toBe(false);
    });

    it('falls back to generic copy for an unmapped failure', () => {
      const { current } = speaking('en');
      expect(current.errorMessage(new Error('Network request failed'))).toBe(
        'Something went wrong. Please try again',
      );
      expect(current.errorMessage(undefined)).toBe('Something went wrong. Please try again');
    });
  });

  describe('dates', () => {
    it('does not format with a hardcoded Arabic locale', () => {
      const kickoff = new Date(2026, 8, 12, 22, 30);
      const { current } = speaking('en');
      expect(ARABIC.test(current.formatDayMonth(kickoff))).toBe(false);
      expect(ARABIC.test(current.formatDate(kickoff))).toBe(false);
      // Figma's date field reads `12/09/2026`.
      expect(current.formatDate(kickoff)).toBe('12/09/2026');
    });
  });
});
