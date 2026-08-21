import { create } from 'zustand';
import { WC_2026_KICKOFF_MS } from '../../constants/worldCup';
import { fetchAppFeatures } from '../../services/appFeaturesService';
import { applyFootballCacheEpoch } from '../../services/footballCacheEpochSync';

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
    if (!force && get().hydrated) {
      void (async () => {
        try {
          const data = await fetchAppFeatures();
          const busted = await applyFootballCacheEpoch(data.features.footballCacheEpoch);
          const wc = data.features.worldCupTab;
          const next = {
            worldCupEnabled: wc.enabled,
            worldCupLocked: wc.locked,
            worldCupCampaignMode: wc.campaignMode,
            leagueId: wc.leagueId,
            season: wc.season,
            unlockAtMs: Date.parse(wc.unlockAt) || WC_2026_KICKOFF_MS,
          };
          const prev = get();
          const changed =
            busted ||
            prev.worldCupEnabled !== next.worldCupEnabled ||
            prev.worldCupLocked !== next.worldCupLocked ||
            prev.worldCupCampaignMode !== next.worldCupCampaignMode ||
            prev.leagueId !== next.leagueId ||
            prev.season !== next.season ||
            prev.unlockAtMs !== next.unlockAtMs;
          if (!changed) return;
          set((s) => ({ ...next, revision: s.revision + 1 }));
        } catch {
          // non-fatal background refresh
        }
      })();
      return;
    }
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const data = await fetchAppFeatures();
        await applyFootballCacheEpoch(data.features.footballCacheEpoch);
        const wc = data.features.worldCupTab;
        const next = {
          worldCupEnabled: wc.enabled,
          worldCupLocked: wc.locked,
          worldCupCampaignMode: wc.campaignMode,
          leagueId: wc.leagueId,
          season: wc.season,
          unlockAtMs: Date.parse(wc.unlockAt) || WC_2026_KICKOFF_MS,
          hydrated: true as const,
        };
        const prev = get();
        const changed =
          !prev.hydrated ||
          prev.worldCupEnabled !== next.worldCupEnabled ||
          prev.worldCupLocked !== next.worldCupLocked ||
          prev.worldCupCampaignMode !== next.worldCupCampaignMode ||
          prev.leagueId !== next.leagueId ||
          prev.season !== next.season ||
          prev.unlockAtMs !== next.unlockAtMs;
        if (!changed) return;
        set((s) => ({ ...next, revision: s.revision + 1 }));
      } catch {
        const campaignFallback = Date.now() >= Date.parse('2026-06-10T00:00:00.000Z');
        if (campaignFallback) {
          const prev = get();
          if (prev.hydrated && prev.worldCupCampaignMode && !prev.worldCupLocked) return;
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
