import { CommunityApiError } from '../../services/community.api';
import type { TranslationKeys } from '../../src/i18n/utils';

type CommunityStrings = TranslationKeys['community'];

const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

export { fill as fillTemplate };

/** 999 → "999", 1200 → "1.2k", 2000 → "2k", 1_500_000 → "1.5m". */
export function formatCount(n: number): string {
  if (n < 1000) return String(Math.max(0, n));
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.floor(v) : Math.floor(v * 10) / 10}k`.replace('.0k', 'k');
  }
  const v = n / 1_000_000;
  return `${v >= 10 ? Math.floor(v) : Math.floor(v * 10) / 10}m`.replace('.0m', 'm');
}

export function formatRelativeTime(iso: string, s: CommunityStrings, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return s.justNow;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return fill(s.minutesShort, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return fill(s.hoursShort, { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return fill(s.daysShort, { n: days });
  return fill(s.weeksShort, { n: Math.floor(days / 7) });
}

/** User-facing message for any Community API failure. */
export function communityErrorMessage(err: unknown, s: CommunityStrings): string {
  if (!(err instanceof CommunityApiError)) return s.genericError;
  const seconds = err.retryAfterSec ?? 0;
  switch (err.code) {
    case 'PROFANITY_DETECTED':
      return s.profanity;
    case 'IMAGE_REJECTED':
      return s.imageRejected;
    case 'IMAGE_OFF_TOPIC':
      return s.imageOffTopic;
    case 'IMAGE_SCAN_FAILED':
      return s.imageScanFailed;
    case 'SPAM_DETECTED':
      return s.spam;
    case 'POST_COOLDOWN':
      return seconds > 3600 ? s.dailyLimit : fill(s.postCooldown, { seconds });
    case 'COMMENT_COOLDOWN':
      return fill(s.commentCooldown, { seconds });
    case 'MEDIA_COOLDOWN':
      return fill(s.mediaCooldown, { seconds });
    case 'COMMENT_LIMIT_PER_POST':
      return s.commentLimitPerPost;
    case 'ACCOUNT_SUSPENDED':
      return s.suspended;
    case 'POST_TOO_LONG':
    case 'COMMENT_TOO_LONG':
      return fill(s.tooLong, { max: err.max ?? '' });
    case 'MEDIA_NOT_FOUND':
      return s.imageExpired;
    case 'INVALID_IMAGE':
    case 'STORAGE_UPLOAD_FAILED':
    case 'UPLOAD_FAILED':
      return s.imageFailed;
    case 'POST_NOT_FOUND':
      return s.postNotFound;
    default:
      return s.genericError;
  }
}

export function isImageRejected(err: unknown): boolean {
  return err instanceof CommunityApiError && (err.code === 'IMAGE_REJECTED' || err.code === 'IMAGE_OFF_TOPIC');
}

/** Errors the user can fix by editing their text — keep the composer open. */
export function isContentRejection(err: unknown): boolean {
  return (
    err instanceof CommunityApiError &&
    ['PROFANITY_DETECTED', 'IMAGE_REJECTED', 'IMAGE_OFF_TOPIC', 'SPAM_DETECTED', 'POST_TOO_LONG', 'COMMENT_TOO_LONG', 'EMPTY_POST', 'EMPTY_COMMENT'].includes(err.code)
  );
}
