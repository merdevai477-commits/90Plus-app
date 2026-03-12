/**
 * Analytics Service
 * 
 * Provides centralized analytics tracking
 * 
 * Setup:
 * 1. npm install @react-native-firebase/app @react-native-firebase/analytics
 * 2. Configure Firebase project
 * 3. Add google-services.json (Android) and GoogleService-Info.plist (iOS)
 */

import { logger } from './logger';

// Type-safe event names
export enum AnalyticsEvent {
  // App lifecycle
  APP_OPEN = 'app_open',
  APP_CLOSE = 'app_close',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  
  // Authentication
  SIGN_UP = 'sign_up',
  LOGIN = 'login',
  LOGOUT = 'logout',
  
  // User actions
  SCREEN_VIEW = 'screen_view',
  BUTTON_CLICK = 'button_click',
  SEARCH = 'search',
  SHARE = 'share',
  
  // Content
  VIDEO_PLAY = 'video_play',
  VIDEO_PAUSE = 'video_pause',
  VIDEO_COMPLETE = 'video_complete',
  VIDEO_UPLOAD = 'video_upload',
  
  // Social
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',
  
  // Predictions
  PREDICTION_MADE = 'prediction_made',
  PREDICTION_WON = 'prediction_won',
  PREDICTION_LOST = 'prediction_lost',
  
  // Quiz
  QUIZ_START = 'quiz_start',
  QUIZ_COMPLETE = 'quiz_complete',
  QUIZ_ANSWER = 'quiz_answer',
  
  // Gamification
  COINS_EARNED = 'coins_earned',
  COINS_SPENT = 'coins_spent',
  LEVEL_UP = 'level_up',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  
  // Errors
  ERROR_OCCURRED = 'error_occurred',
  API_ERROR = 'api_error',
}

// User properties
export enum UserProperty {
  USER_LEVEL = 'user_level',
  FAVORITE_TEAM = 'favorite_team',
  LANGUAGE = 'language',
  THEME = 'theme',
  TOTAL_COINS = 'total_coins',
  TOTAL_PREDICTIONS = 'total_predictions',
  TOTAL_VIDEOS = 'total_videos',
}

/**
 * Analytics Service
 * 
 * Note: This is a placeholder implementation.
 * Replace with actual Firebase Analytics when ready.
 */
class AnalyticsService {
  private enabled: boolean = false;
  
  /**
   * Initialize analytics
   */
  async initialize() {
    try {
      // TODO: Initialize Firebase Analytics
      // const analytics = require('@react-native-firebase/analytics').default;
      // await analytics().setAnalyticsCollectionEnabled(true);
      
      this.enabled = !__DEV__; // Disable in development
      
      if (this.enabled) {
        logger.info('Analytics initialized');
      } else {
        logger.info('Analytics disabled in development');
      }
    } catch (error) {
      logger.error('Failed to initialize analytics:', error);
    }
  }
  
  /**
   * Log event
   */
  async logEvent(
    eventName: AnalyticsEvent | string,
    params?: Record<string, any>
  ) {
    if (!this.enabled) {
      logger.debug(`[Analytics] ${eventName}`, params);
      return;
    }
    
    try {
      // TODO: Log to Firebase Analytics
      // const analytics = require('@react-native-firebase/analytics').default;
      // await analytics().logEvent(eventName, params);
      
      logger.debug(`[Analytics] Event: ${eventName}`, params);
    } catch (error) {
      logger.error('Failed to log event:', error);
    }
  }
  
  /**
   * Log screen view
   */
  async logScreenView(screenName: string, screenClass?: string) {
    await this.logEvent(AnalyticsEvent.SCREEN_VIEW, {
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  }
  
  /**
   * Set user ID
   */
  async setUserId(userId: string) {
    if (!this.enabled) return;
    
    try {
      // TODO: Set user ID in Firebase
      // const analytics = require('@react-native-firebase/analytics').default;
      // await analytics().setUserId(userId);
      
      logger.debug('[Analytics] User ID set:', userId);
    } catch (error) {
      logger.error('Failed to set user ID:', error);
    }
  }
  
  /**
   * Set user property
   */
  async setUserProperty(name: UserProperty | string, value: string) {
    if (!this.enabled) return;
    
    try {
      // TODO: Set user property in Firebase
      // const analytics = require('@react-native-firebase/analytics').default;
      // await analytics().setUserProperty(name, value);
      
      logger.debug(`[Analytics] User property: ${name} = ${value}`);
    } catch (error) {
      logger.error('Failed to set user property:', error);
    }
  }
  
  /**
   * Set user properties (batch)
   */
  async setUserProperties(properties: Record<string, string>) {
    for (const [key, value] of Object.entries(properties)) {
      await this.setUserProperty(key, value);
    }
  }
  
  /**
   * Enable/disable analytics
   */
  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    
    try {
      // TODO: Update Firebase Analytics setting
      // const analytics = require('@react-native-firebase/analytics').default;
      // await analytics().setAnalyticsCollectionEnabled(enabled);
      
      logger.info(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to update analytics setting:', error);
    }
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

/**
 * Convenience functions
 */
export const trackScreenView = (screenName: string) => {
  analytics.logScreenView(screenName);
};

export const trackEvent = (
  eventName: AnalyticsEvent | string,
  params?: Record<string, any>
) => {
  analytics.logEvent(eventName, params);
};

export const trackUserAction = (action: string, data?: Record<string, any>) => {
  analytics.logEvent(action, data);
};

/**
 * Example usage
 */
export const AnalyticsExample = {
  // Track screen view
  screenView: () => {
    trackScreenView('Home');
  },
  
  // Track video play
  videoPlay: (videoId: string, source: string) => {
    trackEvent(AnalyticsEvent.VIDEO_PLAY, {
      video_id: videoId,
      source,
    });
  },
  
  // Track prediction
  prediction: (matchId: string, coins: number) => {
    trackEvent(AnalyticsEvent.PREDICTION_MADE, {
      match_id: matchId,
      coins_spent: coins,
      value: coins, // For conversion tracking
    });
  },
  
  // Track user properties
  userProperties: (user: any) => {
    analytics.setUserProperties({
      [UserProperty.USER_LEVEL]: user.level.toString(),
      [UserProperty.FAVORITE_TEAM]: user.favoriteTeam || 'none',
      [UserProperty.LANGUAGE]: user.language || 'en',
    });
  },
};

export default analytics;