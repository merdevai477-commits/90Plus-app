/**
 * Local Profile Storage Service
 * خدمة حفظ بيانات الملف الشخصي محلياً
 * 
 * This service saves profile data locally to prevent loss on logout
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

interface LocalProfileData {
  countryFlag?: string;
  country?: string;
  clubLogo?: string;
  favoriteTeam?: string;
  brandLogo?: string;
  favoriteBrand?: string;
  position?: string;
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  lastUpdated: number;
}

const STORAGE_KEY = '@90plus_local_profile';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

class LocalProfileStorageService {
  /**
   * Save profile data locally
   */
  async saveProfileData(data: Partial<LocalProfileData>): Promise<void> {
    try {
      const existing = await this.getProfileData();
      const updated: LocalProfileData = {
        ...existing,
        ...data,
        lastUpdated: Date.now()
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      logger.debug('✅ Profile data saved locally:', Object.keys(data));
    } catch (error) {
      logger.error('❌ Failed to save profile data locally:', error);
    }
  }

  /**
   * Get locally saved profile data
   */
  async getProfileData(): Promise<LocalProfileData> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { lastUpdated: Date.now() };
      }

      const data: LocalProfileData = JSON.parse(stored);
      
      // Check if data is expired
      if (Date.now() - data.lastUpdated > CACHE_DURATION) {
        await this.clearProfileData();
        return { lastUpdated: Date.now() };
      }

      logger.debug('✅ Profile data loaded from local storage');
      return data;
    } catch (error) {
      logger.error('❌ Failed to load profile data from local storage:', error);
      return { lastUpdated: Date.now() };
    }
  }

  /**
   * Clear locally saved profile data
   */
  async clearProfileData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      logger.debug('✅ Local profile data cleared');
    } catch (error) {
      logger.error('❌ Failed to clear local profile data:', error);
    }
  }

  /**
   * Clear all user-related data (for logout)
   */
  async clearAllUserData(): Promise<void> {
    try {
      // Clear profile data
      await this.clearProfileData();
      
      // Clear other user-related keys
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => 
        key.includes('@90plus') || 
        key.includes('user') || 
        key.includes('profile') ||
        key.includes('cache') ||
        key.includes('local')
      );
      
      if (userKeys.length > 0) {
        await AsyncStorage.multiRemove(userKeys);
        logger.debug('✅ All user data cleared:', userKeys);
      }
    } catch (error) {
      logger.error('❌ Failed to clear all user data:', error);
    }
  }

  /**
   * Update specific field
   */
  async updateField(field: keyof LocalProfileData, value: any): Promise<void> {
    const data = { [field]: value };
    await this.saveProfileData(data);
  }

  /**
   * Get specific field
   */
  async getField(field: keyof LocalProfileData): Promise<any> {
    const data = await this.getProfileData();
    return data[field];
  }

  /**
   * Check if we have local data for a user
   */
  async hasLocalData(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return !!stored;
    } catch {
      return false;
    }
  }

  /**
   * Merge server data with local data (local takes precedence for UI elements)
   */
  async mergeWithServerData(serverData: any): Promise<any> {
    const localData = await this.getProfileData();
    
    return {
      ...serverData,
      // Local data overrides server data for UI elements
      countryFlag: localData.countryFlag ?? serverData.countryFlag,
      country: localData.country ?? serverData.country,
      clubLogo: localData.clubLogo ?? serverData.clubLogo,
      favoriteTeam: localData.favoriteTeam ?? serverData.favoriteTeam,
      brandLogo: localData.brandLogo ?? serverData.brandLogo,
      favoriteBrand: localData.favoriteBrand ?? serverData.favoriteBrand,
      position: localData.position ?? serverData.position,
      age: localData.age ?? serverData.age,
      height: localData.height ?? serverData.height,
      weight: localData.weight ?? serverData.weight,
      preferredFoot: localData.preferredFoot ?? serverData.preferredFoot,
    };
  }
}

export const localProfileStorage = new LocalProfileStorageService();