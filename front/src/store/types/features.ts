export interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage?: number;
  metadata?: Record<string, any>;
  expiryDate?: string;
}

export interface FeatureFlagsState {
  flags: Record<string, boolean | FeatureFlag>;
  experimentsEnabled: boolean;
  betaFeatures: boolean;
  debugMode: boolean;
}