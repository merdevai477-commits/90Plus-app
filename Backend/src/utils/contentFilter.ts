/**
 * Content Filter Utility
 * Apple Compliance - Guideline 1.2
 * 
 * Filters profanity and inappropriate content from user-generated text
 */

const Filter = require('bad-words');

const filter = new Filter();

// Add Arabic profanity words (basic list - expand as needed)
const arabicBadWords = [
  'كلب', 'حمار', 'غبي', 'احمق', 'وسخ'
];

filter.addWords(...arabicBadWords);

export interface FilterResult {
  clean: string;
  flagged: boolean;
  originalLength: number;
  cleanLength: number;
}

/**
 * Filter text content and detect profanity
 * @param text - Text to filter
 * @returns FilterResult with cleaned text and flagged status
 */
export function filterText(text: string): FilterResult {
  if (!text || typeof text !== 'string') {
    return {
      clean: '',
      flagged: false,
      originalLength: 0,
      cleanLength: 0,
    };
  }

  const originalLength = text.length;
  const clean = filter.clean(text);
  const flagged = clean !== text;

  return {
    clean,
    flagged,
    originalLength,
    cleanLength: clean.length,
  };
}

/**
 * Check if text contains profanity without cleaning
 * @param text - Text to check
 * @returns true if profanity detected
 */
export function isProfane(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return filter.isProfane(text);
}

/**
 * Add custom words to the filter
 * @param words - Array of words to add
 */
export function addWords(words: string[]): void {
  filter.addWords(...words);
}

/**
 * Remove words from the filter
 * @param words - Array of words to remove
 */
export function removeWords(words: string[]): void {
  filter.removeWords(...words);
}
