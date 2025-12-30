import { DiamondProfile } from './types/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@global_state';

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
  loadState: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StoredState = JSON.parse(stored);
        globalState.userType = data.userType || 'guest';
        globalState.username = data.username || '';
        globalState.userProfile = data.userProfile;
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
    if (type === 'admin' || type === 'diamond') {
      globalState.username = 'mahmoud_essam';
      globalState.isLoggedIn = true;
    } else {
      globalState.username = '';
      globalState.isLoggedIn = false;
    }
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

  login: (username: string, password: string) => {
    // Mock login logic
    if (username === 'mahmoud_essam' && password === 'password') {
      globalState.userType = 'diamond';
      globalState.username = username;
      globalState.isLoggedIn = true;
      globalState.saveState();
      return true;
    }
    return false;
  },

  logout: async () => {
    // Clear AsyncStorage first to prevent stale data from being loaded
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
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
    
    // Save cleared state to ensure consistency
    await globalState.saveState();
  }
};

// Load state on import
globalState.loadState();
