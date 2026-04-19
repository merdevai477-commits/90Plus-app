/**
 * useFavoriteLeagues Hook
 * Custom hook for managing favorite leagues
 * Integrates with SettingsContext and backend API
 */

import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useSettings } from '../contexts/SettingsContext';
import { logger } from '../utils/logger';
import * as Haptics from 'expo-haptics';

export interface UseFavoriteLeaguesResult {
  favoriteLeagues: number[];
  isFavorite: (leagueId: number) => boolean;
  toggleFavorite: (leagueId: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Note: SettingsContext already syncs to backend via /users/settings endpoint
// This hook provides a simple interface for favorite leagues management

/**
 * Custom hook for favorite leagues management
 * Manages state locally via SettingsContext (which syncs to backend)
 */
export const useFavoriteLeagues = (): UseFavoriteLeaguesResult => {
  const { isSignedIn } = useAuth();
  const { settings, addFavoriteLeague, removeFavoriteLeague } = useSettings();

  // Get favorite leagues from settings
  const favoriteLeagues = settings.favoriteLeagues || [];

  /**
   * Check if a league is favorite
   */
  const isFavorite = useCallback(
    (leagueId: number) => {
      return favoriteLeagues.includes(leagueId);
    },
    [favoriteLeagues]
  );

  /**
   * Toggle favorite league
   * SettingsContext handles backend sync automatically
   */
  const toggleFavorite = useCallback(
    async (leagueId: number) => {
      if (!isSignedIn) {
        logger.warn('[useFavoriteLeagues] Cannot toggle favorite: user not signed in');
        return;
      }

      const currentIsFavorite = isFavorite(leagueId);

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        // Update via SettingsContext (which handles local + backend sync)
        if (currentIsFavorite) {
          await removeFavoriteLeague(leagueId);
        } else {
          await addFavoriteLeague(leagueId);
        }
      } catch (error) {
        logger.error('[useFavoriteLeagues] Error toggling favorite:', error);
        throw error;
      }
    },
    [isSignedIn, favoriteLeagues, isFavorite, addFavoriteLeague, removeFavoriteLeague]
  );

  return {
    favoriteLeagues,
    isFavorite,
    toggleFavorite,
    isLoading: false, // SettingsContext handles loading internally
    error: null, // Errors can be handled at component level if needed
  };
};

export default useFavoriteLeagues;

