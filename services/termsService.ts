import { getApiUrl } from '../utils/getApiUrl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = getApiUrl();

export class TermsService {
  /**
   * Get latest terms of service
   */
  static async getLatestTerms(): Promise<{ version: string; content: string }> {
    try {
      const response = await fetch(`${API_URL}/terms/latest`);
      const data = await response.json();

      if (data.status === 'SUCCESS') {
        return data.data;
      }

      throw new Error(data.message || 'Failed to get terms');
    } catch (error) {
      console.error('Get terms error:', error);
      throw error;
    }
  }

  /**
   * Accept terms of service
   */
  static async acceptTerms(version: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      const response = await fetch(`${API_URL}/terms/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version }),
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Failed to accept terms');
      }
    } catch (error) {
      console.error('Accept terms error:', error);
      throw error;
    }
  }

  /**
   * Check if user has accepted latest terms
   */
  static async hasAcceptedLatestTerms(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      const response = await fetch(`${API_URL}/terms/user-acceptance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        return data.data.hasAcceptedLatest;
      }

      return false;
    } catch (error) {
      console.error('Check terms acceptance error:', error);
      return false;
    }
  }
}
