/**
 * Profile Completion Hook
 * Manages profile completion status and step tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { ProfileCompletionService, ProfileCompletionStatus } from '../services/profileCompletion.service';
import { logger } from '../utils/logger';
import { cacheService, CACHE_KEYS } from '../services/cacheService';

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
        // Set default incomplete profile if no token
        setCompletionStatus({
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
        });
        return;
      }

      const status = await ProfileCompletionService.getCompletionStatus(token);
      if (status) {
        setCompletionStatus(status);
        // ✅ Cache the completion status
        await cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, status, 5 * 60 * 1000); // 5 minutes
      }
    } catch (err: any) {
      // Don't log "User not found" errors - they're expected on first login
      if (!err.message?.includes('User not found')) {
        logger.warn('Profile completion status unavailable:', err.message);
      }
      
      // Don't set error state for "User not found" - it's expected
      if (!err.message?.includes('User not found')) {
        setError(err.message || 'Failed to load profile completion status');
      }
      
      // Try to load from cache on error
      const cachedStatus = await cacheService.get<ProfileCompletionStatus>(CACHE_KEYS.PROFILE_COMPLETION);
      if (cachedStatus) {
        setCompletionStatus(cachedStatus);
        return;
      }
      
      // Set default incomplete profile on error (fallback)
      setCompletionStatus({
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
      });
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
        // ✅ Update cache immediately
        await cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, updatedStatus, 5 * 60 * 1000);
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
        // Try to load from cache first
        const cachedStatus = await cacheService.get<ProfileCompletionStatus>(CACHE_KEYS.PROFILE_COMPLETION);
        if (cachedStatus && isMounted) {
          setCompletionStatus(cachedStatus);
        }
        
        // Then fetch fresh data
        const token = await getToken();
        if (!token || !isMounted) return;

        const status = await ProfileCompletionService.getCompletionStatus(token);
        if (isMounted && status) {
          setCompletionStatus(status);
          // Update cache
          await cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, status, 5 * 60 * 1000);
        }
      } catch (err: any) {
        // Silently fail for "User not found" - it's expected on first login
        if (!err.message?.includes('User not found') && isMounted) {
          logger.info('Profile completion not yet available:', err.message);
        }
      }
    };

    loadWithRetry();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty deps - only run once on mount

  return {
    completionStatus,
    isLoading,
    error,
    fetchCompletionStatus,
    markStepCompleted,
  };
};