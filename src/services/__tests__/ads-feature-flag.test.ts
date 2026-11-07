import { isAdsFeatureEnabled, setAdsEnabledOverride } from '../ads-feature-flag';

describe('ads feature flag', () => {
  const previous = process.env.ADS_ENABLED;

  afterEach(() => {
    setAdsEnabledOverride(null);
    if (previous == null) delete process.env.ADS_ENABLED;
    else process.env.ADS_ENABLED = previous;
  });

  it('stays off until the backend enables it', () => {
    delete process.env.ADS_ENABLED;
    setAdsEnabledOverride(null);
    expect(isAdsFeatureEnabled()).toBe(false);
  });

  it('follows ADS_ENABLED and an admin override', () => {
    process.env.ADS_ENABLED = 'true';
    setAdsEnabledOverride(null);
    expect(isAdsFeatureEnabled()).toBe(true);

    setAdsEnabledOverride(false);
    expect(isAdsFeatureEnabled()).toBe(false);

    setAdsEnabledOverride(true);
    expect(isAdsFeatureEnabled()).toBe(true);
  });
});
