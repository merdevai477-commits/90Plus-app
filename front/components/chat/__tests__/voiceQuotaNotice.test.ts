import { ar } from '../../../locales/ar';
import { en } from '../../../locales/en';
import {
  describeVoiceReset,
  formatResetClock,
  formatVoiceTimeLeft,
  voiceExhaustedNotice,
} from '../voiceQuotaNotice';

/** Local wall-clock times, so the calendar-day logic is exercised in any timezone. */
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);

describe('describeVoiceReset', () => {
  const now = at(13, 15, 30);

  it('a reset on the next calendar day is "tomorrow"', () => {
    expect(describeVoiceReset(at(14, 9).toISOString(), now).kind).toBe('tomorrow');
    expect(describeVoiceReset(at(14, 23, 59).toISOString(), now).kind).toBe('tomorrow');
  });

  it('a reset later today is never called "tomorrow"', () => {
    const when = describeVoiceReset(at(13, 23, 10).toISOString(), now);
    expect(when.kind).toBe('today');
  });

  it('a reset just after midnight is tomorrow', () => {
    expect(describeVoiceReset(at(14, 0, 5).toISOString(), at(13, 23, 50)).kind).toBe('tomorrow');
  });

  it('promises nothing when the time is missing, malformed, already past, or further out', () => {
    expect(describeVoiceReset(null, now).kind).toBe('unknown');
    expect(describeVoiceReset('not a date', now).kind).toBe('unknown');
    expect(describeVoiceReset(at(13, 15).toISOString(), now).kind).toBe('unknown');
    expect(describeVoiceReset(at(16, 9).toISOString(), now).kind).toBe('unknown');
  });
});

describe('voiceExhaustedNotice', () => {
  const now = at(13, 15, 30);

  it('uses the short default when voice returns tomorrow', () => {
    expect(voiceExhaustedNotice(at(14, 11).toISOString(), now, 'ar', ar.chat)).toBe(
      'خلصت دقايق الصوت النهارده 🎙️ هترجع بكرة!',
    );
    expect(voiceExhaustedNotice(at(14, 11).toISOString(), now, 'en', en.chat)).toBe(
      "You're out of voice time for today. It'll be back tomorrow! 🎙️",
    );
  });

  it('names the time when voice returns later today', () => {
    expect(voiceExhaustedNotice(at(13, 21, 5).toISOString(), now, 'ar', ar.chat)).toBe(
      'خلصت دقايق الصوت 🎙️ الصوت هيرجع متاح الساعة 9:05 م',
    );
    expect(voiceExhaustedNotice(at(13, 21, 5).toISOString(), now, 'en', en.chat)).toBe(
      "You're out of voice time. It'll be back at 9:05 PM 🎙️",
    );
  });

  it('falls back to wording without a time when the reset is unknown', () => {
    expect(voiceExhaustedNotice(null, now, 'ar', ar.chat)).toBe(ar.chat.voiceExhaustedLater);
    expect(voiceExhaustedNotice(null, now, 'en', en.chat)).toBe(en.chat.voiceExhaustedLater);
    expect(ar.chat.voiceExhaustedLater).not.toMatch(/بكرة|الساعة/);
  });
});

describe('formatting', () => {
  it('formats the reset clock in 12h with the right suffix', () => {
    expect(formatResetClock(at(13, 0, 7), 'ar')).toBe('12:07 ص');
    expect(formatResetClock(at(13, 12, 0), 'en')).toBe('12:00 PM');
  });

  it('formats the time left as m:ss', () => {
    expect(formatVoiceTimeLeft(150)).toBe('2:30');
    expect(formatVoiceTimeLeft(45)).toBe('0:45');
    expect(formatVoiceTimeLeft(0)).toBe('0:00');
  });
});
