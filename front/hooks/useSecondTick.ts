import { useEffect, useState } from 'react';
import { agentDebugLog } from '../utils/agentDebugLog';

let activeSecondTickCount = 0;

/**
 * Re-renders the calling component once per second while `active` is true.
 * Used to animate the live "MM:SS" match clock between API updates without a
 * heavier animation loop. The interval is fully torn down when inactive so
 * finished/upcoming matches never pay for a running timer.
 */
export function useSecondTick(active: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    activeSecondTickCount += 1;
    // #region agent log
    agentDebugLog(
      'useSecondTick.ts:active',
      'second tick started',
      { activeCount: activeSecondTickCount },
      'H-C',
    );
    // #endregion
    const id = setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => {
      clearInterval(id);
      activeSecondTickCount = Math.max(0, activeSecondTickCount - 1);
    };
  }, [active]);
}
