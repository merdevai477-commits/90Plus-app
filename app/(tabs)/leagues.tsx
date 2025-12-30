import React, { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import LeagueCenterScreen from '../../components/league-center/LeagueCenterScreen';
import { UserPrediction } from '../../components/league-center/GradientMatchCard';
import PredictionStorage, { StoredPrediction } from '../../services/predictionStorage';
import { useHomeStore } from '../../src/store/home.store';
import { useAuth } from '@clerk/clerk-expo';
import { useHaptic } from '../../hooks/useHaptic';
import { useSettings } from '../../contexts/SettingsContext';
import { logger } from '../../utils/logger';

/**
 * Leagues Screen - League Center
 */
const LeaguesScreen = () => {
  const [userPredictions, setUserPredictions] = useState<{ [matchId: string]: UserPrediction }>({});
  const { toggleFavorite } = useHomeStore();
  const { getToken } = useAuth();
  const { trigger } = useHaptic();
  const { settings } = useSettings();

  // Get user's favorite leagues from settings
  const userFavoriteLeagues = settings.favoriteLeagues || [];

  // Load user predictions on mount
  useEffect(() => {
    loadUserPredictions();
  }, []);

  const loadUserPredictions = async () => {
    try {
      const predictions = await PredictionStorage.getAllPredictions();
      const predictionsMap: { [key: string]: UserPrediction } = {};

      predictions.forEach((pred) => {
        predictionsMap[pred.matchId] = {
          type: pred.prediction.type,
          points: pred.points,
        };
      });

      setUserPredictions(predictionsMap);
    } catch (error) {
      logger.error('Error loading predictions:', error);
    }
  };

  const handlePredictionSubmit = useCallback(async (matchId: string, prediction: UserPrediction) => {
    try {
      // Create stored prediction
      const storedPrediction: StoredPrediction = {
        id: `pred_${matchId}_${Date.now()}`,
        matchId,
        fixtureId: parseInt(matchId) || 0,
        homeTeam: '',
        awayTeam: '',
        prediction: {
          type: prediction.type,
          homeScore: 0,
          awayScore: 0,
        },
        timestamp: Date.now(),
        status: 'pending',
        points: prediction.points || 5,
      };

      // Save to storage
      await PredictionStorage.savePrediction(storedPrediction);

      // Update local state
      setUserPredictions((prev) => ({
        ...prev,
        [matchId]: prediction,
      }));

      Alert.alert('✅ Prediction Saved', 'Your prediction has been recorded!');
    } catch (error) {
      logger.error('Error saving prediction:', error);
      Alert.alert('Error', 'Failed to save prediction');
      throw error;
    }
  }, []);

  const handleFavoritePress = useCallback(async (matchId: string) => {
    try {
      trigger('selection');
      const token = await getToken();
      await toggleFavorite(matchId, token);
    } catch (error) {
      logger.error('Error toggling favorite in leagues screen:', error);
    }
  }, [toggleFavorite, getToken, trigger]);

  return (
    <LeagueCenterScreen
      showPredictions={true}
      userPredictions={userPredictions}
      onPredictionSubmit={handlePredictionSubmit}
      onFavoritePress={handleFavoritePress}
      initialSelectedLeagues={userFavoriteLeagues}
    />
  );
};

export default LeaguesScreen;
