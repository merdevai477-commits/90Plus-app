import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ScrollView,
  View,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HomeHeader,
  WelcomeSection,
  MatchList,
  VideoList,
  PlayerList,
  TeamPitch,
} from '../../components/Home';
import AdvancedSearchBar, { SearchResult } from '../../components/Home/AdvancedSearchBar';
import { useHomeStore } from '../../src/store/home.store';
import { COLORS } from '../../components/reels/constants';
import { useHapticFeedback } from '../../components/leagues/HapticFeedback';
import { useMatchEventsMonitor } from '../../src/hooks/useMatchEventsMonitor';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptic = useHapticFeedback();
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    userMode,
    matches,
    videos,
    players,
    teamOfMonth,
    fetchHomeData,
    setUserMode,
    toggleFavorite,
  } = useHomeStore();

  // 🔔 Monitor favorited matches for live events
  useMatchEventsMonitor();



  // Auto-refresh when screen comes into focus (user returns from leagues)
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Home screen focused - refreshing data...');
      fetchHomeData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeData();
    setRefreshing(false);
  };

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  const handleSearchPress = () => {
    setSearchVisible(true);
  };

  const handleNotificationPress = () => {
    router.push('/notifications');
  };

  const handleSearchResult = (result: SearchResult) => {
    setSearchVisible(false);
    // Implement navigation based on result
    console.log('Search result:', result);
  };

  const handleViewAllMatches = () => {
    router.push('/(tabs)/leagues');
  };

  const handleMatchPress = (matchId: string) => {
    haptic.selection();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Navigate to match details with proper parameters
    router.push({
      pathname: '/(tabs)/match-details',
      params: {
        fixtureId: String(match.fixtureId),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeLogo: match.homeLogo || '',
        awayLogo: match.awayLogo || '',
        homeScore: match.homeScore?.toString() || '',
        awayScore: match.awayScore?.toString() || '',
        league: match.league,
        leagueLogo: '',
        date: new Date().toISOString().split('T')[0],
        time: match.time,
        status: match.isLive ? 'live' : 'upcoming',
      },
    });
  };

  const handleFavoritePress = async (matchId: string) => {
    haptic.selection();
    await toggleFavorite(matchId);
  };

  // Get top 3 matches for display (they're already sorted with favorites first)
  const displayMatches = matches.slice(0, 3);

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[COLORS.deepBlack, '#0a1a0a', COLORS.deepBlack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <HomeHeader
        onSettingsPress={handleSettingsPress}
        onSearchPress={handleSearchPress}
        onNotificationPress={handleNotificationPress}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 80, // safe area top + header height + spacing
          paddingBottom: 100
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.neonGreen}
            colors={[COLORS.neonGreen]}
          />
        }
      >
        <WelcomeSection
          onRegisterPress={() => router.push('/auth')}
          onLoginPress={() => router.push('/auth')}
          onProfilePress={() => router.push('/profile')}
        />

        <MatchList
          matches={displayMatches}
          onMatchPress={handleMatchPress}
          onViewAllPress={handleViewAllMatches}
          onFavoritePress={handleFavoritePress}
        />

        <VideoList
          videos={videos}
          onVideoPress={(id) => router.push('/reels')}
          onViewAllPress={() => router.push('/reels')}
        />

        <PlayerList
          players={players}
          onPlayerPress={(id) => router.push('/profile')}
          onViewAllPress={() => router.push('/rank')}
        />

        <TeamPitch
          players={teamOfMonth}
          onPlayerPress={(id) => router.push('/profile')}
        />

      </ScrollView>

      <AdvancedSearchBar
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onResultSelect={handleSearchResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepBlack,
  },
  scrollView: {
    flex: 1,
  },
});