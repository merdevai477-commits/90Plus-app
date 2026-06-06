import type { Language } from './types';

/** Arabic plural form for "point" (نقطة / نقطتان / نقاط). */
export function arabicPointWord(count: number): string {
  if (count === 2) return 'نقطتان';
  const mod100 = count % 100;
  if (mod100 >= 3 && mod100 <= 10) return 'نقاط';
  const mod10 = count % 10;
  if (mod10 >= 3 && mod10 <= 10) return 'نقاط';
  return 'نقطة';
}

/** Full XP label, e.g. "431 نقطة" (AR) or "431 XP" (EN). */
export function formatXpLabel(count: number, language: Language): string {
  if (language === 'ar') {
    return `${count} ${arabicPointWord(count)}`;
  }
  return `${count} XP`;
}
