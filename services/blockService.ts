/**
 * Block Service
 * Handles user blocking/unblocking functionality
 * Required for Apple Guideline 1.2 compliance
 */

import { getApiUrl } from '../utils/getApiUrl';
import { logger } from './logger';

const API_URL = getApiUrl();

export interface BlockedUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  blockedAt: string;
}

export class BlockService {
  /**
   * Block a user
   */
  static async blockUser(userId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/users/block/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to block user');
      }

      logger.info('User blocked successfully', { userId });
    } catch (error) {
      logger.error('Block user error:', error);
      throw error;
    }
  }

  /**
   * Unblock a user
   */
  static async unblockUser(userId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/users/block/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unblock user');
      }

      logger.info('User unblocked successfully', { userId });
    } catch (error) {
      logger.error('Unblock user error:', error);
      throw error;
    }
  }

  /**
   * Get list of blocked users
   */
  static async getBlockedUsers(token: string): Promise<BlockedUser[]> {
    try {
      const response = await fetch(`${API_URL}/users/blocked`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch blocked users');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      logger.error('Get blocked users error:', error);
      throw error;
    }
  }

  /**
   * Check if a user is blocked
   */
  static async isUserBlocked(userId: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/users/block/${userId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.isBlocked || false;
    } catch (error) {
      logger.error('Check block status error:', error);
      return false;
    }
  }
}
