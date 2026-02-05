import { getApiUrl } from '../utils/getApiUrl';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = getApiUrl();

export class ReportService {
  /**
   * Report a reel
   */
  static async reportReel(reelId: string, reason: string, additionalInfo?: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      const response = await fetch(`${API_URL}/reports/reel/${reelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, additionalInfo }),
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Failed to report reel');
      }
    } catch (error) {
      console.error('Report reel error:', error);
      throw error;
    }
  }

  /**
   * Report a comment
   */
  static async reportComment(commentId: string, reason: string, additionalInfo?: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      const response = await fetch(`${API_URL}/reports/comment/${commentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, additionalInfo }),
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Failed to report comment');
      }
    } catch (error) {
      console.error('Report comment error:', error);
      throw error;
    }
  }

  /**
   * Report a user
   */
  static async reportUser(userId: string, reason: string, additionalInfo?: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('@session_token');

      const response = await fetch(`${API_URL}/users/report/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, additionalInfo }),
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Failed to report user');
      }
    } catch (error) {
      console.error('Report user error:', error);
      throw error;
    }
  }
}
