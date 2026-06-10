/**
 * Remote feature flags — toggled via environment / countdown without app release.
 */

export interface WorldCupFeatureConfig {
  /** Tab unlocked — matches available */
  enabled: boolean;
  /** UI lock state (inverse of enabled unless forced) */
  locked: boolean;
  /** Full World Cup takeover: WC-only tabs, faster live polling, campaign header */
  campaignMode: boolean;
  leagueId: number;
  season: number;
  /** ISO timestamp when the tab auto-unlocks */
  unlockAt: string;
  /** Seconds until unlock (0 when enabled) */
  secondsRemaining: number;
}

export interface AppFeatures {
  worldCupTab: WorldCupFeatureConfig;
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === 'true' || value === '1';
}

/** Opening match kickoff — June 11 2026 20:00 Mexico City → UTC */
const DEFAULT_WC_UNLOCK_MS = new Date('2026-06-12T01:00:00.000Z').getTime();

/** Campaign UI (WC-only tabs, rank card, header) — auto from 10 Jun 2026 unless overridden */
const DEFAULT_CAMPAIGN_START_MS = Date.parse('2026-06-10T00:00:00.000Z');

function resolveWorldCupUnlockMs(): number {
  const raw = process.env.WORLD_CUP_UNLOCK_AT?.trim();
  if (raw) {
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return ms;
  }
  return DEFAULT_WC_UNLOCK_MS;
}

export function getWorldCupTabState(nowMs: number = Date.now()): WorldCupFeatureConfig {
  const leagueId = parseInt(process.env.WORLD_CUP_LEAGUE_ID || '1', 10);
  const season = parseInt(process.env.WORLD_CUP_SEASON || '2026', 10);
  const unlockAtMs = resolveWorldCupUnlockMs();
  const forceEnabled = parseBool(process.env.WORLD_CUP_TAB_ENABLED, false);
  const campaignEnv = process.env.WORLD_CUP_CAMPAIGN_MODE?.trim();
  const campaignMode =
    campaignEnv != null && campaignEnv !== ''
      ? parseBool(campaignEnv, false)
      : nowMs >= DEFAULT_CAMPAIGN_START_MS;
  const secondsRemaining = Math.max(0, Math.floor((unlockAtMs - nowMs) / 1000));
  const timeUnlocked = nowMs >= unlockAtMs;
  const enabled = forceEnabled || campaignMode || timeUnlocked;

  return {
    enabled,
    locked: !enabled,
    campaignMode: campaignMode && enabled,
    leagueId,
    season,
    unlockAt: new Date(unlockAtMs).toISOString(),
    secondsRemaining,
  };
}

export function getAppFeatures(): AppFeatures {
  return {
    worldCupTab: getWorldCupTabState(),
  };
}
