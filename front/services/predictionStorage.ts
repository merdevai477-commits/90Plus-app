/**
 * Local storage service for predictions
 * Uses AsyncStorage to persist predictions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Import coins management
const COINS_STORAGE_KEY = '@user_coins';

const PREDICTIONS_KEY = '@football_predictions';
const USER_STATS_KEY = '@football_user_stats';

export interface StoredPrediction {
  id: string;
  matchId: string;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  prediction: {
    type: 'home' | 'draw' | 'away';
    homeScore: number;
    awayScore: number;
  };
  timestamp: number;
  status: 'pending' | 'correct' | 'incorrect';
  points?: number;
}

export interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  incorrectPredictions: number;
  pendingPredictions: number;
  totalPoints: number; // Gold coins
  accuracy: number;
  streak: number;
  bestStreak: number;
  level: number;
  rank: number;
}

class PredictionStorage {
  /**
   * Save a prediction
   */
  async savePrediction(prediction: StoredPrediction): Promise<void> {
    try {
      const predictions = await this.getAllPredictions();
      
      // Check if prediction already exists
      const existingIndex = predictions.findIndex(
        p => p.matchId === prediction.matchId || p.fixtureId === prediction.fixtureId
      );

      if (existingIndex >= 0) {
        // Update existing prediction
        predictions[existingIndex] = prediction;
      } else {
        // Add new prediction
        predictions.push(prediction);
      }

      await AsyncStorage.setItem(PREDICTIONS_KEY, JSON.stringify(predictions));
      await this.updateUserStats();
    } catch (error) {
      console.error('Error saving prediction:', error);
      throw error;
    }
  }

  /**
   * Get all predictions
   */
  async getAllPredictions(): Promise<StoredPrediction[]> {
    try {
      const data = await AsyncStorage.getItem(PREDICTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting predictions:', error);
      return [];
    }
  }

  /**
   * Get prediction by match ID
   */
  async getPredictionByMatchId(matchId: string): Promise<StoredPrediction | null> {
    try {
      const predictions = await this.getAllPredictions();
      return predictions.find(p => p.matchId === matchId) || null;
    } catch (error) {
      console.error('Error getting prediction:', error);
      return null;
    }
  }

  /**
   * Get prediction by fixture ID
   */
  async getPredictionByFixtureId(fixtureId: number): Promise<StoredPrediction | null> {
    try {
      const predictions = await this.getAllPredictions();
      return predictions.find(p => p.fixtureId === fixtureId) || null;
    } catch (error) {
      console.error('Error getting prediction:', error);
      return null;
    }
  }

  /**
   * Check if user has predicted a match
   */
  async hasPredicted(matchId: string, fixtureId?: number): Promise<boolean> {
    try {
      const predictions = await this.getAllPredictions();
      return predictions.some(
        p => p.matchId === matchId || (fixtureId && p.fixtureId === fixtureId)
      );
    } catch (error) {
      console.error('Error checking prediction:', error);
      return false;
    }
  }

  /**
   * Update prediction status after match ends
   */
  async updatePredictionStatus(
    matchId: string,
    actualHomeScore: number,
    actualAwayScore: number
  ): Promise<void> {
    try {
      const predictions = await this.getAllPredictions();
      const prediction = predictions.find(p => p.matchId === matchId);

      if (!prediction) return;

      // Skip if already evaluated
      if (prediction.status !== 'pending') return;

      const { homeScore, awayScore, type } = prediction.prediction;
      
      // Check if prediction is correct
      let isCorrect = false;
      let points = 0;

      // Correct result (win/draw/lose)
      if (
        (type === 'home' && actualHomeScore > actualAwayScore) ||
        (type === 'away' && actualAwayScore > actualHomeScore) ||
        (type === 'draw' && actualHomeScore === actualAwayScore)
      ) {
        isCorrect = true;
        points = 5; // 5 gold coins for correct prediction
        
        // Add coins to user's balance
        await this.addCoinsToBalance(points);
      }

      prediction.status = isCorrect ? 'correct' : 'incorrect';
      prediction.points = points;

      await AsyncStorage.setItem(PREDICTIONS_KEY, JSON.stringify(predictions));
      await this.updateUserStats();
    } catch (error) {
      console.error('Error updating prediction status:', error);
    }
  }

  /**
   * Add coins to user's balance (central coins system)
   */
  private async addCoinsToBalance(amount: number): Promise<void> {
    try {
      const coinsStr = await AsyncStorage.getItem(COINS_STORAGE_KEY);
      const currentCoins = coinsStr ? parseInt(coinsStr, 10) : 50;
      const newCoins = currentCoins + amount;
      await AsyncStorage.setItem(COINS_STORAGE_KEY, newCoins.toString());
      console.log(`💰 Added ${amount} coins for correct prediction! Total: ${newCoins}`);
    } catch (error) {
      console.error('Error adding coins to balance:', error);
    }
  }

  /**
   * Delete a prediction
   */
  async deletePrediction(matchId: string): Promise<void> {
    try {
      const predictions = await this.getAllPredictions();
      const filtered = predictions.filter(p => p.matchId !== matchId);
      await AsyncStorage.setItem(PREDICTIONS_KEY, JSON.stringify(filtered));
      await this.updateUserStats();
    } catch (error) {
      console.error('Error deleting prediction:', error);
    }
  }

  /**
   * Clear all predictions
   */
  async clearAllPredictions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREDICTIONS_KEY);
      await this.updateUserStats();
    } catch (error) {
      console.error('Error clearing predictions:', error);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const data = await AsyncStorage.getItem(USER_STATS_KEY);
      if (data) {
        return JSON.parse(data);
      }

      // Return default stats
      return {
        totalPredictions: 0,
        correctPredictions: 0,
        incorrectPredictions: 0,
        pendingPredictions: 0,
        totalPoints: 0,
        accuracy: 0,
        streak: 0,
        bestStreak: 0,
        level: 1,
        rank: 0,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalPredictions: 0,
        correctPredictions: 0,
        incorrectPredictions: 0,
        pendingPredictions: 0,
        totalPoints: 0,
        accuracy: 0,
        streak: 0,
        bestStreak: 0,
        level: 1,
        rank: 0,
      };
    }
  }

  /**
   * Update user statistics
   */
  private async updateUserStats(): Promise<void> {
    try {
      const predictions = await this.getAllPredictions();
      
      const totalPredictions = predictions.length;
      const correctPredictions = predictions.filter(p => p.status === 'correct').length;
      const incorrectPredictions = predictions.filter(p => p.status === 'incorrect').length;
      const pendingPredictions = predictions.filter(p => p.status === 'pending').length;
      const totalPoints = predictions.reduce((sum, p) => sum + (p.points || 0), 0);
      const accuracy = totalPredictions > 0 
        ? Math.round((correctPredictions / (correctPredictions + incorrectPredictions)) * 100) || 0
        : 0;

      // Calculate streak
      const sortedPredictions = predictions
        .filter(p => p.status !== 'pending')
        .sort((a, b) => b.timestamp - a.timestamp);

      let streak = 0;
      for (const pred of sortedPredictions) {
        if (pred.status === 'correct') {
          streak++;
        } else {
          break;
        }
      }

      // Calculate best streak
      let currentStreak = 0;
      let bestStreak = 0;
      for (const pred of sortedPredictions) {
        if (pred.status === 'correct') {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      // Calculate level (every 50 coins = 1 level)
      const level = Math.floor(totalPoints / 50) + 1;

      const stats: UserStats = {
        totalPredictions,
        correctPredictions,
        incorrectPredictions,
        pendingPredictions,
        totalPoints,
        accuracy,
        streak,
        bestStreak,
        level,
        rank: 0, // Would need backend for real ranking
      };

      await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  /**
   * Get predictions by status
   */
  async getPredictionsByStatus(status: 'pending' | 'correct' | 'incorrect'): Promise<StoredPrediction[]> {
    try {
      const predictions = await this.getAllPredictions();
      return predictions.filter(p => p.status === status);
    } catch (error) {
      console.error('Error getting predictions by status:', error);
      return [];
    }
  }
}

export default new PredictionStorage();
