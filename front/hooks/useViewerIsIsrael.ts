/**
 * Whether the signed-in user's profile country is Israel.
 * Defaults to false (show Palestine for Israeli leagues) when unknown / logged out.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { CACHE_KEYS, cacheService, getUserCacheKey } from '../services/cacheService';
import { isViewerFromIsrael } from '../utils/matchesCountryDisplay';
import { peekProfileMemoryCountry } from './useProfileCache';

type ProfileCountrySlice = {
  country?: string | null;
  countryFlag?: string | null;
};

export function useViewerIsIsrael(): boolean {
  const { userId } = useAuth();
  const [viewerIsIsrael, setViewerIsIsrael] = useState(() => {
    const peeked = peekProfileMemoryCountry(userId);
    return isViewerFromIsrael(peeked?.country, peeked?.countryFlag);
  });

  useEffect(() => {
    let cancelled = false;

    const apply = (slice: ProfileCountrySlice | null | undefined) => {
      if (cancelled) return;
      setViewerIsIsrael(isViewerFromIsrael(slice?.country, slice?.countryFlag));
    };

    apply(peekProfileMemoryCountry(userId));

    if (!userId) {
      apply(null);
      return () => {
        cancelled = true;
      };
    }

    const key = getUserCacheKey(CACHE_KEYS.PROFILE_DATA, userId);
    void cacheService
      .get<{ userData?: ProfileCountrySlice }>(key)
      .then((cached) => {
        if (cached?.userData) apply(cached.userData);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return viewerIsIsrael;
}
