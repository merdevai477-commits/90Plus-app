import { create } from 'zustand';
import { WC_2026_KICKOFF_MS } from '../../constants/worldCup';
import { fetchAppFeatures } from '../../services/appFeaturesService';

interface AppFeaturesState {
  worldCupEnabled: boolean;
  worldCupLocked: boolean;
  leagueId: number;
  season: number;
  unlockAtMs: number;
  revision: number;
  hydrated: boolean;
  hydrate: (force?: boolean) => Promise<void>;
}

let hydratePromise: Promise<void> | null = null;

export const useAppFeaturesStore = create<AppFeaturesState>((set, get) => ({
  worldCupEnabled: false,
  worldCupLocked: true,
  leagueId: 1,
  season: 2026,
  unlockAtMs: WC_2026_KICKOFF_MS,
  revision: 0,
  hydrated: false,

  hydrate: async (force = false) => {
    if (!force && get().hydrated) return;
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const data = await fetchAppFeatures();
        const wc = data.features.worldCupTab;
        set((s) => ({
          worldCupEnabled: wc.enabled,
          worldCupLocked: wc.locked,
          leagueId: wc.leagueId,
          season: wc.season,
          unlockAtMs: Date.parse(wc.unlockAt) || WC_2026_KICKOFF_MS,
          hydrated: true,
          revision: s.revision + 1,
        }));
      } catch {
        // Keep defaults — local countdown still works offline
      } finally {
        hydratePromise = null;
      }
    })();

    return hydratePromise;
  },
}));

/** Sync read for countdown helpers */
export function isWorldCupUnlockedLocally(now = Date.now()): boolean {
  const { worldCupEnabled, unlockAtMs } = useAppFeaturesStore.getState();
  return worldCupEnabled || now >= unlockAtMs;
}
