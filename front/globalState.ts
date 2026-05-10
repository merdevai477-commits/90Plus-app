import { DiamondProfile } from './types/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = '@global_state';
const canUseAsyncStorage = () => {
  if (
    typeof window === 'undefined' &&
    typeof document === 'undefined' &&
    typeof navigator === 'undefined'
  ) {
    return false;
  }

  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  return true;
};

export interface TempAuthData {
  email: string;
  name: string;
  avatar?: string;
  userId?: string;
}

interface StoredState {
  userType: 'guest' | 'admin' | 'diamond';
  username: string;
  userProfile: DiamondProfile | null;
  isLoggedIn: boolean;
  localAvatar?: string;
  localCover?: string;
}

export const globalState = {
  userType: 'guest' as 'guest' | 'admin' | 'diamond',
  username: '',
  userProfile: null as DiamondProfile | null,
  isLoggedIn: false,
  needsUsernameCompletion: false,
  emailVerified: false,
  tempAuthData: null as TempAuthData | null,
  localAvatar: undefined as string | undefined,
  localCover: undefined as string | undefined,
  isLoaded: false,

  // Load state from AsyncStorage
  // Load state from AsyncStorage
    loadState: async () => {
      if (!canUseAsyncStorage()) {
        globalState.isLoaded = true;
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data: StoredState = JSON.parse(stored);
          globalState.userType = data.userType || 'guest';
          globalState.username = data.username || '';
          globalState.userProfile = data.userProfile;
          // NOTE: isLoggedIn state is restored but actual authentication
          // is managed by Clerk. The app should verify Clerk session validity
          // before trusting this state. This prevents unauthorized access
          // even if local storage contains stale login data.
          globalState.isLoggedIn = data.isLoggedIn || false;
          globalState.localAvatar = data.localAvatar;
          globalState.localCover = data.localCover;
        }
      } catch (error) {
        console.error('Error loading global state:', error);
      } finally {
        globalState.isLoaded = true;
      }
    },

  // Save state to AsyncStorage
  saveState: async () => {
    if (!canUseAsyncStorage()) return;

    try {
      const data: StoredState = {
        userType: globalState.userType,
        username: globalState.username,
        userProfile: globalState.userProfile,
        isLoggedIn: globalState.isLoggedIn,
        localAvatar: globalState.localAvatar,
        localCover: globalState.localCover,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving global state:', error);
    }
  },

  setUserType: (type: 'guest' | 'admin' | 'diamond') => {
      globalState.userType = type;
      globalState.saveState();
    },

  setUserProfile: (profile: DiamondProfile | null) => {
    globalState.userProfile = profile;
    globalState.saveState();
  },

  setLocalAvatar: (avatar: string | undefined) => {
    globalState.localAvatar = avatar;
    globalState.saveState();
  },

  setLocalCover: (cover: string | undefined) => {
    globalState.localCover = cover;
    globalState.saveState();
  },

  setNeedsUsernameCompletion: (needs: boolean) => {
    globalState.needsUsernameCompletion = needs;
  },

  setTempAuthData: (data: TempAuthData | null) => {
    globalState.tempAuthData = data;
  },

  setEmailVerified: (verified: boolean) => {
    globalState.emailVerified = verified;
  },

  logout: async () => {
    // Clear AsyncStorage first to prevent stale data from being loaded
    try {
      if (canUseAsyncStorage()) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error clearing global state from AsyncStorage:', error);
    }
    
    // Clear all state
    globalState.userType = 'guest';
    globalState.username = '';
    globalState.userProfile = null;
    globalState.isLoggedIn = false;
    globalState.needsUsernameCompletion = false;
    globalState.emailVerified = false;
    globalState.tempAuthData = null;
    // Clear local avatar and cover images
    globalState.localAvatar = undefined;
    globalState.localCover = undefined;
    
    // Clear AuthService memory cache
    const { AuthService } = require('./src/services/authService');
    AuthService.clearMemoryCache();
    
    // Clear local profile storage
    const { localProfileStorage } = require('./services/localProfileStorage');
    await localProfileStorage.clearAllUserData();
    
    // Clear all AsyncStorage keys related to user data
    try {
      if (canUseAsyncStorage()) {
        const keys = await AsyncStorage.getAllKeys();
        const userKeys = keys.filter(key => 
          key.includes('user') || 
          key.includes('profile') || 
          key.includes('cache') ||
          key.includes('@90plus')
        );
        if (userKeys.length > 0) {
          await AsyncStorage.multiRemove(userKeys);
        }
      }
    } catch (error) {
      console.error('Error clearing user-related AsyncStorage keys:', error);
    }
    
    // Save cleared state to ensure consistency
    await globalState.saveState();
  }
};

// Load state on import
globalState.loadState();
