/**
 * Language Sync Service
 * 
 * Handles synchronization of language preferences with the backend,
 * including retry logic and offline scenarios.
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../../config/api.config';
import { Language, DEFAULT_LANGUAGE, isLanguageSupported } from './types';

const API_URL = getApiUrl();

/**
 * Storage keys for sync service
 */
export const SYNC_STORAGE_KEYS = {
  PENDING_SYNC: '@app:language_pending_sync',
  LAST_SYNCED_LANGUAGE: '@app:language_last_synced',
} as const;

/**
 * Maximum retry attempts for backend sync
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Delay between retry attempts (in milliseconds)
 */
const RETRY_DELAY_MS = 1000;

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  language?: Language;
  error?: string;
}

/**
 * Pending sync item stored when offline
 */
interface PendingSyncItem {
  language: Language;
  timestamp: number;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sync language preference to backend with retry logic
 * 
 * Requirements:
 * - 1.2: Persist preference to backend within 5 seconds
 * - 1.4: Store locally and retry on failure
 * 
 * @param language - Language code to sync
 * @param token - Authentication token
 * @returns SyncResult indicating success or failure
 */
export async function syncToBackend(
  language: Language,
  token: string | null
): Promise<SyncResult> {
  // If no token (user not logged in), store locally only (Requirement 1.5)
  if (!token) {
    await storePendingSync(language);
    return { success: true, language };
  }

  let lastError: string | undefined;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${API_URL}/users/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: { language } }),
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        // Clear any pending sync on success
        await clearPendingSync();
        await AsyncStorage.setItem(SYNC_STORAGE_KEYS.LAST_SYNCED_LANGUAGE, language);
        return { success: true, language };
      }

      lastError = data.message || 'Failed to sync language';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
    }

    // Wait before retrying (exponential backoff)
    if (attempt < MAX_RETRY_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  // All retries failed - store for later sync (Requirement 1.4)
  await storePendingSync(language);
  return { success: false, error: lastError };
}

/**
 * Fetch language preference from backend
 * 
 * Requirements:
 * - 1.3: Fetch language preference from backend on login
 * 
 * @param token - Authentication token
 * @returns Language code or null if not found/error
 */
export async function fetchFromBackend(token: string | null): Promise<Language | null> {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/users/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.status === 'SUCCESS' && data.data) {
      const settings = data.data;
      const language = settings.language;

      if (language && isLanguageSupported(language)) {
        return language;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching language from backend:', error);
    return null;
  }
}

/**
 * Store a pending sync item for later retry
 * 
 * Requirements:
 * - 1.4: Store preference locally and retry on next app launch
 * 
 * @param language - Language to sync later
 */
async function storePendingSync(language: Language): Promise<void> {
  try {
    const pendingItem: PendingSyncItem = {
      language,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(
      SYNC_STORAGE_KEYS.PENDING_SYNC,
      JSON.stringify(pendingItem)
    );
  } catch (error) {
    console.error('Error storing pending sync:', error);
  }
}

/**
 * Clear pending sync after successful sync
 */
async function clearPendingSync(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SYNC_STORAGE_KEYS.PENDING_SYNC);
  } catch (error) {
    console.error('Error clearing pending sync:', error);
  }
}

/**
 * Get pending sync item if exists
 * 
 * @returns Pending sync item or null
 */
export async function getPendingSync(): Promise<PendingSyncItem | null> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_STORAGE_KEYS.PENDING_SYNC);
    if (stored) {
      return JSON.parse(stored) as PendingSyncItem;
    }
    return null;
  } catch (error) {
    console.error('Error getting pending sync:', error);
    return null;
  }
}

/**
 * Process any pending sync when app launches or network becomes available
 * 
 * Requirements:
 * - 1.4: Retry sync on next app launch
 * 
 * @param token - Authentication token
 * @returns SyncResult or null if no pending sync
 */
export async function processPendingSync(token: string | null): Promise<SyncResult | null> {
  const pending = await getPendingSync();
  
  if (!pending) {
    return null;
  }

  // Only process if we have a token now
  if (!token) {
    return null;
  }

  // Attempt to sync the pending language
  const result = await syncToBackend(pending.language, token);
  
  return result;
}

/**
 * Check if there's a pending sync
 * 
 * @returns True if there's a pending sync
 */
export async function hasPendingSync(): Promise<boolean> {
  const pending = await getPendingSync();
  return pending !== null;
}

/**
 * Get the last successfully synced language
 * 
 * @returns Last synced language or null
 */
export async function getLastSyncedLanguage(): Promise<Language | null> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_STORAGE_KEYS.LAST_SYNCED_LANGUAGE);
    if (stored && isLanguageSupported(stored)) {
      return stored;
    }
    return null;
  } catch (error) {
    console.error('Error getting last synced language:', error);
    return null;
  }
}

/**
 * Language Sync Service class for more structured usage
 */
export class LanguageSyncService {
  private token: string | null = null;

  /**
   * Set the authentication token
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Sync language to backend
   * Requirements: 1.2, 1.4
   */
  async syncToBackend(language: Language): Promise<SyncResult> {
    return syncToBackend(language, this.token);
  }

  /**
   * Fetch language from backend
   * Requirements: 1.3
   */
  async fetchFromBackend(): Promise<Language | null> {
    return fetchFromBackend(this.token);
  }

  /**
   * Process any pending sync
   * Requirements: 1.4
   */
  async processPendingSync(): Promise<SyncResult | null> {
    return processPendingSync(this.token);
  }

  /**
   * Check if there's a pending sync
   */
  async hasPendingSync(): Promise<boolean> {
    return hasPendingSync();
  }
}

// Export a singleton instance for convenience
export const languageSyncService = new LanguageSyncService();
