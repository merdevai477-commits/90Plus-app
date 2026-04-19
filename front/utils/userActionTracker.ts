/**
 * User Action Tracker
 * 
 * Utility for tracking user interactions and sending breadcrumbs to Sentry
 * 
 * Requirements: 6.1 - Capture breadcrumbs for user actions
 */

import { addBreadcrumb } from '../services/sentry.service';
import { logger } from '../services/logger';

/**
 * User action types
 */
export enum UserActionType {
  // Button interactions
  BUTTON_CLICK = 'button_click',
  BUTTON_PRESS = 'button_press',
  
  // Form interactions
  FORM_SUBMIT = 'form_submit',
  FORM_INPUT = 'form_input',
  FORM_FOCUS = 'form_focus',
  FORM_BLUR = 'form_blur',
  
  // Content interactions
  VIDEO_PLAY = 'video_play',
  VIDEO_PAUSE = 'video_pause',
  VIDEO_SEEK = 'video_seek',
  VIDEO_COMPLETE = 'video_complete',
  
  // Social interactions
  LIKE = 'like',
  UNLIKE = 'unlike',
  COMMENT = 'comment',
  SHARE = 'share',
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',
  
  // Quiz interactions
  QUIZ_START = 'quiz_start',
  QUIZ_ANSWER = 'quiz_answer',
  QUIZ_COMPLETE = 'quiz_complete',
  
  // Prediction interactions
  PREDICTION_MAKE = 'prediction_make',
  PREDICTION_VIEW = 'prediction_view',
  
  // Navigation interactions
  TAB_CHANGE = 'tab_change',
  SCROLL = 'scroll',
  SWIPE = 'swipe',
  
  // Search interactions
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort',
  
  // Settings interactions
  SETTINGS_CHANGE = 'settings_change',
  LANGUAGE_CHANGE = 'language_change',
  THEME_CHANGE = 'theme_change',
  
  // Generic
  CUSTOM = 'custom',
}

/**
 * Track a user action and send breadcrumb to Sentry
 * 
 * @param actionType - Type of action performed
 * @param actionName - Human-readable name of the action
 * @param data - Additional context data
 * 
 * Usage:
 * ```typescript
 * import { trackUserAction, UserActionType } from '@/utils/userActionTracker';
 * 
 * // Track button click
 * trackUserAction(UserActionType.BUTTON_CLICK, 'Submit Form', {
 *   formName: 'login',
 *   buttonId: 'submit-btn'
 * });
 * 
 * // Track video play
 * trackUserAction(UserActionType.VIDEO_PLAY, 'Play Video', {
 *   videoId: '123',
 *   duration: 30
 * });
 * ```
 */
export function trackUserAction(
  actionType: UserActionType,
  actionName: string,
  data?: Record<string, any>
): void {
  try {
    // Log action
    logger.debug(`[User Action] ${actionType}: ${actionName}`, data);

    // Add breadcrumb to Sentry
    addBreadcrumb(
      actionName,
      'user-action',
      'info',
      {
        actionType,
        ...data,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    // Silently fail - don't break user interaction if Sentry fails
    logger.warn('[User Action Tracker] Failed to track action:', error);
  }
}

/**
 * Convenience functions for common user actions
 */
export const UserActionTracker = {
  /**
   * Track button click
   */
  buttonClick(buttonName: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.BUTTON_CLICK, `Clicked ${buttonName}`, data);
  },

  /**
   * Track form submission
   */
  formSubmit(formName: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.FORM_SUBMIT, `Submitted ${formName}`, data);
  },

  /**
   * Track form input change
   */
  formInput(fieldName: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.FORM_INPUT, `Input ${fieldName}`, data);
  },

  /**
   * Track video play
   */
  videoPlay(videoId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.VIDEO_PLAY, 'Play Video', {
      videoId,
      ...data,
    });
  },

  /**
   * Track video pause
   */
  videoPause(videoId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.VIDEO_PAUSE, 'Pause Video', {
      videoId,
      ...data,
    });
  },

  /**
   * Track like action
   */
  like(contentType: string, contentId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.LIKE, `Like ${contentType}`, {
      contentType,
      contentId,
      ...data,
    });
  },

  /**
   * Track unlike action
   */
  unlike(contentType: string, contentId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.UNLIKE, `Unlike ${contentType}`, {
      contentType,
      contentId,
      ...data,
    });
  },

  /**
   * Track comment action
   */
  comment(contentType: string, contentId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.COMMENT, `Comment on ${contentType}`, {
      contentType,
      contentId,
      ...data,
    });
  },

  /**
   * Track share action
   */
  share(contentType: string, contentId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.SHARE, `Share ${contentType}`, {
      contentType,
      contentId,
      ...data,
    });
  },

  /**
   * Track follow action
   */
  follow(userId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.FOLLOW, 'Follow User', {
      userId,
      ...data,
    });
  },

  /**
   * Track unfollow action
   */
  unfollow(userId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.UNFOLLOW, 'Unfollow User', {
      userId,
      ...data,
    });
  },

  /**
   * Track quiz start
   */
  quizStart(quizId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.QUIZ_START, 'Start Quiz', {
      quizId,
      ...data,
    });
  },

  /**
   * Track quiz answer
   */
  quizAnswer(quizId: string, questionId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.QUIZ_ANSWER, 'Answer Quiz Question', {
      quizId,
      questionId,
      ...data,
    });
  },

  /**
   * Track quiz completion
   */
  quizComplete(quizId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.QUIZ_COMPLETE, 'Complete Quiz', {
      quizId,
      ...data,
    });
  },

  /**
   * Track prediction
   */
  makePrediction(matchId: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.PREDICTION_MAKE, 'Make Prediction', {
      matchId,
      ...data,
    });
  },

  /**
   * Track search
   */
  search(query: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.SEARCH, 'Search', {
      query,
      ...data,
    });
  },

  /**
   * Track settings change
   */
  settingsChange(setting: string, value: any, data?: Record<string, any>): void {
    trackUserAction(UserActionType.SETTINGS_CHANGE, `Change ${setting}`, {
      setting,
      value,
      ...data,
    });
  },

  /**
   * Track language change
   */
  languageChange(language: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.LANGUAGE_CHANGE, 'Change Language', {
      language,
      ...data,
    });
  },

  /**
   * Track custom action
   */
  custom(actionName: string, data?: Record<string, any>): void {
    trackUserAction(UserActionType.CUSTOM, actionName, data);
  },
};

/**
 * React hook for tracking user actions
 * 
 * Usage:
 * ```typescript
 * import { useUserActionTracker } from '@/utils/userActionTracker';
 * 
 * function MyComponent() {
 *   const tracker = useUserActionTracker();
 *   
 *   const handleClick = () => {
 *     tracker.buttonClick('Submit Button', { formId: 'login' });
 *   };
 *   
 *   return <Button onPress={handleClick}>Submit</Button>;
 * }
 * ```
 */
export function useUserActionTracker() {
  return UserActionTracker;
}

/**
 * Export all utilities
 */
export default {
  trackUserAction,
  UserActionTracker,
  useUserActionTracker,
  UserActionType,
};
