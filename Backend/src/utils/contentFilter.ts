/**
 * Content Filter Utility
 * Apple Compliance - Guideline 1.2
 * 
 * Filters profanity and inappropriate content from user-generated text
 */

const Filter = require('bad-words');

const filter = new Filter();

// Add Arabic profanity words - Egyptian, Gulf, Levantine dialects + English
const arabicBadWords = [
  // Egyptian Arabic
  'كلب', 'حمار', 'غبي', 'احمق', 'وسخ', 'شرموط', 'عاهر', 'متناك',
  'ابن الكلب', 'ابن الشرموطة', 'كس', 'زب', 'عرص', 'خول', 'لوطي',
  'يلعن', 'نيك', 'منيوك', 'قحبة', 'زانية', 'فاجرة', 'حقير', 'وضيع',
  // Gulf Arabic
  'خنزير', 'قذر', 'تبًا', 'ملعون', 'يخرب', 'حيوان', 'كلب ابن كلب',
  // Levantine
  'يبن الشرموطة', 'كس امك', 'ابن الزانية', 'يلعن دينك', 'يلعن ابوك',
  // Common insults
  'تفو', 'قرف', 'نجس', 'خسيس', 'ذليل', 'مجنون', 'بهيم',
];

// English bad words (common ones not covered by bad-words package)
const extraEnglishBadWords = [
  'motherfucker', 'mf', 'stfu', 'gtfo', 'kys',
];

filter.addWords(...arabicBadWords, ...extraEnglishBadWords);

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
