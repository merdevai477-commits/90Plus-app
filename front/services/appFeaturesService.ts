import { getApiUrl } from '../utils/getApiUrl';

export interface WorldCupFeatureConfig {
  enabled: boolean;
  locked: boolean;
  campaignMode: boolean;
  leagueId: number;
  season: number;
  unlockAt: string;
  secondsRemaining: number;
}

export interface AppFeaturesResponse {
  status: string;
  features: {
    worldCupTab: WorldCupFeatureConfig;
    footballCacheEpoch?: string;
  };
}

export async function fetchAppFeatures(): Promise<AppFeaturesResponse> {
  const res = await fetch(`${getApiUrl()}/app/features`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`features ${res.status}`);
  }

  return res.json() as Promise<AppFeaturesResponse>;
}
