/**
 * ⚠️ EXAMPLE FILE - DEVELOPMENT ONLY
 * This file contains example/demo data for development purposes only.
 * Team names and logos in this file are NOT used in production.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  SearchBar,
  MatchCard,
  PredictionSystem,
  useHapticFeedback,
  Match,
  Prediction,
  UserStats
} from './index';

// Example usage of all components
const LeaguesExample = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const haptic = useHapticFeedback();

  // Example match data
  const exampleMatch: Match = {
    id: '1',
    homeTeam: 'ريال مدريد',
    awayTeam: 'برشلونة',
    homeScore: 2,
    awayScore: 1,
    homeLogo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
    awayLogo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    date: 'اليوم',
    time: '22:00',
    status: 'finished',
    league: 'الدوري الإسباني',
    leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/9/9f/LaLiga_logo.svg',
    venue: 'سانتياغو برنابيو',
    odds: { home: 2.1, draw: 3.2, away: 2.8 },
    prediction: { 
      type: 'win', 
      homeScore: 2, 
      awayScore: 2, 
      points: 25, 
      isCorrect: true 
    }
  };

  // Example user stats
  const exampleStats: UserStats = {
    totalPredictions: 42,
    correctPredictions: 35,
    accuracy: 83,
    totalPoints: 1250,
    streak: 7,
    bestStreak: 12,
    rank: 15,
    level: 8
  };

  // Example predictions
  const examplePredictions: Prediction[] = [
    {
      id: '1',
      matchId: '1',
      userId: 'user1',
      type: 'win',
      homeScore: 2,
      awayScore: 1,
      points: 25,
      isCorrect: true,
      submittedAt: new Date('2024-01-15'),
      matchResult: { homeScore: 2, awayScore: 1 }
    }
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    haptic.search();
  };

  const handleFilterPress = () => {
    setShowFilters(true);
    haptic.filter();
  };

  const handlePredictionSubmit = (matchId: string, prediction: any) => {
    haptic.predictionSubmit();
    console.log('Prediction submitted:', { matchId, prediction });
  };

  const handlePredictionSystemSubmit = (prediction: any) => {
    haptic.predictionSubmit();
    console.log('Prediction system submit:', prediction);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Search Bar Example */}
      <SearchBar
        onSearch={handleSearch}
        onFilterPress={handleFilterPress}
        placeholder="ابحث عن المباريات..."
      />

      {/* Match Card Example */}
      <MatchCard
        match={exampleMatch}
        onPredictionSubmit={handlePredictionSubmit}
        showPrediction={true}
        userPredictions={{}}
      />

      {/* Prediction System Example */}
      <PredictionSystem
        predictions={examplePredictions}
        userStats={exampleStats}
        onPredictionSubmit={handlePredictionSystemSubmit}
        onPredictionUpdate={() => {}}
      />

      {/* Haptic Feedback Examples */}
      <View style={styles.hapticExamples}>
        <View style={styles.hapticButton} onTouchStart={() => haptic.light()}>
          <Text>Light Haptic</Text>
        </View>
        <View style={styles.hapticButton} onTouchStart={() => haptic.medium()}>
          <Text>Medium Haptic</Text>
        </View>
        <View style={styles.hapticButton} onTouchStart={() => haptic.heavy()}>
          <Text>Heavy Haptic</Text>
        </View>
        <View style={styles.hapticButton} onTouchStart={() => haptic.success()}>
          <Text>Success Haptic</Text>
        </View>
        <View style={styles.hapticButton} onTouchStart={() => haptic.celebration()}>
          <Text>Celebration Haptic</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  hapticExamples: {
    marginTop: 20,
    gap: 10,
  },
  hapticButton: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
});

export default LeaguesExample;
