import { getApiUrl } from '../utils/getApiUrl';

const API_URL = getApiUrl();

export class AccountDeletionService {
  /**
   * Delete user account (requires Clerk session token).
   */
  static async deleteAccount(authToken: string): Promise<void> {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/users/me`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    let data: { status?: string; message?: string } = {};
    try {
      data = await response.json();
    } catch {
      // Non-JSON error body
    }

    if (!response.ok || data.status !== 'SUCCESS') {
      throw new Error(data.message || 'Failed to delete account');
    }
  }
}
