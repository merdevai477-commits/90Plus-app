export interface RemoteConfigState {
  config: Record<string, any>;
  lastFetch?: number;
  fetchInterval: number; // in milliseconds
  isStale: boolean;
  version?: string;
}