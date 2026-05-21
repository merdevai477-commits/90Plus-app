/**
 * Profile Completion Service
 * Handles profile completion status and tracking.
 *
 * The service is language-neutral: step `id` is the source of truth.
 * UI consumers should resolve display labels through
 * `getProfileCompletionStepLabel(stepId, language, serverLabel?)` so the
 * label always reflects the user's selected locale, regardless of what
 * the backend returns.
 */

import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';
import { useLanguageStore } from '../src/i18n/store';
import { getProfileCompletionStepLabel } from '../utils/i18nHelpers';

const API_URL = getApiUrl();

export interface ProfileCompletionStep {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  weight: number;
}

export interface ProfileCompletionStatus {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  steps: ProfileCompletionStep[];
  canUploadVideo: boolean;
  missingRequiredSteps: string[];
}

export class ProfileCompletionService {
  /**
   * Get profile completion status
   */
  static async getCompletionStatus(token: string): Promise<ProfileCompletionStatus | null> {
    try {
      const response = await fetch(`${API_URL}/profile/completion`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        
        if (response.status === 429) {
          throw new Error('Too many requests - Please try again later');
        }
        
        // If user not found (500 error), silently return default incomplete profile
        // This is expected on first login before user is fully created
        if (response.status === 500 && errorData.message?.includes('User not found')) {
          logger.info('User not yet created in database, returning default profile (expected on first login)');
          return this.getDefaultIncompleteProfile();
        }
        
        throw new Error(errorData.message || 'Failed to get profile completion status');
      }

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        return data.data;
      }

      return null;
    } catch (error: any) {
      // Check if it's a "User not found" error (expected on first login)
      if (error.message?.includes('User not found')) {
        logger.info('User not yet created, returning default profile (expected on first login)');
        return this.getDefaultIncompleteProfile();
      }
      
      // Log other errors as warnings (not errors) to avoid noise
      logger.warn('Profile completion status unavailable, using default:', error.message);
      
      // Return default incomplete profile on any error (fallback)
      return this.getDefaultIncompleteProfile();
    }
  }

  /**
   * Get default incomplete profile (used when user is not yet created).
   *
   * Step labels are resolved through the i18n store at call time so
   * defaults match the user's selected language. Falls back to the
   * step id when a translation is missing, never crashes.
   */
  private static getDefaultIncompleteProfile(): ProfileCompletionStatus {
    const lang = useLanguageStore.getState().language;
    const label = (id: string) => getProfileCompletionStepLabel(id, lang);

    const steps: ProfileCompletionStep[] = [
      { id: 'avatar', label: label('avatar'), completed: false, required: true, weight: 20 },
      { id: 'country', label: label('country'), completed: false, required: true, weight: 15 },
      { id: 'club', label: label('club'), completed: false, required: true, weight: 15 },
      { id: 'bio', label: label('bio'), completed: false, required: false, weight: 10 },
      { id: 'position', label: label('position'), completed: false, required: false, weight: 10 },
      { id: 'cardData', label: label('cardData'), completed: false, required: false, weight: 20 },
      { id: 'brand', label: label('brand'), completed: false, required: false, weight: 5 },
      { id: 'socialLinks', label: label('socialLinks'), completed: false, required: false, weight: 5 },
    ];

    return {
      percentage: 0,
      completedSteps: 0,
      totalSteps: 8,
      steps,
      canUploadVideo: false,
      missingRequiredSteps: [label('avatar'), label('country'), label('club')],
    };
  }

  /**
   * Mark a step as completed
   */
  static async markStepCompleted(token: string, stepId: string): Promise<ProfileCompletionStatus | null> {
    try {
      const response = await fetch(`${API_URL}/profile/completion/step`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark step as completed');
      }

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        return data.data;
      }

      return null;
    } catch (error: any) {
      logger.error('Error marking step completed:', error);
      throw error;
    }
  }
}
