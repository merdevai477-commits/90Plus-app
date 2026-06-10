import { create } from 'zustand';
import { WC_2026_KICKOFF_MS } from '../../constants/worldCup';
import { fetchAppFeatures } from '../../services/appFeaturesService';

interface AppFeaturesState {
  worldCupEnabled: boolean;
  worldCupLocked: boolean;
  worldCupCampaignMode: boolean;
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
  worldCupCampaignMode: false,
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
          worldCupCampaignMode: wc.campaignMode,
          leagueId: wc.leagueId,
          season: wc.season,
          unlockAtMs: Date.parse(wc.unlockAt) || WC_2026_KICKOFF_MS,
          hydrated: true,
          revision: s.revision + 1,
        }));
      } catch {
        const campaignFallback = Date.now() >= Date.parse('2026-06-10T00:00:00.000Z');
        if (campaignFallback) {
          set((s) => ({
            worldCupEnabled: true,
            worldCupLocked: false,
            worldCupCampaignMode: true,
            hydrated: true,
            revision: s.revision + 1,
          }));
        }
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
