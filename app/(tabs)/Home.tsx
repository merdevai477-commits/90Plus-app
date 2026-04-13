import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ScrollView,
  View,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';

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
import { useHomeStore } from '../../src/store/home.store';
import { Colors as DesignColors, Spacing } from '../../src/designSystem/designSystem';
import { useHapticFeedback } from '../../components/leagues/HapticFeedback';
import { useMatchEventsMonitor } from '../../src/hooks/useMatchEventsMonitor';
import { globalState } from '../../globalState';
import { logger } from '../../utils/logger';
import { getApiUrl } from '../../config/api.config';
import { getDailyQuizStatus, DailyQuizStatus } from '../../services/quizApi';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
import { ProfileCompletionService } from '../../services/profileCompletion.service';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import { AuthService } from '../../src/services/authService';

const API_URL = getApiUrl();

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptic = useHapticFeedback();
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loginStreak, setLoginStreak] = useState<number>(0);
  const [remainingPredictions, setRemainingPredictions] = useState<number>(5);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [luckyWheelVisible, setLuckyWheelVisible] = useState(false);
  const isLoadingRef = useRef(false);
  const [spinWheelAvailable, setSpinWheelAvailable] = useState(true);
  const [nextSpinTime, setNextSpinTime] = useState<Date | undefined>(undefined);
  const [dailyQuizStatus, setDailyQuizStatus] = useState<DailyQuizStatus | null>(null);

  // Open lucky wheel from push notification deep link
  const params = useLocalSearchParams<{ openLuckyWheel?: string }>();
  const openLuckyWheelHandledRef = useRef(false);
  useEffect(() => {
    if (params.openLuckyWheel === 'true' && !openLuckyWheelHandledRef.current) {
      openLuckyWheelHandledRef.current = true;
      setLuckyWheelVisible(true);
      // Clear param to prevent re-opening on back navigation
      router.setParams({ openLuckyWheel: undefined });
    }
  }, [params.openLuckyWheel]);

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

  // جلب رتبة المستخدم من الباك إند
  const fetchUserRank = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token || !isSignedIn) return;

      const response = await fetch(`${API_URL}/reels/rankings/user-rank`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'SUCCESS' && data.data) {
          // الحصول على أول رتبة متاحة (views, shares, predictions, comments)
          const rank = data.data.views || data.data.shares || data.data.predictions || data.data.comments || null;
          setUserRank(rank);
        }
      }
    } catch (error) {
      logger.error('Error fetching user rank:', error);
      setUserRank(null);
    }
  }, [getToken, isSignedIn]);

  // جلب بيانات المستخدم من الباك إند (username, avatar, login streak)
  const fetchUserProfile = useCallback(async () => {
    const applyClerkHomeFallback = () => {
      if (!user) return;
      const emailUsername =
        user.primaryEmailAddress?.emailAddress?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || '';
      const display =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        globalState.userProfile?.displayName ||
        globalState.userProfile?.username ||
        emailUsername;
      if (display) setCurrentUsername(display);
      setUserAvatar(user.imageUrl || user.externalAccounts?.[0]?.imageUrl || null);
    };

    try {
      const token = await getToken();
      if (!token || !isSignedIn) return;

      try {
        const userData = await AuthService.syncUserWithBackend(token);
        if (userData.username) {
          setCurrentUsername(userData.username);
          if (globalState.userProfile) {
            globalState.userProfile.username = userData.username;
          }
        }
        if (userData.avatar) {
          setUserAvatar(userData.avatar);
          if (globalState.userProfile) {
            globalState.userProfile.avatar = userData.avatar;
          }
        }
        if (userData.consecutiveLoginDays !== undefined) {
          setLoginStreak(userData.consecutiveLoginDays || 0);
        }
      } catch {
        applyClerkHomeFallback();
      }
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      applyClerkHomeFallback();
    }
  }, [getToken, isSignedIn, user]);

  // ✅ Preload profile data in background for instant profile screen loading
  const preloadProfileData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token || !isSignedIn) return;

      // Preload profile completion status (for tasks badge)
      ProfileCompletionService.getCompletionStatus(token)
        .then(status => {
          if (status) {
            // Cache it for instant access when user opens profile
            cacheService.set(CACHE_KEYS.PROFILE_COMPLETION, status, 5 * 60 * 1000);
            logger.info('✅ Profile completion preloaded in background');
          }
        })
        .catch(err => {
          // Silent fail - not critical
          logger.debug('Profile completion preload failed (non-critical):', err.message);
        });

      // Preload full user profile data (for profile screen)
      fetch(`${API_URL}/clerk/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(async response => {
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'SUCCESS' && data.data?.user) {
              // Cache full profile data
              await cacheService.set(CACHE_KEYS.PROFILE_DATA, data.data.user, 5 * 60 * 1000);
              logger.info('✅ Full profile data preloaded in background');
            }
          }
        })
        .catch(err => {
          // Silent fail - not critical
          logger.debug('Profile data preload failed (non-critical):', err.message);
        });

    } catch (error) {
      // Silent fail - preloading is not critical
      logger.debug('Profile preload error (non-critical):', error);
    }
  }, [getToken, isSignedIn]);

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
    loadingRankings,
  } = useHomeStore();

  const { remainingPredictions: predictionsRemaining, fetchUserData: fetchPredictionsData } = usePredictionsStore();

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

  // تحديث remaining predictions عند تغيير predictionsRemaining
  useEffect(() => {
    setRemainingPredictions(predictionsRemaining);
  }, [predictionsRemaining]);

  // Store functions in refs to prevent re-renders
  const fetchUserProfileRef = useRef(fetchUserProfile);
  const fetchSpinWheelStatusRef = useRef(fetchSpinWheelStatus);
  const fetchDailyQuizStatusRef = useRef(fetchDailyQuizStatus);
  const fetchUserRankRef = useRef(fetchUserRank);
  const fetchPredictionsDataRef = useRef(fetchPredictionsData);
  const fetchHomeDataRef = useRef(fetchHomeData);
  const fetchRankingsDataRef = useRef(fetchRankingsData);
  const preloadProfileDataRef = useRef(preloadProfileData);
  const getTokenRef = useRef(getToken);
  const setUserModeRef = useRef(setUserMode);
  const lastLoadTimeRef = useRef(0);
  const LOAD_THROTTLE_MS = 2500; // Faster revisits while avoiding hammering the API
  
  // Update refs when functions change
  useEffect(() => {
    fetchUserProfileRef.current = fetchUserProfile;
    fetchSpinWheelStatusRef.current = fetchSpinWheelStatus;
    fetchDailyQuizStatusRef.current = fetchDailyQuizStatus;
    fetchUserRankRef.current = fetchUserRank;
    fetchPredictionsDataRef.current = fetchPredictionsData;
    fetchHomeDataRef.current = fetchHomeData;
    fetchRankingsDataRef.current = fetchRankingsData;
    preloadProfileDataRef.current = preloadProfileData;
    getTokenRef.current = getToken;
    setUserModeRef.current = setUserMode;
  }, [fetchUserProfile, fetchSpinWheelStatus, fetchDailyQuizStatus, fetchUserRank, fetchPredictionsData, fetchHomeData, fetchRankingsData, preloadProfileData, getToken, setUserMode]);

  // Before paint: signed-in users must not stay on store "guest" (avoids UI flash)
  useLayoutEffect(() => {
    if (isSignedIn) {
      setUserMode('user');
    }
  }, [isSignedIn, setUserMode]);

  // Sync userMode: normal accounts keep userType "guest" in globalState — still signed in via Clerk
  useEffect(() => {
    const shouldBeUser = Boolean(isSignedIn) || globalState.userType !== 'guest';
    if (shouldBeUser && userMode !== 'user') {
      setUserMode('user');
    } else if (!shouldBeUser && userMode !== 'guest') {
      setUserMode('guest');
    }
  }, [userMode, setUserMode, isSignedIn]);

  // Auto-refresh when screen comes into focus - FIXED: No infinite loop
  useFocusEffect(
    useCallback(() => {
      // Throttle: Don't load if we just loaded recently
      const now = Date.now();
      if (now - lastLoadTimeRef.current < LOAD_THROTTLE_MS) {
        return;
      }
      
      // تجنب التحميل المتكرر
      if (isLoadingRef.current) return;
      
      isLoadingRef.current = true;
      lastLoadTimeRef.current = now;
      let isMounted = true;
      let abortController = new AbortController();
      
      const loadData = async () => {
        if (!isMounted || abortController.signal.aborted) return;
        
        try {
          const token = await getTokenRef.current();
          if (!token || abortController.signal.aborted) {
            if (isMounted) isLoadingRef.current = false;
            return;
          }
          
          // ✅ Load critical data first (user profile, home data)
          // Then load secondary data in parallel
          const criticalPromises = [
            fetchHomeDataRef.current(token).catch((err: any) => {
              logger.error('Error fetching home data:', err);
              return null;
            }),
            fetchUserProfileRef.current().catch((err: any) => {
              logger.error('Error fetching user profile:', err);
              return null;
            }),
          ];
          
          // ✅ Load secondary data in parallel (non-blocking)
          const secondaryPromises = [
            fetchRankingsDataRef.current(token).catch((err: any) => {
              logger.error('Error fetching rankings:', err);
              return null;
            }),
            fetchSpinWheelStatusRef.current().catch((err: any) => {
              logger.error('Error fetching spin status:', err);
              return null;
            }),
            fetchDailyQuizStatusRef.current().catch((err: any) => {
              logger.error('Error fetching quiz status:', err);
              return null;
            }),
            fetchPredictionsDataRef.current(token).catch((err: any) => {
              logger.error('Error fetching predictions:', err);
              return null;
            }),
            fetchUserRankRef.current().catch((err: any) => {
              logger.error('Error fetching user rank:', err);
              return null;
            }),
          ];
          
          // ✅ Load critical data first, then secondary
          await Promise.all(criticalPromises);
          
          // ✅ Load secondary data without blocking
          Promise.all(secondaryPromises).catch(() => {
            // Silent fail for secondary data
          });
          
          // ✅ Preload profile data in background for instant profile screen access
          // This runs completely in background without blocking anything
          preloadProfileDataRef.current().catch(() => {
            // Silent fail - preloading is not critical
          });
          
        } catch (error) {
          logger.error('Error loading home screen data:', error);
        } finally {
          if (isMounted && !abortController.signal.aborted) {
            isLoadingRef.current = false;
          }
        }
      };
      
      loadData();

      return () => {
        isMounted = false;
        abortController.abort();
        isLoadingRef.current = false;
      };
    }, []) // Empty dependency array - uses refs only
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
    const token = await getToken();
      // ✅ Refresh critical data only for pull-to-refresh (faster)
    await Promise.all([
        fetchHomeDataRef.current(token).catch((err: any) => {
          logger.error('Refresh error:', err);
          return null;
        }),
        fetchRankingsDataRef.current(token).catch((err: any) => {
          logger.error('Refresh error:', err);
          return null;
        }),
        fetchUserProfileRef.current().catch((err: any) => {
          logger.error('Refresh error:', err);
          return null;
        }),
    ]);
    } catch (error) {
      logger.error('Error refreshing home screen:', error);
    } finally {
    setRefreshing(false);
    }
  };

  const handleSettingsPress = useCallback(() => {
    haptic.selection();
    router.push('/(tabs)/settings');
  }, [router, haptic]);

  const handleSearchPress = useCallback(() => {
    haptic.selection();
    setSearchVisible(true);
  }, [haptic]);

  const handleNotificationPress = useCallback(() => {
    haptic.selection();
    router.push('/notifications');
  }, [router, haptic]);

  const handleSearchResult = (_result: SearchResult) => {
    setSearchVisible(false);
  };

  const handleViewAllMatches = () => {
    router.push('/(tabs)/leagues');
  };

  const handleMatchPress = (matchId: string) => {
    haptic.selection();
    const match = matches.find((m: any) => m.id === matchId);
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
        colors={[DesignColors.background.default, DesignColors.surface.default, DesignColors.surface.bright, DesignColors.background.default]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.3, 0.7, 1]}
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
          paddingBottom: Spacing['3xl'] + Spacing.xl
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={DesignColors.primary[500]}
            colors={[DesignColors.primary[500]]}
            progressViewOffset={insets.top + 80}
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
          userAvatar={userAvatar}
          predictionsCount={remainingPredictions}
          streakDays={globalState.userProfile?.stats?.predictions || 0}
          userRank={userRank || 0}
          spinWheelAvailable={spinWheelAvailable}
          nextSpinTime={nextSpinTime}
          loginStreak={loginStreak}
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
          onVideoPress={() => router.push('/reels')}
          onViewAllPress={() => router.push('/reels')}
          isLoading={loadingRankings}
        />

        <PlayerList
          players={players}
          onPlayerPress={(player) => {
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
    backgroundColor: DesignColors.background.default,
  },
  scrollView: {
    flex: 1,
  },
});