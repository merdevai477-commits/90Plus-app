/** Pull feature flags on cold start so footballCacheEpoch can purge stale WC disk cache. */
import { useEffect, useRef } from 'react';
import { useAppFeaturesStore } from '../src/stores/appFeaturesStore';

export function FootballCacheEpochBootstrap() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void useAppFeaturesStore.getState().hydrate(true);
  }, []);

  return null;
}
