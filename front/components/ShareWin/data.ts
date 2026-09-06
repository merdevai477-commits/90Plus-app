/**
 * Share & Win — pure helpers.
 *
 * Formatting and presentation only. Nothing here derives a score or a rank:
 * those are computed by the backend and rendered verbatim.
 */

import type { Language } from '../../src/i18n';
import type {
  ShareWinLastWinner,
  ShareWinPrize,
} from '../../services/shareWin.service';
import { PRIZE_FALLBACK_IMAGE, PRIZE_FALLBACK_ORDER } from './assets';

export interface CountdownParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

/** Split a remaining-milliseconds value into zero-padded countdown parts. */
export function splitCountdown(remainingMs: number): CountdownParts {
  const safe = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
}

/** Locale-aware thousands separators — Figma shows "1,250" and "3,250 xp". */
export function formatNumber(value: number, language: Language): string {
  try {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US').format(value);
  } catch {
    return String(value);
  }
}

/**
 * Participation count shown on ranking rows. The number and unit are separate
 * text runs because they have different sizes/colours.
 */
export function formatScore(value: number, language: Language): string {
  return formatNumber(value, language);
}

/** Prize copy in the active language, with the backend value winning. */
export function prizeCopy(prize: ShareWinPrize, language: Language) {
  const isArabic = language === 'ar';
  return {
    title: (isArabic ? prize.title : prize.titleEn) || prize.title,
    subtitle: (isArabic ? prize.subtitle : prize.subtitleEn) || prize.subtitle,
  };
}

/** Remote prize art if the cycle configured any, else the bundled Figma art. */
export function prizeImageSource(prize: ShareWinPrize, index: number) {
  if (prize.imageUrl) return { uri: prize.imageUrl };
  return (
    PRIZE_FALLBACK_IMAGE[prize.id] ??
    PRIZE_FALLBACK_ORDER[index % PRIZE_FALLBACK_ORDER.length]
  );
}

/**
 * "منذ 2 ساعة" / "2h ago" for the last-winner card.
 * Takes the templates from i18n so neither language is hardcoded here.
 */
export function formatWinnerAge(
  winner: ShareWinLastWinner,
  templates: { hours: string; days: string; now: string },
  now = Date.now(),
): string {
  if (!winner.closedAt) return templates.now;

  const elapsed = now - new Date(winner.closedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60 * 60 * 1000) return templates.now;

  const hours = Math.floor(elapsed / (60 * 60 * 1000));
  if (hours < 24) return templates.hours.replace('{count}', String(hours));

  const days = Math.floor(hours / 24);
  return templates.days.replace('{count}', String(days));
}

/** Display name for a leaderboard/winner row, falling back to the username. */
export function displayNameOf(entry: {
  displayName?: string | null;
  username: string;
}): string {
  const name = entry.displayName?.trim();
  return name && name.length > 0 ? name : entry.username;
}

/**
 * Shorten a referral link so it fits the 371pt field without wrapping,
 * preserving the code (the part that matters) at the tail.
 */
export function compactLink(link: string, maxLength = 34): string {
  if (link.length <= maxLength) return link;
  const withoutScheme = link.replace(/^https?:\/\//i, '');
  if (withoutScheme.length <= maxLength) return withoutScheme;
  const code = withoutScheme.slice(withoutScheme.lastIndexOf('/') + 1);
  const host = withoutScheme.slice(0, withoutScheme.indexOf('/'));
  return `${host}/…/${code}`;
}
