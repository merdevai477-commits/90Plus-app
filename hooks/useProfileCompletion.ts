/**
 * Profile Completion Hook
 * Manages profile completion status and step tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { ProfileCompletionService, ProfileCompletionStatus } from '../services/profileCompletion.service';
import { logger } from '../utils/logger';

export const useProfileCompletion = (getToken: () => Promise<string | null>) => {
  const [completionStatus, setCompletionStatus] = useState<ProfileCompletionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch completion status
  const fetchCompletionStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const status = await ProfileCompletionService.getCompletionStatus(token);
      setCompletionStatus(status);
    } catch (err: any) {
      logger.error('Error fetching profile completion status:', err);
      setError(err.message || 'Failed to load profile completion status');
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Mark step as completed
  const markStepCompleted = useCallback(async (stepId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const updatedStatus = await ProfileCompletionService.markStepCompleted(token, stepId);
      if (updatedStatus) {
        setCompletionStatus(updatedStatus);
      }
    } catch (err: any) {
      logger.error('Error marking step completed:', err);
      throw err;
    }
  }, [getToken]);

  // Load on mount with error handling
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async () => {
      try {
        if (isMounted) {
          await fetchCompletionStatus();
        }
      } catch (err) {
        // Don't retry on mount if it fails - let user manually retry
        console.log('Profile completion failed to load on mount:', err);
      }
    };

    loadWithRetry();
    
    return () => {
      isMounted = false;
    };
  }, []); // Remove fetchCompletionStatus from deps to prevent infinite loop

  return {
    completionStatus,
    isLoading,
    error,
    fetchCompletionStatus,
    markStepCompleted,
  };
};