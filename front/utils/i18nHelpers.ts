/**
 * i18nHelpers — Localization utilities for football-domain content
 *
 * These helpers cover content that comes from APIs (team names, match
 * statuses, server error codes) and need to be displayed in the user's
 * current language with safe fallbacks.
 *
 * Design rules:
 *  - Never throw — always fall back to the original input.
 *  - Never expose internal error details to users.
 *  - Pure functions only; no side effects so they can be called from
 *    render paths without re-render churn.
 */

import type { Language } from '../src/i18n/types';
import { translations } from '../src/i18n/utils';
import { teamArabicNames } from '../data/teamArabicNames';
import {
  AMBIGUOUS_LEAGUE_NAMES,
  LEAGUE_BY_ID,
  LEAGUE_NAME_COUNTRY_ID,
  LEAGUES,
  normalizeLeagueCountryKey,
} from '../data/leagues';
import { ALL_COUNTRY_FLAGS } from '../data/localCountryFlags';
import { COUNTRIES } from '../data/countries';
import {
  getCachedFootballTranslation,
  queueFootballTranslation,
} from '../src/stores/footballTranslationStore';

// ─── Team name localization ───────────────────────────────────────────────────

/**
 * Resolve a team's display name for the current locale.
 *
 * Behaviour:
 *  - Arabic locale: tries the Arabic mapping first; falls back to the
 *    original English name if no translation exists.
 *  - English (or any other locale): always returns the original name.
 *  - Empty / unknown input returns a safe placeholder pulled from the
 *    common translations.
 */
function lookupArabicLabel(originalName: string): string | null {
  const candidates = [
    originalName,
    originalName.toLowerCase(),
    originalName.replace(/\s+FC$/i, '').trim(),
    originalName.replace(/\s+CF$/i, '').trim(),
    originalName.replace(/\s+SC$/i, '').trim(),
  ];
  for (const key of candidates) {
    const ar = teamArabicNames[key];
    if (ar && ar.trim().length > 0) return ar;
  }

  const lower = originalName.toLowerCase();
  const fromFlags = ALL_COUNTRY_FLAGS.find(
    (c) => c.name.toLowerCase() === lower || c.nameAr === originalName,
  );
  if (fromFlags?.nameAr) return fromFlags.nameAr;

  const fromCountries = COUNTRIES.find(
    (c) => c.nameEn.toLowerCase() === lower || c.name === originalName,
  );
  if (fromCountries?.name) return fromCountries.name;

  return null;
}

export function getTeamDisplayName(
  originalName: string | null | undefined,
  language: Language,
): string {
  const fallback = translations[language]?.common?.unknown
    ?? translations.en.common.unknown
    ?? 'Unknown';

  const name = (originalName ?? '').trim();
  if (!name) return fallback;

  if (language === 'ar') {
    const ar = lookupArabicLabel(name);
    if (ar) return ar;
    const cached = getCachedFootballTranslation(name);
    if (cached) return cached;
    queueFootballTranslation(name, language);
  }
  return name;
}

/** Localized country label (API returns English names like "Morocco", "Argentina"). */
export function getCountryDisplayName(
  originalName: string | null | undefined,
  language: Language,
): string {
  return getTeamDisplayName(originalName, language);
}

const KNOWN_LEAGUE_ARABIC_KEYS = new Set(
  LEAGUES.map((l) => l.name.toLowerCase()).concat([
    'championship',
    'uefa champions league',
    'champions league',
    'uefa europa league',
    'europa league',
    'uefa europa conference league',
    'a-league',
    'a league',
    'scottish premiership',
    'major league soccer',
    'mls',
    'j1 league',
    'egyptian premier league',
    'saudi pro league',
    'iraqi premier league',
    'jordanian pro league',
    'west bank premier league',
    'yemeni league',
    'sudani premier league',
    'ligat ha\'al',
  ]),
);

function lookupCuratedLeagueArabic(
  name: string,
  leagueId?: number | null,
  country?: string | null,
): string | null {
  if (leagueId != null) {
    const byId = LEAGUE_BY_ID.get(leagueId);
    if (byId?.nameAr) return byId.nameAr;
  }

  const lowerName = name.trim().toLowerCase();
  if (!lowerName) return null;

  const countryKey = normalizeLeagueCountryKey(country);
  const disambigId = LEAGUE_NAME_COUNTRY_ID[lowerName]?.[countryKey];
  if (disambigId != null) {
    const byCountry = LEAGUE_BY_ID.get(disambigId);
    if (byCountry?.nameAr) return byCountry.nameAr;
  }

  if (AMBIGUOUS_LEAGUE_NAMES.has(lowerName)) {
    return null;
  }

  const byName = LEAGUES.find((l) => l.name.toLowerCase() === lowerName);
  if (byName?.nameAr) return byName.nameAr;

  if (KNOWN_LEAGUE_ARABIC_KEYS.has(lowerName)) {
    const fromMap = teamArabicNames[name] ?? teamArabicNames[lowerName];
    if (fromMap) return fromMap;
  }

  return null;
}

function shouldSkipAutoLeagueTranslation(
  name: string,
  leagueId?: number | null,
  country?: string | null,
): boolean {
  if (leagueId != null) return false;
  const lowerName = name.trim().toLowerCase();
  if (!lowerName) return true;
  if (AMBIGUOUS_LEAGUE_NAMES.has(lowerName)) return true;
  if (LEAGUE_NAME_COUNTRY_ID[lowerName] && !normalizeLeagueCountryKey(country)) {
    return true;
  }
  return false;
}

/**
 * Localized league/competition name. Checks the curated leagues list by id
 * and country first — never maps unknown leagues to the English Premier League.
 */
export function getLeagueDisplayName(
  originalName: string | null | undefined,
  language: Language,
  leagueId?: number | null,
  country?: string | null,
): string {
  const fallback = translations[language]?.common?.unknown
    ?? translations.en.common.unknown
    ?? 'Unknown';

  const name = (originalName ?? '').trim();
  if (!name && !leagueId) return fallback;

  if (language === 'ar') {
    const curated = lookupCuratedLeagueArabic(name, leagueId, country);
    if (curated) return curated;

    if (name && !shouldSkipAutoLeagueTranslation(name, leagueId, country)) {
      const cached = getCachedFootballTranslation(name);
      if (cached) return cached;
      queueFootballTranslation(name, language);
    }
  }
  return name || fallback;
}

// ─── Match status localization ────────────────────────────────────────────────

/**
 * Map an API-football status code (or our internal short status) to a
 * localized human label. Covers both the long status strings used by the
 * provider and the short codes returned by `/api-football` (NS, 1H, HT,
 * 2H, FT, AET, PEN, ET, BT, P, LIVE, INT, PST, CANC, ABD, AWD, WO, TBD,
 * SUSP).
 */
export function getLocalizedMatchStatus(
  status: string | null | undefined,
  language: Language,
): string {
  const raw = (status ?? '').toString().trim();
  if (!raw) {
    return translations[language]?.matches?.status?.upcoming
      ?? translations.en.matches.status.upcoming;
  }

  const tMatches = translations[language]?.matches ?? translations.en.matches;
  const tStatus = tMatches.status ?? translations.en.matches.status;
  const tLeagues = translations[language]?.leagues ?? translations.en.leagues;

  const upper = raw.toUpperCase();

  const anyStatus = tStatus as Record<string, string | undefined>;

  switch (upper) {
    case 'LIVE':
    case '1H':
    case '2H':
      return tStatus.live ?? 'LIVE';

    case 'ET':
    case 'BT':
      return anyStatus.extraTime ?? tStatus.live ?? 'ET';

    case 'P':
      return anyStatus.penaltyShootout ?? anyStatus.penalties ?? 'Penalties';

    case 'INT':
      return anyStatus.interrupted ?? tStatus.live ?? 'INT';

    case 'HT':
      return tStatus.halftime ?? 'HT';

    case 'FT':
      return tStatus.finished ?? 'FT';

    case 'AET':
      return anyStatus.afterExtraTime ?? tStatus.finished ?? 'AET';

    case 'PEN':
      return anyStatus.penalties ?? 'PEN';

    case 'CANC':
      return anyStatus.cancelled ?? 'Cancelled';

    case 'ABD':
      return anyStatus.abandoned ?? 'Abandoned';

    case 'AWD':
    case 'WO':
      return anyStatus.walkover ?? 'Walkover';

    case 'SUSP':
      return anyStatus.suspended ?? 'Suspended';

    case 'PST':
      return anyStatus.postponed ?? tStatus.upcoming ?? 'Postponed';

    case 'NS':
    case 'TBD':
    case 'UPCOMING':
      return tStatus.upcoming ?? 'UPCOMING';

    case 'FINISHED':
      return tStatus.finished ?? 'FT';

    default:
      return raw;
  }
}

// ─── Server error code localization ──────────────────────────────────────────

/**
 * Map a backend error code (E001–E010) to a user-safe localized message.
 * Falls back to a generic "something went wrong" string for unknown codes,
 * never exposing the raw server message.
 */
export function getLocalizedErrorMessage(
  errorCode: string | null | undefined,
  language: Language,
  fallbackMessage?: string,
): string {
  const code = (errorCode ?? '').toUpperCase();
  const tErrors = translations[language]?.errorCodes ?? translations.en.errorCodes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = tErrors as Record<string, string>;
  if (code && map?.[code]) return map[code];

  // Fallback chain: unknown code → known generic key → caller fallback → static
  if (map?.unknown) return map.unknown;
  if (fallbackMessage) return fallbackMessage;
  return translations[language]?.common?.errorOccurred
    ?? translations.en.common.errorOccurred
    ?? 'Something went wrong';
}

/**
 * Convenience wrapper for any `Error | unknown` thrown by the network
 * layer. Picks up `error.code`, `error.errorCode`, or `error.error` if
 * present (matches the backend response shape `{ error, message, ... }`).
 */
export function getLocalizedErrorFromUnknown(
  error: unknown,
  language: Language,
): string {
  if (!error) return getLocalizedErrorMessage(null, language);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = error as any;
  const code = anyErr?.code ?? anyErr?.errorCode ?? anyErr?.error;
  const msg = typeof anyErr?.message === 'string' ? anyErr.message : undefined;
  return getLocalizedErrorMessage(code, language, msg);
}

// ─── Push notification template helpers ──────────────────────────────────────

export type PushVariables = Record<string, string | number>;

/**
 * Render a push-notification key with placeholder substitution. Used by
 * the frontend when constructing local notifications and as a reference
 * for backend push templates (mirror in src/services/notifications).
 */
export function renderPushTemplate(
  key: string,
  language: Language,
  vars: PushVariables = {},
): string {
  const tPush = translations[language]?.pushNotifications
    ?? translations.en.pushNotifications;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = tPush as Record<string, string>;
  const template = map?.[key];
  if (!template) return '';

  return Object.entries(vars).reduce((acc, [k, v]) => {
    return acc
      .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }, template);
}

// ─── Direction-aware spacing helpers ─────────────────────────────────────────

/**
 * Pick a layout token by direction. Use this for icon/text alignment that
 * differs between RTL and LTR — e.g. chevrons, drawer positions.
 *
 * Keep `start`/`end` style props for everything else; this is only for
 * legacy code paths where left/right is semantically meaningful (icon
 * orientation, animation direction).
 */
export function pickByDirection<T>(isRTL: boolean, ltr: T, rtl: T): T {
  return isRTL ? rtl : ltr;
}


// ─── Profile completion step label localization ──────────────────────────────

/**
 * Translate a profile-completion step label by id. Used by the profile
 * completion service / UI so the service stays language-neutral and the
 * label displayed to the user always matches the active locale.
 *
 * Falls back to the provided `serverLabel` (whatever the backend returned)
 * if we don't know that step id, keeping the UI safe when new step types
 * roll out before the locale files are updated.
 */
export function getProfileCompletionStepLabel(
  stepId: string,
  language: Language,
  serverLabel?: string,
): string {
  const tProfile = translations[language]?.profile ?? translations.en.profile;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = (tProfile as any).completionSteps as Record<string, string> | undefined;
  if (map?.[stepId]) return map[stepId];
  if (serverLabel && serverLabel.trim().length > 0) return serverLabel;
  return stepId;
}
