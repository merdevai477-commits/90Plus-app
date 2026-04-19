/**
 * Leagues API Service
 * API client for leagues-related endpoints (favorite leagues)
 * Uses existing /users/settings endpoint pattern
 */

import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

// Type for getToken function from useAuth hook
type GetTokenFunction = () => Promise<string | null>;

/**
 * Fetch user's favorite leagues from settings
 */
export const fetchFavoriteLeagues = async (
  getToken: GetTokenFunction
): Promise<number[]> => {
  try {
    const token = await getToken();
    if (!token) {
      return [];
    }

    const response = await fetch(`${API_URL}/users/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch favorite leagues: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'SUCCESS' && data.data) {
      return data.data.favoriteLeagues || [];
    }

    return [];
  } catch (error) {
    console.error('[LeaguesAPI] Error fetching favorite leagues:', error);
    throw error;
  }
};

/**
 * Toggle favorite league (add or remove)
 * Uses PATCH /users/settings endpoint
 */
export const toggleFavoriteLeague = async (
  getToken: GetTokenFunction,
  leagueId: number,
  currentFavoriteLeagues: number[]
): Promise<number[]> => {
  try {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Toggle the league in the array
    const isFavorite = currentFavoriteLeagues.includes(leagueId);
    const updatedFavoriteLeagues = isFavorite
      ? currentFavoriteLeagues.filter((id) => id !== leagueId)
      : [...currentFavoriteLeagues, leagueId];

    const response = await fetch(`${API_URL}/users/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        favoriteLeagues: updatedFavoriteLeagues,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle favorite league: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'SUCCESS') {
      return updatedFavoriteLeagues;
    }

    throw new Error('Failed to update favorite leagues');
  } catch (error) {
    console.error('[LeaguesAPI] Error toggling favorite league:', error);
    throw error;
  }
};

/**
 * Leagues API Service
 */
export const LeaguesApiService = {
  fetchFavoriteLeagues,
  toggleFavoriteLeague,
};

export default LeaguesApiService;

