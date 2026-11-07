/**
 * Master ads switch. Off until ADS_ENABLED=true or an admin override.
 * A process restart follows the env var again.
 */

let adsEnabledOverride: boolean | null = null;

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === 'true' || value === '1';
}

export function setAdsEnabledOverride(enabled: boolean | null): void {
  adsEnabledOverride = enabled;
}

export function isAdsFeatureEnabled(): boolean {
  if (adsEnabledOverride != null) return adsEnabledOverride;
  return parseBool(process.env.ADS_ENABLED, false);
}
