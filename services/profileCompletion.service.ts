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
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        
        if (response.status === 429) {
          throw new Error('Too many requests - Please try again later');
        }
        
        if (response.status === 500) {
          throw new Error('Failed to get profile');
        }
        
        throw new Error(errorData.message || 'Failed to get profile completion status');
      }

      const data = await response.json();
      if (data.status === 'SUCCESS') {
        return data.data;
      }

      return null;
    } catch (error: any) {
      logger.error('Error getting profile completion status:', error);
      throw error;
    }
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
