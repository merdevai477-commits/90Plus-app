/**
 * Memoize a pure transform keyed by object identity (WeakMap).
 * Unchanged input refs return the previous output ref — safe for React.memo.
 * Entries are GC'd with the input object (no unbounded growth).
 */
export function createObjectRefMemo<TIn extends object, TOut>(
  compute: (input: TIn) => TOut,
): (input: TIn) => TOut {
  const cache = new WeakMap<TIn, TOut>();
  return (input: TIn): TOut => {
    const hit = cache.get(input);
    if (hit !== undefined) return hit;
    const out = compute(input);
    cache.set(input, out);
    return out;
  };
}
