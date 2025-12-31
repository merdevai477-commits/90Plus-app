import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useAuth, useUser } from '@clerk/clerk-expo';
import Constants from 'expo-constants';

import {
  HomeHeader,
  WelcomeSection,
  MatchList,
  VideoList,
  PlayerList,
  TeamPitch,
} from '../../components/Home';
import AdvancedSearchBar, { SearchResult } from '../../components/Home/AdvancedSearchBar';
import LuckyWheelModal from '../../components/common/LuckyWheelModal';
// Username is now auto-set from email, no modal needed
import { useHomeStore } from '../../src/store/home.store';
import { COLORS } from '../../components/reels/constants';
import { useHapticFeedback } from '../../components/leagues/HapticFeedback';
import { useMatchEventsMonitor } from '../../src/hooks/useMatchEventsMonitor';
import { globalState } from '../../globalState';
import { logger } from '../../utils/logger';
import { useTranslation } from '../../src/i18n';
import { getApiUrl } from '../../config/api.config';
import { getDailyQuizStatus, DailyQuizStatus } from '../../services/quizApi';

const API_URL = getApiUrl();

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptic = useHapticFeedback();
  const { t } = useTranslation();
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [luckyWheelVisible, setLuckyWheelVisible] = useState(false);
  const [spinWheelAvailable, setSpinWheelAvailable] = useState(true);
  const [nextSpinTime, setNextSpinTime] = useState<Date | undefined>(undefined);
  const [dailyQuizStatus, setDailyQuizStatus] = useState<DailyQuizStatus | null>(null);

  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // جلب حالة عجلة الحظ
  const fetchSpinWheelStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/daily-spin/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.status === 'SUCCESS') {
        setSpinWheelAvailable(data.data.canSpin);
        if (!data.data.canSpin && data.data.timeRemaining) {
          // حساب وقت الـ spin القادم
          const now = new Date();
          const nextTime = new Date(now.getTime() +
            (data.data.timeRemaining.hours * 60 * 60 * 1000) +
            (data.data.timeRemaining.minutes * 60 * 1000));
          setNextSpinTime(nextTime);
        } else {
          setNextSpinTime(undefined);
        }
      }
    } catch (error) {
      logger.error('Error fetching spin status:', error);
    }
  }, [getToken]);

  // جلب حالة الكويز اليومي
  const fetchDailyQuizStatus = useCallback(async () => {
    try {
      if (!getToken) return;
      const status = await getDailyQuizStatus(getToken);
      setDailyQuizStatus(status);
    } catch (error) {
      logger.error('Error fetching daily quiz status:', error);
    }
  }, [getToken]);

  const {
    userMode,
    matches,
    videos,
    players,
    teamOfMonth,
    fetchHomeData,
    fetchRankingsData,
    setUserMode,
    toggleFavorite,
  } = useHomeStore();

  // Set username automatically from email (no popup needed)
  useEffect(() => {
    if (isSignedIn && user) {
      // Get username from email
      const email = user.primaryEmailAddress?.emailAddress || '';
      const emailUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

      // Set current username for display
      const displayUsername = globalState.userProfile?.username || emailUsername;
      setCurrentUsername(displayUsername);

      // Set basic profile info from Clerk (auto-set username from email)
      // Only set if globalState.userProfile is null AND session matches
      // Prefer backend sync over Clerk-only data
      if (!globalState.userProfile || globalState.userProfile.id !== user.id) {
        // Verify session matches before setting
        if (globalState.userProfile && globalState.userProfile.id !== user.id) {
          // Session changed - clear old profile first
          globalState.setUserProfile(null);
        }
        
        // Only set if profile is null (backend sync should set it, this is fallback)
        if (!globalState.userProfile) {
          globalState.username = emailUsername;
          globalState.setUserProfile({
            id: user.id,
            username: emailUsername,
            displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || emailUsername,
            avatar: user.imageUrl || undefined,
            bio: undefined,
            stats: {
              views: 0, likes: 0, questionsSolved: 0, rating: 0, posts: 0,
              predictions: 0, interactions: 0, level: 1, followers: 0, following: 0,
              monthlyViews: 0, yearlyViews: 0, engagementRate: 0, contentQuality: 0,
            },
            videos: [], badges: [], achievements: [],
            socialStats: { followers: [], following: [] },
            notifications: [],
            isOwner: true, isVerified: false, isAppOwner: false,
          });
        }
      }
    }
  }, [isSignedIn, user]);

  // 🔔 Monitor favorited matches for live events
  useMatchEventsMonitor();

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Removed console.log for production
      
      const loadData = async () => {
        const token = await getToken();
        // ✅ FIX: Load data in parallel for faster loading
        await Promise.all([
          fetchHomeData(token),
          fetchRankingsData(token),
          fetchSpinWheelStatus(),
          fetchDailyQuizStatus(),
        ]);
      };
      
      loadData();

      // Update username from globalState (in case it changed in Profile)
      // Priority: globalState.userProfile.username > globalState.username > email-based username
      const email = user?.primaryEmailAddress?.emailAddress || '';
      const emailUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      const displayUsername = globalState.userProfile?.username 
        || globalState.username 
        || emailUsername;
      
      if (displayUsername) {
        setCurrentUsername(displayUsername);
      }

      // Sync userMode with globalState
      const shouldBeUser = globalState.userType !== 'guest';
      if (shouldBeUser && userMode !== 'user') {
        setUserMode('user');
      } else if (!shouldBeUser && userMode !== 'guest') {
        setUserMode('guest');
      }
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const token = await getToken();
    await Promise.all([
      fetchHomeData(token),
      fetchRankingsData(token),
    ]);
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
    logger.log('Search result:', result);
  };

  const handleViewAllMatches = () => {
    router.push('/(tabs)/leagues');
  };

  const handleMatchPress = (matchId: string) => {
    haptic.selection();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

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
    const token = await getToken();
    await toggleFavorite(matchId, token);
  };

  // Get top 3 matches for display - ✅ PERFORMANCE: useMemo to prevent recalculation
  const displayMatches = useMemo(() => matches.slice(0, 3), [matches]);

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
          paddingTop: insets.top + 80,
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
          onRegisterPress={() => router.push('/signup')}
          onLoginPress={() => router.push('/auth')}
          onProfilePress={() => router.push('/(tabs)/profile')}
          onSpinWheelPress={() => setLuckyWheelVisible(true)}
          onPredictionsPress={() => router.push({ pathname: '/(tabs)/leagues', params: { tab: 'predictions' } })}
          onQuizPress={() => router.push('/(tabs)/quiz')}
          onRankPress={() => router.push('/(tabs)/rank')}
          username={currentUsername}
          predictionsCount={5}
          streakDays={globalState.userProfile?.stats?.predictions || 0}
          userRank={globalState.userProfile?.stats?.level || 0}
          spinWheelAvailable={spinWheelAvailable}
          nextSpinTime={nextSpinTime}
          loginStreak={(globalState.userProfile as any)?.consecutiveLoginDays || 0}
          dailyQuizStatus={dailyQuizStatus}
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
          onPlayerPress={(player) => {
            // ✅ Navigate to user profile by username
            if (player.username) {
              router.push({
                pathname: '/user/[username]',
                params: { username: player.username }
              });
            }
          }}
          onViewAllPress={() => router.push('/rank')}
        />

        <TeamPitch
          players={teamOfMonth}
          onPlayerPress={(player) => {
            // ✅ Navigate to user profile by username
            if (player.username) {
              router.push({
                pathname: '/user/[username]',
                params: { username: player.username }
              });
            }
          }}
        />

      </ScrollView>

      <AdvancedSearchBar
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onResultSelect={handleSearchResult}
      />

      {/* Lucky Wheel Modal */}
      <LuckyWheelModal
        visible={luckyWheelVisible}
        onClose={() => {
          setLuckyWheelVisible(false);
          fetchSpinWheelStatus(); // تحديث الحالة بعد الإغلاق
        }}
        onCoinsWon={(coins, newBalance) => {
          logger.log(`Won ${coins} coins! New balance: ${newBalance}`);
          fetchSpinWheelStatus(); // تحديث الحالة بعد الفوز
        }}
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