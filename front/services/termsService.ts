import { getApiUrl } from '../utils/getApiUrl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = getApiUrl();

export class TermsService {
  /**
   * Get latest terms of service
   */
  static async getLatestTerms(): Promise<{ version: string; content: string }> {
    try {
      const response = await fetch(`${API_URL}/terms/latest`, {
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000), // 10 seconds timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load terms of service`);
      }

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        return data.data;
      }

      throw new Error(data.message || 'Failed to get terms');
    } catch (error: any) {
      // Log as warning instead of error - terms might not be critical
      console.warn('Terms service unavailable:', error.message);
      
      // Return default terms if service is unavailable
      return {
        version: '1.0.0',
        content: 'شروط الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً.',
      };
    }
  }

  /**
   * Accept terms of service
   */
  static async acceptTerms(version: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      if (!token) {
        console.warn('No auth token available for accepting terms');
        return; // Silently fail if no token
      }

      const response = await fetch(`${API_URL}/terms/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version }),
        // Add timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to accept terms`);
      }

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Failed to accept terms');
      }
    } catch (error: any) {
      console.warn('Accept terms unavailable:', error.message);
      // Don't throw - accepting terms is not critical for app functionality
    }
  }

  /**
   * Check if user has accepted latest terms
   */
  static async hasAcceptedLatestTerms(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      if (!token) {
        return true; // If no token, assume terms are accepted (don't block user)
      }

      const response = await fetch(`${API_URL}/terms/user-acceptance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        // Add timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn('Terms acceptance check unavailable, assuming accepted');
        return true; // Assume accepted if service is down
      }

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        return data.data.hasAcceptedLatest;
      }

      return true; // Default to true if response format is unexpected
    } catch (error: any) {
      console.warn('Terms acceptance check failed:', error.message);
      return true; // Don't block user if service is unavailable
    }
  }
}
