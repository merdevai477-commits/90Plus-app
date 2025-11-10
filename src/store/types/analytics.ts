export interface AnalyticsEvent {
  name: string;
  timestamp: number;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface AnalyticsState {
  enabled: boolean;
  userId?: string;
  events: AnalyticsEvent[];
  crashReporting: boolean;
  performanceMonitoring: boolean;
  userProperties?: Record<string, any>;
}