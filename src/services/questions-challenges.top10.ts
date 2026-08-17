/**
 * TOP 10 — matching a TYPED name against the real ranking.
 * =============================================================================
 *
 * The player types ten names. Nobody spells "Mbappé", "Håland" or "زياش" the
 * same way twice, so a raw string comparison would fail honest answers; a
 * loose one would accept a different player. This module sits exactly between:
 *
 *  1. NORMALIZE   — case, whitespace, punctuation, Latin accents, Arabic
 *                   diacritics/alef-hamza forms, and the Arabic definite
 *                   article. Two spellings of the same name collapse onto one.
 *  2. EXACT       — normalized equality against the canonical name or any
 *                   recorded alias (short name, surname, localized name).
 *  3. FUZZY       — bounded edit-distance similarity, and only then. A typed
 *                   name must be at least MIN_FUZZY_LENGTH characters and score
 *                   TOP10_FUZZY_MIN_RATIO or better, so "Kane" can never match
 *                   "Kean" while "Modric" still matches "Modrić".
 *
 * Everything here is pure: same inputs, same verdict, no I/O, no model.
 */

import { TOP10_FUZZY_MIN_RATIO } from '../constants/questions-modes.config';
import type { Top10AnswerSlot } from '../types/questions-challenges.types';

/** Below this length a typo is indistinguishable from a different name. */
const MIN_FUZZY_LENGTH = 5;

/**
 * One comparable form of a name.
 *
 * Latin: accents stripped ("Mbappé" → "mbappe").
 * Arabic: diacritics removed, alef/ya/ta-marbuta forms unified, the definite
 * article dropped, so "الأهلي"/"الاهلي" and "زياش"/"زياش" agree.
 */
export function normalizeTop10Name(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    // Latin combining marks + Arabic harakat/tatweel.
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/\bال(?=[؀-ۿ])/g, '') // leading definite article
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Levenshtein distance, iterative with a single row. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** 1 for identical strings, 0 for nothing in common. */
export function nameSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  return 1 - editDistance(a, b) / longest;
}

/** Every comparable spelling of one slot: the real name and its aliases. */
function slotForms(slot: Top10AnswerSlot): string[] {
  return [slot.canonical, ...(slot.aliases ?? [])].map(normalizeTop10Name).filter(Boolean);
}

/** The typed name IS one of this slot's recorded spellings. */
export function matchesTop10NameExactly(typed: string, slot: Top10AnswerSlot): boolean {
  const candidate = normalizeTop10Name(typed);
  return Boolean(candidate) && slotForms(slot).includes(candidate);
}

/**
 * Does `typed` name the player in `slot`?
 *
 * Accepts the canonical name, any recorded alias, and — for a long enough
 * entry — a close misspelling of either. Deliberately does NOT accept a
 * substring: "Ronaldo" typed against "Ronaldinho" is a different player.
 */
export function matchesTop10Name(typed: string, slot: Top10AnswerSlot): boolean {
  const candidate = normalizeTop10Name(typed);
  if (!candidate) return false;

  const forms = slotForms(slot);
  if (forms.includes(candidate)) return true;
  if (candidate.length < MIN_FUZZY_LENGTH) return false;

  return forms.some(
    (form) =>
      form.length >= MIN_FUZZY_LENGTH &&
      nameSimilarity(candidate, form) >= TOP10_FUZZY_MIN_RATIO,
  );
}

/**
 * Which slots a typed name credits — after ambiguity is resolved.
 *
 * An EXACT spelling always names its own slot. A near-miss only counts when it
 * is near exactly ONE of the ten: a string that sits within the tolerance of
 * several real names has not identified any of them, and crediting the first
 * one scanned would be guessing on the player's behalf.
 */
function resolveSlotFor(typed: string, slots: Top10AnswerSlot[]): number[] {
  const exact = slots
    .map((slot, index) => (matchesTop10NameExactly(typed, slot) ? index : -1))
    .filter((index) => index >= 0);
  if (exact.length > 0) return exact;

  const fuzzy = slots
    .map((slot, index) => (matchesTop10Name(typed, slot) ? index : -1))
    .filter((index) => index >= 0);
  return fuzzy.length === 1 ? fuzzy : [];
}

export interface Top10Grade {
  /** Per slot, in rank order: did the player get this one? */
  hits: boolean[];
  /** How many of the ten were named. */
  correctCount: number;
  /** All ten. */
  isPerfect: boolean;
}

/**
 * Grade ten typed names against the ranking.
 *
 * `strategy` is the product rule, passed in rather than decided here:
 *   'ordered'    — slot 3 only counts if the player typed in slot 3 belongs at
 *                  rank 3. (What the repository's Top 10 grading already did.)
 *   'membership' — a name counts wherever it was typed, as long as it is one of
 *                  the ten. Each real player can still only be credited once.
 */
export function gradeTop10Entries(
  entries: string[],
  slots: Top10AnswerSlot[],
  strategy: 'ordered' | 'membership',
): Top10Grade {
  const hits = slots.map(() => false);

  if (strategy === 'ordered') {
    slots.forEach((slot, index) => {
      const typed = entries[index];
      if (!typed?.trim()) return;
      // The name has to identify THIS slot, and identify it unambiguously.
      if (resolveSlotFor(typed, slots).includes(index)) hits[index] = true;
    });
  } else {
    // One credit per real player: two spellings of the same name in two boxes
    // fill one slot, not two.
    for (const typed of entries) {
      if (!typed?.trim()) continue;
      const index = resolveSlotFor(typed, slots).find((slotIndex) => !hits[slotIndex]);
      if (index !== undefined) hits[index] = true;
    }
  }

  const correctCount = hits.filter(Boolean).length;
  return { hits, correctCount, isPerfect: correctCount === slots.length && slots.length > 0 };
}
