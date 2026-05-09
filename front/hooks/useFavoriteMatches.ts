/**
 * Hook to manage favorite matches
 * Stores favorites locally and syncs with backend
 */

import { useState, useEffect, useCallback } from 'react';
import { MatchFavoritesStorage } from '../src/storage/matchFavorites.storage';
import { ApiFootballService } from '../services/apiFootball';
import { useAuth } from '@clerk/clerk-expo';
import { logger } from '../utils/logger';
import { Match } from '../components/Matches/matchCardUtils';

interface UseFavoriteMatchesResult {
  favoriteMatchIds: string[];
  isFavorite: (matchId: string) => boolean;
  toggleFavorite: (match: Match) => Promise<void>;
  loading: boolean;
}

export const useFavoriteMatches = (): UseFavoriteMatchesResult => {
  const [favoriteMatchIds, setFavoriteMatchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favorites = await MatchFavoritesStorage.getFavorites();
        setFavoriteMatchIds(favorites);
      } catch (error) {
        logger.error('Error loading favorite matches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  const isFavorite = useCallback((matchId: string): boolean => {
    return favoriteMatchIds.includes(matchId);
  }, [favoriteMatchIds]);

  const toggleFavorite = useCallback(async (match: Match) => {
    try {
      const matchId = match.id;
      const isCurrentlyFavorite = favoriteMatchIds.includes(matchId);
      const token = await getToken();

      if (isCurrentlyFavorite) {
        // Remove from favorites
        await MatchFavoritesStorage.removeFavorite(matchId);
        setFavoriteMatchIds(prev => prev.filter(id => id !== matchId));

        // Sync with backend
        if (token) {
          try {
            await ApiFootballService.unfavoriteMatch(parseInt(matchId), token);
            logger.debug(`🗑️ Removed favorite match: ${matchId}`);
          } catch (error) {
            logger.warn('Failed to sync unfavorite with backend:', error);
          }
        }
      } else {
        // Add to favorites
        await MatchFavoritesStorage.addFavorite(matchId);
        setFavoriteMatchIds(prev => [...prev, matchId]);

        // Sync with backend
        if (token) {
          try {
            await ApiFootballService.favoriteMatch(
              parseInt(matchId),
              {
                homeTeam: match.homeTeam?.name || '',
                awayTeam: match.awayTeam?.name || '',
                homeTeamLogo: match.homeTeam?.logo || '',
                awayTeamLogo: match.awayTeam?.logo || '',
                matchDate: match.fixtureDate ? new Date(match.fixtureDate).toISOString() : new Date().toISOString(),
                leagueName: match.league?.name || '',
              },
              token
            );
            logger.debug(`⭐ Added favorite match: ${matchId}`);
          } catch (error) {
            logger.warn('Failed to sync favorite with backend:', error);
          }
        }
      }
    } catch (error) {
      logger.error('Error toggling favorite match:', error);
    }
  }, [favoriteMatchIds, getToken]);

  return {
    favoriteMatchIds,
    isFavorite,
    toggleFavorite,
    loading,
  };
};

