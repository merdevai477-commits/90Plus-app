/**
 * Deterministic PRNG from a string seed (xorshift over a 32-bit FNV-style hash).
 *
 * Used wherever a "random" choice has to be STABLE for a given user/day/entity:
 * the daily candidate rotation, the Questions generator's shuffles, and the
 * 50:50 lifeline — where re-tapping the same question must keep eliminating the
 * same options rather than rerolling a different survivor each time.
 *
 * Lives in utils rather than beside its first caller so the daily-quiz service
 * can seed a 50:50 without importing the whole football-candidate stack.
 */
export function seededRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i += 1) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
