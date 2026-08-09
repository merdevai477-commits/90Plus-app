/**
 * =============================================================================
 * QUESTION BOARDS — CREST-LESS FALLBACK GLYPH
 * =============================================================================
 *
 * Every football image in the Questions experience is now resolved server-side
 * against the entity it belongs to and arrives on the question itself (see
 * src/services/questions-challenges.ai-generator.service.ts).
 *
 * This module used to also hold hand-curated name → CDN-id tables so the client
 * could guess a crest/portrait/flag URL from a label. Those are gone: they only
 * ever matched the handful of names the old bundled question bank used, silently
 * resolved to nothing for real API entity names, and resolved to nothing at all
 * in Arabic (the tables were keyed in English) — which is how question artwork
 * quietly disappeared. Guessing an image from a name can also attach the WRONG
 * club's badge to a label, so it is not something to reintroduce.
 * =============================================================================
 */

/**
 * Up-to-three-letter monogram used when a name has no artwork. Not a stock
 * placeholder image — it is the designed crest-less state (see `CrestSlot` in
 * components/Quiz/QuestionsModeBoards.tsx).
 */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}
