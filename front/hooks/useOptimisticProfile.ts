/**
 * Hook for Optimistic Profile Updates
 * يوفر واجهة سهلة للتحديث الفوري للبروفايل
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { optimisticProfileService, ProfileUpdateData, OptimisticUpdateResult } from '../services/optimisticProfileService';
import { useToast } from '../contexts/ToastContext';
import { ToastHelper } from '../utils/professionalToastHelpers';
import { getClerkBearerToken } from '../utils/clerkAuthToken';

export interface UseOptimisticProfileReturn {
  updateProfile: (updates: ProfileUpdateData) => Promise<OptimisticUpdateResult>;
  isUpdating: boolean;
  hasPendingUpdates: boolean;
  pendingUpdatesCount: number;
  showUpdateResult: (result: OptimisticUpdateResult) => void;
}

export const useOptimisticProfile = (): UseOptimisticProfileReturn => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { getToken } = useAuth();
  const toast = useToast();

  const updateProfile = useCallback(async (updates: ProfileUpdateData): Promise<OptimisticUpdateResult> => {
    setIsUpdating(true);
    
    try {
      const token = await getClerkBearerToken(getToken);
      if (!token) {
        return {
          success: false,
          error: 'لم يتم العثور على رمز المصادقة. حاول تسجيل الدخول مرة أخرى.',
          canRetry: true,
        };
      }

      const result = await optimisticProfileService.updateProfile(token, updates, true);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'حدث خطأ غير متوقع'
      };
    } finally {
      setIsUpdating(false);
    }
  }, [getToken]);

  const showUpdateResult = useCallback((result: OptimisticUpdateResult) => {
    if (result.success) {
      ToastHelper.success(
        toast,
        'تم التحديث بنجاح',
        'تم تحديث البروفايل بنجاح وسيتم مزامنته مع الخادم'
      );
    } else {
      let message = result.error || 'فشل في تحديث البروفايل';
      
      // Handle specific error cases
      if (result.nextAllowedChange) {
        const daysRemaining = Math.ceil(
          (result.nextAllowedChange.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        message = `يمكنك تغيير اسم المستخدم بعد ${daysRemaining} يوم`;
        ToastHelper.warning(
          toast,
          'تغيير غير مسموح',
          message,
          { duration: 5000, position: 'center' }
        );
      } else if (result.canRetry) {
        ToastHelper.error(
          toast,
          'خطأ مؤقت',
          `${message}. يمكنك المحاولة مرة أخرى`,
          { duration: 4000 }
        );
      } else {
        ToastHelper.error(
          toast,
          'خطأ في التحديث',
          message,
          { duration: 4000 }
        );
      }
    }
  }, [toast]);

  return {
    updateProfile,
    isUpdating,
    hasPendingUpdates: optimisticProfileService.hasPendingUpdates(),
    pendingUpdatesCount: optimisticProfileService.getPendingUpdatesCount(),
    showUpdateResult
  };
};

/**
 * Hook for specific profile field updates
 */
export const useProfileFieldUpdate = () => {
  const { updateProfile, isUpdating, showUpdateResult } = useOptimisticProfile();

  const updateUsername = useCallback(async (username: string) => {
    const result = await updateProfile({ username });
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const result = await updateProfile({ displayName });
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  const updateBio = useCallback(async (bio: string) => {
    const result = await updateProfile({ bio });
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  const updateFIFACard = useCallback(async (cardData: {
    position?: string;
    countryFlag?: string;
    country?: string;
    age?: number;
    height?: number;
    weight?: number;
    preferredFoot?: string;
  }) => {
    const result = await updateProfile(cardData);
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  const updateSocialLinks = useCallback(async (socialLinks: {
    platform: string;
    url: string;
    username?: string;
  }[]) => {
    const result = await updateProfile({ socialLinks });
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  const updateFavorites = useCallback(async (favorites: {
    favoriteTeam?: string;
    favoriteClub?: string;
    favoriteBrand?: string;
    clubLogo?: string;
    brandLogo?: string;
  }) => {
    const result = await updateProfile(favorites);
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  return {
    updateUsername,
    updateDisplayName,
    updateBio,
    updateFIFACard,
    updateSocialLinks,
    updateFavorites,
    isUpdating
  };
};

/**
 * Hook for batch profile updates
 */
export const useBatchProfileUpdate = () => {
  const { updateProfile, isUpdating, showUpdateResult } = useOptimisticProfile();

  const updateMultipleFields = useCallback(async (updates: ProfileUpdateData) => {
    const result = await updateProfile(updates);
    showUpdateResult(result);
    return result;
  }, [updateProfile, showUpdateResult]);

  return {
    updateMultipleFields,
    isUpdating
  };
};