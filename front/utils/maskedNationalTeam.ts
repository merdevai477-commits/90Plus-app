/**
 * Match-card presentation for the senior Israel national team.
 * Keep in sync with src/utils/masked-national-team.ts (365Scores competitor 5034).
 * Club sides and youth teams stay as they are.
 */

import type { Language } from '../src/i18n/types';
import { getTeamDisplayName } from './i18nHelpers';

export const MASKED_TEAM_NAME = 'غير معروف';
export const MASKED_TEAM_LOGO_URL = 'https://90plus.pro/unknown-team.png';

/** Bundled crest so the question mark shows even before the static file is fetched. */
export const QUESTION_MARK_TEAM_LOGO =
  'data:image/png;base64,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';

const ISRAEL_NT_COMPETITOR_ID = 5034;

const NAMES = new Set([
  'israel',
  'state of israel',
  'israel national team',
  'israel nt',
  'إسرائيل',
  'اسرائيل',
  'ישראל',
  'منتخب إسرائيل',
  'منتخب اسرائيل',
]);

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isIsraelSeniorNationalTeam(
  name?: string | null,
  id?: number | null,
  logo?: string | null,
): boolean {
  if (id === ISRAEL_NT_COMPETITOR_ID) return true;
  if (logo && /\/Competitors\/5034(?:[/?#]|$)/.test(logo)) return true;
  const n = norm(name ?? '');
  if (!n || !NAMES.has(n)) return false;
  return true;
}

function isMaskedLabel(name?: string | null, logo?: string | null): boolean {
  const n = (name ?? '').trim();
  if (n === MASKED_TEAM_NAME) return true;
  if (!logo) return false;
  return logo === MASKED_TEAM_LOGO_URL || logo === QUESTION_MARK_TEAM_LOGO;
}

export function presentTeamLogo(
  name?: string | null,
  logo?: string | null,
  id?: number | null,
): string {
  if (isIsraelSeniorNationalTeam(name, id, logo) || isMaskedLabel(name, logo)) {
    return QUESTION_MARK_TEAM_LOGO;
  }
  return logo ?? '';
}

/** Raw list name. Only the senior national team is replaced; other names stay for localization. */
export function storedMatchTeamName(
  name?: string | null,
  logo?: string | null,
  id?: number | null,
): string {
  const raw = (name ?? '').trim();
  if (isIsraelSeniorNationalTeam(raw, id, logo)) return MASKED_TEAM_NAME;
  return raw;
}

/** Visible team label. Israel senior national team becomes غير معروف / Unknown. */
export function displayMatchTeamName(
  name: string | null | undefined,
  language: Language,
  id?: number | null,
  logo?: string | null,
): string {
  const raw = (name ?? '').trim();
  if (isIsraelSeniorNationalTeam(raw, id, logo) || raw === MASKED_TEAM_NAME || raw === 'Unknown') {
    return language === 'ar' ? MASKED_TEAM_NAME : 'Unknown';
  }
  return getTeamDisplayName(raw, language, id);
}
