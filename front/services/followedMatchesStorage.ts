/**
 * Storage service for followed matches
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FOLLOWED_MATCHES_KEY = '@followed_matches';

export interface FollowedMatch {
  matchId: string;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  date: string;
  time: string;
  timestamp: number;
  notificationScheduled: boolean;
}

class FollowedMatchesStorage {
  /**
   * Follow a match
   */
  async followMatch(match: FollowedMatch): Promise<void> {
    try {
      const followed = await this.getAllFollowedMatches();
      
      // Check if already followed
      const exists = followed.some(m => m.matchId === match.matchId);
      if (exists) {
        return;
      }

      followed.push(match);
      await AsyncStorage.setItem(FOLLOWED_MATCHES_KEY, JSON.stringify(followed));
    } catch (error) {
      console.error('Error following match:', error);
      throw error;
    }
  }

  /**
   * Unfollow a match
   */
  async unfollowMatch(matchId: string): Promise<void> {
    try {
      const followed = await this.getAllFollowedMatches();
      const filtered = followed.filter(m => m.matchId !== matchId);
      await AsyncStorage.setItem(FOLLOWED_MATCHES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error unfollowing match:', error);
      throw error;
    }
  }

  /**
   * Check if match is followed
   */
  async isMatchFollowed(matchId: string): Promise<boolean> {
    try {
      const followed = await this.getAllFollowedMatches();
      return followed.some(m => m.matchId === matchId);
    } catch (error) {
      console.error('Error checking if match is followed:', error);
      return false;
    }
  }

  /**
   * Get all followed matches
   */
  async getAllFollowedMatches(): Promise<FollowedMatch[]> {
    try {
      const data = await AsyncStorage.getItem(FOLLOWED_MATCHES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting followed matches:', error);
      return [];
    }
  }

  /**
   * Get upcoming followed matches
   */
  async getUpcomingFollowedMatches(): Promise<FollowedMatch[]> {
    try {
      const followed = await this.getAllFollowedMatches();
      const now = Date.now();
      
      return followed.filter(match => {
        const matchTime = new Date(match.date + ' ' + match.time).getTime();
        return matchTime > now;
      });
    } catch (error) {
      console.error('Error getting upcoming followed matches:', error);
      return [];
    }
  }

  /**
   * Clear all followed matches
   */
  async clearAllFollowedMatches(): Promise<void> {
    try {
      await AsyncStorage.removeItem(FOLLOWED_MATCHES_KEY);
    } catch (error) {
      console.error('Error clearing followed matches:', error);
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(matchId: string, scheduled: boolean): Promise<void> {
    try {
      const followed = await this.getAllFollowedMatches();
      const match = followed.find(m => m.matchId === matchId);
      
      if (match) {
        match.notificationScheduled = scheduled;
        await AsyncStorage.setItem(FOLLOWED_MATCHES_KEY, JSON.stringify(followed));
      }
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }
}

export default new FollowedMatchesStorage();
