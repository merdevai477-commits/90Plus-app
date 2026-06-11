import { useEffect, useMemo, useState } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import { cacheService, CACHE_KEYS } from '../services/cacheService';

/** Keep logo for the full tournament (~120 days). */
const WC_LOGO_TTL_MS = 120 * 24 * 60 * 60 * 1000;

function pickLeagueLogo(matches: Match[]): string | null {
  for (const m of matches) {
    const logo = m.league?.logo?.trim();
    if (logo) return logo;
  }
  return null;
}

export async function getCachedWorldCupLogoUrl(): Promise<string | null> {
  const cached = await cacheService.get<string>(CACHE_KEYS.WORLD_CUP_LOGO);
  return cached && cached.trim() ? cached.trim() : null;
}

export async function persistWorldCupLogoUrl(url: string | null | undefined): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed) return;
  await cacheService.set(CACHE_KEYS.WORLD_CUP_LOGO, trimmed, WC_LOGO_TTL_MS);
}

/**
 * FIFA World Cup league logo from API-Football (`league.logo` on fixtures).
 * Uses the live payload immediately; falls back to a long-lived local cache
 * while fixtures are still loading.
 */
export function useWorldCupLogo(wcMatches: Match[]): string | null {
  const fromMatches = useMemo(() => pickLeagueLogo(wcMatches), [wcMatches]);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (fromMatches) {
      void persistWorldCupLogoUrl(fromMatches);
      return;
    }
    let cancelled = false;
    void getCachedWorldCupLogoUrl().then((url) => {
      if (!cancelled && url) setCachedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [fromMatches]);

  return fromMatches ?? cachedUrl;
}
