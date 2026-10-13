/**
 * Wording for the "voice time used up" notice. The server's `voiceResetAt`
 * decides when voice comes back; the device clock only decides how to phrase
 * it (today at a time / tomorrow), never whether voice is available.
 */

export type VoiceResetWhen =
  | { kind: 'today'; date: Date }
  | { kind: 'tomorrow'; date: Date }
  | { kind: 'unknown' };

function startOfDay(d: Date, addDays = 0): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + addDays);
  return out;
}

export function describeVoiceReset(resetAt: string | null | undefined, now: Date): VoiceResetWhen {
  if (!resetAt) return { kind: 'unknown' };
  const date = new Date(resetAt);
  const ms = date.getTime();
  // A reset time already behind us means our copy of the quota is stale.
  if (!Number.isFinite(ms) || ms <= now.getTime()) return { kind: 'unknown' };
  if (ms < startOfDay(now, 1).getTime()) return { kind: 'today', date };
  if (ms < startOfDay(now, 2).getTime()) return { kind: 'tomorrow', date };
  return { kind: 'unknown' };
}

/** "3:05 م" / "3:05 PM" — Latin digits like the rest of the app. */
export function formatResetClock(date: Date, language: 'ar' | 'en'): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const suffix = language === 'ar' ? (h < 12 ? 'ص' : 'م') : h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${m} ${suffix}`;
}

export type VoiceNoticeStrings = {
  voiceExhaustedTomorrow: string;
  /** Contains `{time}`. */
  voiceExhaustedAt: string;
  voiceExhaustedLater: string;
};

export function voiceExhaustedNotice(
  resetAt: string | null | undefined,
  now: Date,
  language: 'ar' | 'en',
  strings: VoiceNoticeStrings,
): string {
  const when = describeVoiceReset(resetAt, now);
  if (when.kind === 'tomorrow') return strings.voiceExhaustedTomorrow;
  if (when.kind === 'today') {
    return strings.voiceExhaustedAt.replace('{time}', formatResetClock(when.date, language));
  }
  return strings.voiceExhaustedLater;
}

/** Badge text for the time left: "2:30", "0:45". */
export function formatVoiceTimeLeft(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
