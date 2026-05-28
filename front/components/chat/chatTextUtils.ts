import { TextStyle } from 'react-native';

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/** True when a meaningful share of non-whitespace chars are Arabic script. */
export function isArabicText(text: string): boolean {
  const stripped = text.replace(/\s/g, '');
  if (!stripped.length) return false;
  const arabicCount = (stripped.match(ARABIC_RE) ?? []).length;
  return arabicCount / stripped.length >= 0.3;
}

export function getTextDirectionStyles(text: string): Pick<TextStyle, 'textAlign' | 'writingDirection'> {
  if (isArabicText(text)) {
    return { textAlign: 'right', writingDirection: 'rtl' };
  }
  return { textAlign: 'left', writingDirection: 'ltr' };
}

const BUBBLE_MAX_CAP = 560;

/** Bubble max width ~84% of screen, capped for tablets (ChatGPT-style). */
export function useBubbleMaxWidth(screenWidth: number): { maxWidth: number; minWidth: number } {
  const maxWidth = Math.min(Math.round(screenWidth * 0.84), BUBBLE_MAX_CAP);
  const minWidth = Math.min(72, Math.round(screenWidth * 0.22));
  return { maxWidth, minWidth };
}

export const DEFAULT_DAILY_MESSAGE_LIMIT = 10;
