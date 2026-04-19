/**
 * Profile Completion Service
 * Handles profile completion status and tracking
 */

import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

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
   * Get default incomplete profile (used when user is not yet created)
   */
  private static getDefaultIncompleteProfile(): ProfileCompletionStatus {
    return {
      percentage: 0,
      completedSteps: 0,
      totalSteps: 8,
      steps: [
        { id: 'avatar', label: 'صورة البروفايل', completed: false, required: true, weight: 20 },
        { id: 'country', label: 'البلد', completed: false, required: true, weight: 15 },
        { id: 'club', label: 'النادي المفضل', completed: false, required: true, weight: 15 },
        { id: 'bio', label: 'النبذة التعريفية', completed: false, required: false, weight: 10 },
        { id: 'position', label: 'المركز', completed: false, required: false, weight: 10 },
        { id: 'cardData', label: 'بيانات الكارت', completed: false, required: false, weight: 20 },
        { id: 'brand', label: 'البراند المفضل', completed: false, required: false, weight: 5 },
        { id: 'socialLinks', label: 'روابط السوشيال ميديا', completed: false, required: false, weight: 5 },
      ],
      canUploadVideo: false,
      missingRequiredSteps: ['صورة البروفايل', 'البلد', 'النادي المفضل'],
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
