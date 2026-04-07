/**
 * Content Filter Utility
 * Apple Compliance - Guideline 1.2
 * 
 * Filters objectionable content from user text inputs
 * Uses bad-words library + custom Arabic bad words list
 */

import { logger } from './logger';

// Use require for CommonJS module
const BadWordsFilter = require('bad-words');

// Arabic bad words list (common profanity)
const ARABIC_BAD_WORDS = [
  'كلب', 'حمار', 'غبي', 'احمق', 'خنزير', 'قذر',
  'لعنة', 'جحش', 'وسخ', 'قرد', 'بهيمة', 'حقير',
  // Add more as needed
];

// Initialize filter
const filter = new BadWordsFilter();

// Add Arabic bad words
filter.addWords(...ARABIC_BAD_WORDS);

// Add custom English variations
const CUSTOM_BAD_WORDS = [
  'f**k', 'sh*t', 'b*tch', 'a**hole', 'd*mn', 'h*ll',
  'idiot', 'stupid', 'dumb', 'moron', 'retard',
];
filter.addWords(...CUSTOM_BAD_WORDS);

export interface FilterResult {
  clean: string;
  flagged: boolean;
  originalLength: number;
  cleanLength: number;
}

/**
 * Filter text content for bad words
 * @param text - Text to filter
 * @returns FilterResult with clean text and flagged status
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
  let flagged = false;

  try {
    // Check if text contains bad words
    if (filter.isProfane(text)) {
      flagged = true;
      logger.warn('Profane content detected', {
        originalLength,
        preview: text.substring(0, 50),
      });
    }

    // Clean the text (replace bad words with asterisks)
    const clean = filter.clean(text);

    return {
      clean,
      flagged,
      originalLength,
      cleanLength: clean.length,
    };
  } catch (error: any) {
    logger.error('Content filter error:', error);
    // On error, return original text but mark as flagged for manual review
    return {
      clean: text,
      flagged: true,
      originalLength,
      cleanLength: text.length,
    };
  }
}

/**
 * Check if text contains profanity without cleaning
 * @param text - Text to check
 * @returns boolean indicating if profanity was found
 */
export function isProfane(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  try {
    return filter.isProfane(text);
  } catch (error: any) {
    logger.error('Profanity check error:', error);
    return false;
  }
}

/**
 * Add custom bad words to the filter
 * @param words - Array of words to add
 */
export function addBadWords(words: string[]): void {
  try {
    filter.addWords(...words);
    logger.info(`Added ${words.length} custom bad words to filter`);
  } catch (error: any) {
    logger.error('Failed to add bad words:', error);
  }
}

/**
 * Remove words from the filter (for false positives)
 * @param words - Array of words to remove
 */
export function removeBadWords(words: string[]): void {
  try {
    filter.removeWords(...words);
    logger.info(`Removed ${words.length} words from filter`);
  } catch (error: any) {
    logger.error('Failed to remove words:', error);
  }
}

export default {
  filterText,
  isProfane,
  addBadWords,
  removeBadWords,
};
