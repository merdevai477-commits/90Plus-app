import { getApiUrl } from '../utils/getApiUrl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = getApiUrl();

export class AccountDeletionService {
  /**
   * Delete user account
   */
  static async deleteAccount(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      const response = await fetch(`${API_URL}/users/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }
}
