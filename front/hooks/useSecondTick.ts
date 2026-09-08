import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component once per second while `active` is true.
 * Kept as a named export even when live clocks are minute-only so Fast Refresh
 * does not crash with `Property 'useSecondTick' doesn't exist`.
 */
export function useSecondTick(active: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => clearInterval(id);
  }, [active]);
}
