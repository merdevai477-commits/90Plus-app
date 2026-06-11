import { useEffect, useState } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import { cacheService, CACHE_KEYS } from '../services/cacheService';

/** Keep logo for the full tournament (~120 days). */
const WC_LOGO_TTL_MS = 120 * 24 * 60 * 60 * 1000;

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
 * Resolves the FIFA World Cup league logo from persistent cache or the latest
 * WC fixtures payload (API-Football league.logo).
 */
export function useWorldCupLogo(wcMatches: Match[]): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await getCachedWorldCupLogoUrl();
      if (cancelled) return;
      if (cached) {
        setLogoUrl(cached);
        return;
      }

      const fromApi = wcMatches.find((m) => m.league?.logo)?.league?.logo;
      if (fromApi) {
        await persistWorldCupLogoUrl(fromApi);
        if (!cancelled) setLogoUrl(fromApi);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wcMatches]);

  useEffect(() => {
    const fromApi = wcMatches.find((m) => m.league?.logo)?.league?.logo;
    if (!fromApi) return;
    void persistWorldCupLogoUrl(fromApi);
    setLogoUrl((prev) => prev ?? fromApi);
  }, [wcMatches]);

  return logoUrl;
}
