/**
 * Optimistic Profile Update Service
 * نظام التحديث الفوري للبروفايل مع التراجع عند الفشل
 */

import { AuthService } from '../src/services/authService';
import { globalState } from '../globalState';
import { cacheService, CACHE_KEYS } from './cacheService';
import * as Haptics from 'expo-haptics';

export interface ProfileUpdateData {
  username?: string;
  displayName?: string;
  bio?: string;
  position?: string;
  countryFlag?: string;
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  favoriteTeam?: string;
  favoriteClub?: string;
  favoriteBrand?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
}

export interface OptimisticUpdateResult {
  success: boolean;
  error?: string;
  canRetry?: boolean;
  nextAllowedChange?: Date; // For username restrictions
}

class OptimisticProfileService {
  private pendingUpdates = new Map<string, any>(); // Track pending updates
  private rollbackData = new Map<string, any>(); // Store original data for rollback

  /**
   * Update profile with optimistic UI updates
   */
  async updateProfile(
    token: string,
    updates: ProfileUpdateData,
    showHapticFeedback = true
  ): Promise<OptimisticUpdateResult> {
    
    // 1. Store original data for potential rollback
    const originalProfile = { ...globalState.userProfile };
    const updateId = Date.now().toString();
    this.rollbackData.set(updateId, originalProfile);

    try {
      // 2. Apply optimistic updates immediately (UI updates instantly)
      this.applyOptimisticUpdates(updates);
      
      if (showHapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // 3. Mark as pending
      this.pendingUpdates.set(updateId, updates);

      // 4. Send to backend (async, don't block UI)
      const result = await this.sendToBackend(token, updates);

      // 5. Handle backend response
      if (result.success) {
        // Success: Update with server data and clear pending
        if (result.data?.user) {
          this.updateGlobalState(result.data.user);
          await this.updateCache(result.data.user);
        }
        this.pendingUpdates.delete(updateId);
        this.rollbackData.delete(updateId);
        
        if (showHapticFeedback) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        return { success: true };
      } else {
        // Failure: Rollback optimistic changes
        await this.rollbackChanges(updateId);
        
        if (showHapticFeedback) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        return {
          success: false,
          error: result.error,
          canRetry: result.canRetry,
          nextAllowedChange: result.nextAllowedChange
        };
      }

    } catch (error: any) {
      // Network/unexpected error: Rollback
      await this.rollbackChanges(updateId);
      
      if (showHapticFeedback) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      return {
        success: false,
        error: error.message || 'حدث خطأ غير متوقع',
        canRetry: true
      };
    }
  }

  /**
   * Apply optimistic updates to global state (immediate UI update)
   */
  private applyOptimisticUpdates(updates: ProfileUpdateData): void {
    if (!globalState.userProfile) return;

    const updatedProfile = { ...globalState.userProfile };

    // Apply all updates
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        if (key === 'socialLinks' && updatedProfile.socialLinks) {
          updatedProfile.socialLinks = { ...updatedProfile.socialLinks, ...value };
        } else {
          (updatedProfile as any)[key] = value;
        }
      }
    });

    // Update global state immediately
    globalState.setUserProfile(updatedProfile);
  }

  /**
   * Send updates to backend with validation
   */
  private async sendToBackend(
    token: string, 
    updates: ProfileUpdateData
  ): Promise<{
    success: boolean;
    error?: string;
    canRetry?: boolean;
    nextAllowedChange?: Date;
    data?: any;
  }> {
    try {
      // Check username change restrictions first
      if (updates.username) {
        const canChangeUsername = await this.checkUsernameChangeAllowed(token);
        if (!canChangeUsername.allowed) {
          return {
            success: false,
            error: canChangeUsername.error,
            canRetry: false,
            nextAllowedChange: canChangeUsername.nextAllowedDate
          };
        }
      }

      // Send update request
      const response = await AuthService.updateUserProfile(token, updates);
      
      if (response.status === 'SUCCESS') {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.message || 'فشل في تحديث البروفايل',
          canRetry: true
        };
      }

    } catch (error: any) {
      // Handle specific error types
      if (error.message.includes('username')) {
        return {
          success: false,
          error: 'اسم المستخدم غير متاح أو غير صالح',
          canRetry: false
        };
      }

      if (error.message.includes('network') || error.message.includes('timeout')) {
        return {
          success: false,
          error: 'مشكلة في الاتصال، يرجى المحاولة مرة أخرى',
          canRetry: true
        };
      }

      return {
        success: false,
        error: error.message || 'حدث خطأ في الخادم',
        canRetry: true
      };
    }
  }

  /**
   * Check if username change is allowed (15-day restriction)
   */
  private async checkUsernameChangeAllowed(token: string): Promise<{
    allowed: boolean;
    error?: string;
    nextAllowedDate?: Date;
  }> {
    try {
      const response = await fetch(`${AuthService.getApiUrl()}/clerk/username-change-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.status === 'SUCCESS') {
        if (data.data.canChange) {
          return { allowed: true };
        } else {
          const nextDate = new Date(data.data.nextAllowedChange);
          const daysRemaining = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          return {
            allowed: false,
            error: `يمكنك تغيير اسم المستخدم بعد ${daysRemaining} يوم`,
            nextAllowedDate: nextDate
          };
        }
      } else {
        return {
          allowed: false,
          error: data.message || 'لا يمكن التحقق من إمكانية تغيير اسم المستخدم'
        };
      }

    } catch (error) {
      // If we can't check, assume it's allowed (fail-safe)
      return { allowed: true };
    }
  }

  /**
   * Rollback optimistic changes
   */
  private async rollbackChanges(updateId: string): Promise<void> {
    const originalData = this.rollbackData.get(updateId);
    if (originalData) {
      globalState.setUserProfile(originalData);
      this.rollbackData.delete(updateId);
    }
    this.pendingUpdates.delete(updateId);
  }

  /**
   * Update global state with server data
   */
  private updateGlobalState(userData: any): void {
    if (globalState.userProfile) {
      const updatedProfile = { ...globalState.userProfile, ...userData };
      globalState.setUserProfile(updatedProfile);
    }
  }

  /**
   * Update cache with new data
   */
  private async updateCache(userData: any): Promise<void> {
    try {
      await cacheService.set(CACHE_KEYS.PROFILE_DATA, userData, 5 * 60 * 1000);
    } catch (error) {
      console.warn('Failed to update profile cache:', error);
    }
  }

  /**
   * Check if there are pending updates
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0;
  }

  /**
   * Get pending updates count
   */
  getPendingUpdatesCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * Clear all pending updates (use with caution)
   */
  clearPendingUpdates(): void {
    this.pendingUpdates.clear();
    this.rollbackData.clear();
  }
}

// Export singleton instance
export const optimisticProfileService = new OptimisticProfileService();

/**
 * Hook for using optimistic profile updates
 */
export const useOptimisticProfile = () => {
  return {
    updateProfile: optimisticProfileService.updateProfile.bind(optimisticProfileService),
    hasPendingUpdates: optimisticProfileService.hasPendingUpdates.bind(optimisticProfileService),
    getPendingUpdatesCount: optimisticProfileService.getPendingUpdatesCount.bind(optimisticProfileService),
  };
};