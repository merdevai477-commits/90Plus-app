/**
 * Language-aware rendering for the Predict & Win feature.
 *
 * Three separate things leaked Arabic into the English build and all three are
 * resolved here rather than at each call site:
 *
 *  1. **Server-provided values.** `PrizeCategory` only ever stored `nameAr`
 *     and an Arabic `description`, so the category grid rendered Arabic no
 *     matter what language the app was in. The API now also returns `nameEn` /
 *     `descriptionEn`; `categoryName` prefers those, falls back to the bundled
 *     label for the row's `key`, and only then to the Arabic column — so the
 *     English build reads correctly both before and after the data migration.
 *  2. **Server error prose.** The API's messages are Arabic-only. Requests now
 *     reject with a `CompetitionApiError` carrying a stable code, and
 *     `errorMessage` turns that into copy from the active locale.
 *  3. **Dates, times and durations.** `toLocaleDateString('ar-EG')` and the
 *     hardcoded "س / د / ث" countdown suffixes were Arabic on every screen.
 */

import { useCallback, useMemo } from 'react';

import { useTranslation } from '../../src/i18n';
import {
  CompetitionApiError,
  isKnownCompetitionError,
  type PrizeCategoryInfo,
} from '../../services/competitions.service';

/** BCP-47 tag for `Intl` / `toLocale*String`, derived from the app language. */
export function intlLocale(language: string): string {
  return language === 'ar' ? 'ar-EG' : 'en-GB';
}

export interface PWLocalize {
  language: string;
  locale: string;
  categoryName: (category: Pick<PrizeCategoryInfo, 'key' | 'nameAr' | 'nameEn'>) => string;
  categoryDescription: (
    category: Pick<PrizeCategoryInfo, 'key' | 'description' | 'descriptionEn'>,
  ) => string;
  /** Localized label for a stored `Competition.prizeType`. */
  prizeTypeLabel: (prizeType: string) => string;
  /** Copy for a thrown error, whatever its shape. */
  errorMessage: (error: unknown) => string;
  /** `12/09/2026` in en, `٢٠٢٦/٠٩/١٢` in ar — matches Figma's date field. */
  formatDate: (date: Date) => string;
  /** Short day + month, e.g. `12 Sep`. */
  formatDayMonth: (date: Date) => string;
  /** `10:30 PM`. */
  formatTime: (date: Date) => string;
  /** Countdown, e.g. `10h 42m 45s` / `١٠ س ٤٢ د ٤٥ ث`. */
  formatRemaining: (msRemaining: number) => string;
}

export function usePWLocalize(): PWLocalize {
  const { t, language } = useTranslation();
  const pw = t.predictAndWin;
  const locale = intlLocale(language);
  const isEnglish = language !== 'ar';

  const categoryName = useCallback(
    (category: Pick<PrizeCategoryInfo, 'key' | 'nameAr' | 'nameEn'>) => {
      if (!isEnglish) return category.nameAr;
      const fromApi = category.nameEn?.trim();
      if (fromApi) return fromApi;
      return (pw.categories as Record<string, { name: string } | undefined>)[category.key]?.name
        ?? category.nameAr;
    },
    [isEnglish, pw.categories],
  );

  const categoryDescription = useCallback(
    (category: Pick<PrizeCategoryInfo, 'key' | 'description' | 'descriptionEn'>) => {
      if (!isEnglish) return category.description ?? '';
      const fromApi = category.descriptionEn?.trim();
      if (fromApi) return fromApi;
      return (
        (pw.categories as Record<string, { description: string } | undefined>)[category.key]
          ?.description ?? category.description ?? ''
      );
    },
    [isEnglish, pw.categories],
  );

  /**
   * `Competition.prizeType` is free text. Rows created by the fixed wizard
   * store the category `key`; rows created before it stored the Arabic name,
   * which has no key to look up and is returned unchanged.
   */
  const prizeTypeLabel = useCallback(
    (prizeType: string) => {
      const entry = (pw.categories as Record<string, { name: string } | undefined>)[prizeType];
      return entry?.name ?? prizeType;
    },
    [pw.categories],
  );

  const errorMessage = useCallback(
    (error: unknown) => {
      const copy = pw.errors as Record<string, string | undefined>;
      const code =
        error instanceof CompetitionApiError
          ? error.code
          : error instanceof Error
            ? error.message
            : '';
      if (code && isKnownCompetitionError(code) && copy[code]) return copy[code] as string;
      return copy.GENERIC as string;
    },
    [pw.errors],
  );

  const formatDate = useCallback(
    (date: Date) =>
      date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    [locale],
  );

  const formatDayMonth = useCallback(
    (date: Date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
    [locale],
  );

  const formatTime = useCallback(
    (date: Date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );

  const formatRemaining = useCallback(
    (msRemaining: number) => {
      const total = Math.max(0, Math.floor(msRemaining / 1000));
      const u = pw.duration;
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const sec = total % 60;
      if (h >= 24) return `${Math.floor(h / 24)} ${u.day} ${h % 24} ${u.hour}`;
      return `${h} ${u.hour} ${m} ${u.minute} ${sec} ${u.second}`;
    },
    [pw.duration],
  );

  return useMemo(
    () => ({
      language,
      locale,
      categoryName,
      categoryDescription,
      prizeTypeLabel,
      errorMessage,
      formatDate,
      formatDayMonth,
      formatTime,
      formatRemaining,
    }),
    [
      language,
      locale,
      categoryName,
      categoryDescription,
      prizeTypeLabel,
      errorMessage,
      formatDate,
      formatDayMonth,
      formatTime,
      formatRemaining,
    ],
  );
}
