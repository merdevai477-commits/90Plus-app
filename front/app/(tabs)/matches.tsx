/**
 * Match Listing Screen - Enhanced
 * Performance optimized with faster loading and smooth scrolling
 */

import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  RefreshControl,
  FlatList,
  InteractionManager,
  ScrollView,
  Text,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { FlatListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useSharedValue as useSharedValueAlias,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
// ✅ استبدال Network polling بـ NetInfo event listeners
import NetInfo from '@react-native-community/netinfo';

// Components
import MatchTopBar from '../../components/Matches/MatchTopBar';
import QuickIndicators from '../../components/Matches/QuickIndicators';
import MatchTabs, { MatchTabType } from '../../components/Matches/MatchTabs';
import LeagueSection from '../../components/Matches/LeagueSection';
import MatchCardSkeleton from '../../components/Matches/MatchCardSkeleton';
import EmptyState from '../../components/Matches/EmptyState';
import GradientMatchCard from '../../components/league-center/GradientMatchCard';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';

// Hooks & Data
import { useMatchesData } from '../../hooks/useMatchesData';
import { useFavoriteLeagues } from '../../hooks/useFavoriteLeagues';
import { useFavoriteMatches } from '../../hooks/useFavoriteMatches';
import { Match } from '../../components/league-center/matchCardUtils';
import { logger } from '../../utils/logger';
import ApiFootballService, { MAJOR_LEAGUES } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n/useTranslation';

// Lazy-load heavy tab sections to improve initial load
const LazyPredictionsSection = React.lazy(() => import('../../components/Matches/PredictionsSection'));

// Define GroupedMatches type
type GroupedMatches = {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
};

type FlatListItem = 
  | { type: 'header'; leagueId: number; leagueName: string; leagueLogo?: string; matchCount: number; isExpanded: boolean }
  | { type: 'match'; match: Match; gradientIndex: number };

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as unknown as React.ComponentType<any>
) as unknown as React.ComponentType<any>;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/**
 * Match Listing Screen
 * Optimized for performance
 */
const MatchesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ matchId?: string; tab?: MatchTabType }>();
  // @ts-ignore
  const flatListRef = useRef<any>(null);
  const highlightedMatchId = useSharedValue<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<MatchTabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLeagueIds, setExpandedLeagueIds] = useState<Set<number>>(new Set());

  // Incremental rendering for long match lists (infinite scroll over leagues)
  const INITIAL_LEAGUES_TO_RENDER = 8;
  const LEAGUES_PER_PAGE = 6;
  const [visibleLeaguesCount, setVisibleLeaguesCount] = useState(INITIAL_LEAGUES_TO_RENDER);

  // Scroll position for sticky header
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Data hook
  const {
    matches,
    groupedMatches,
    loading,
    error,
    refetch,
    matchesCount,
    leaguesCount,
  } = useMatchesData(selectedDate);

  // Favorite leagues hook - convert to Set for O(1) lookup
  const { favoriteLeagues } = useFavoriteLeagues();
  const favoriteLeaguesSet = useMemo(() => new Set(favoriteLeagues), [favoriteLeagues]);

  // Favorite matches hook
  const { favoriteMatchIds, isFavorite, toggleFavorite } = useFavoriteMatches();
  const favoriteMatchesSet = useMemo(() => new Set(favoriteMatchIds), [favoriteMatchIds]);

  // Create matches Map for O(1) lookup
  const matchesMap = useMemo(() => {
    const map = new Map<string, Match>();
    matches.forEach((match) => {
      map.set(match.id, match);
    });
    return map;
  }, [matches]);

  // Scroll to specific match from push notification deep link
  useEffect(() => {
    if (!params.matchId || !groupedMatches.length || !flatListRef.current) return;

    const targetMatchId = String(params.matchId);
    highlightedMatchId.value = targetMatchId;

    // Find which group contains this match
    const groupIndex = groupedMatches.findIndex(group =>
      group.matches.some(m => String(m.id) === targetMatchId)
    );

    if (groupIndex >= 0) {
      InteractionManager.runAfterInteractions(() => {
        try {
          flatListRef.current?.scrollToIndex({ index: groupIndex, animated: true, viewPosition: 0.3 });
        } catch {
          flatListRef.current?.scrollToOffset({ offset: groupIndex * 200, animated: true });
        }
      });
    }

    // Clear highlight after 3 seconds
    const timer = setTimeout(() => {
      highlightedMatchId.value = '';
      router.setParams({ matchId: undefined });
    }, 3000);

    return () => clearTimeout(timer);
  }, [params.matchId, groupedMatches]);

  // ✅ Network status detection
  const isOnlineRef = useRef(true);
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? true;
      setIsOnline(online);
      isOnlineRef.current = online;
    });
    NetInfo.fetch().then(state => {
      const online = state.isConnected ?? true;
      setIsOnline(online);
      isOnlineRef.current = online;
    }).catch(() => {});
    return () => unsubscribe();
  }, []);





  // Filter matches by active tab - using Set for O(1) lookup
  const filteredMatches = useMemo(() => {
    let filtered = [...matches];

    switch (activeTab) {
      case 'live':
        filtered = filtered.filter((m) => m.status === 'live');
        break;
      case 'upcoming':
        filtered = filtered.filter(
          (m) => m.status === 'upcoming' || m.status === 'NS' || m.status === 'TBD'
        );
        break;
      case 'finished':
        filtered = filtered.filter((m) => m.status === 'finished');
        break;
      case 'favorites':
        filtered = filtered.filter((m) => {
          return favoriteMatchesSet.has(m.id);
        });
        break;
      case 'predictions':
        filtered = filtered.filter(
          (m) => m.status === 'upcoming' || m.status === 'NS' || m.status === 'TBD'
        );
        break;
      case 'all':
      default:
        break;
    }

    return filtered;
  }, [matches, activeTab, favoriteMatchesSet]);

  // Fix 11: filteredGroupedMatches filters from the already-grouped result (groupedMatches from hook)
  // instead of re-grouping filteredMatches from scratch — eliminates the double O(n) grouping.
  const filteredGroupedMatches = useMemo((): GroupedMatches[] => {
    // Determine which match IDs pass the active tab filter
    const allowedIds = new Set(filteredMatches.map(m => m.id));

    // Filter each league group to only include matches that pass the tab filter
    const groups: GroupedMatches[] = groupedMatches
      .map(group => ({
        ...group,
        matches: group.matches.filter(m => allowedIds.has(m.id)),
      }))
      .filter(group => group.matches.length > 0);

    // Major leagues IDs (Top 5)
    const majorLeaguesSet = new Set([
      MAJOR_LEAGUES.PREMIER_LEAGUE,
      MAJOR_LEAGUES.LA_LIGA,
      MAJOR_LEAGUES.BUNDESLIGA,
      MAJOR_LEAGUES.SERIE_A,
      MAJOR_LEAGUES.LIGUE_1,
    ]);

    // Sort: Major leagues first (in order), then favorites, then alphabetically
    groups.sort((a, b) => {
      const aIsMajor = majorLeaguesSet.has(a.leagueId);
      const bIsMajor = majorLeaguesSet.has(b.leagueId);
      
      if (aIsMajor && !bIsMajor) return -1;
      if (bIsMajor && !aIsMajor) return 1;
      
      if (aIsMajor && bIsMajor) {
        const majorOrder = [
          MAJOR_LEAGUES.PREMIER_LEAGUE,
          MAJOR_LEAGUES.LA_LIGA,
          MAJOR_LEAGUES.BUNDESLIGA,
          MAJOR_LEAGUES.SERIE_A,
          MAJOR_LEAGUES.LIGUE_1,
        ];
        const aIndex = majorOrder.indexOf(a.leagueId);
        const bIndex = majorOrder.indexOf(b.leagueId);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      }
      
      const aIsFavorite = favoriteLeaguesSet.has(a.leagueId);
      const bIsFavorite = favoriteLeaguesSet.has(b.leagueId);
      if (aIsFavorite && !bIsFavorite) return -1;
      if (bIsFavorite && !aIsFavorite) return 1;
      
      return a.leagueName.localeCompare(b.leagueName);
    });

    return groups;
  }, [groupedMatches, filteredMatches, favoriteLeaguesSet]);

  // Set default expanded leagues
  useEffect(() => {
    const initial = new Set<number>();
    const majors = new Set([
      MAJOR_LEAGUES.PREMIER_LEAGUE,
      MAJOR_LEAGUES.LA_LIGA,
      MAJOR_LEAGUES.BUNDESLIGA,
      MAJOR_LEAGUES.SERIE_A,
      MAJOR_LEAGUES.LIGUE_1,
      MAJOR_LEAGUES.CHAMPIONS_LEAGUE,
      MAJOR_LEAGUES.EGYPTIAN_PREMIER_LEAGUE,
      MAJOR_LEAGUES.SAUDI_PRO_LEAGUE
    ]);
    filteredGroupedMatches.forEach(g => {
      if (majors.has(g.leagueId)) {
        initial.add(g.leagueId);
      }
    });
    setExpandedLeagueIds(initial);
  }, [selectedDate, filteredGroupedMatches.length]);

  const toggleLeague = useCallback((leagueId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedLeagueIds(prev => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  }, []);

  // Reset incremental rendering when list basis changes
  useEffect(() => {
    setVisibleLeaguesCount(INITIAL_LEAGUES_TO_RENDER);
  }, [selectedDate, activeTab]);

  const paginatedGroupedMatches = useMemo(() => {
    return filteredGroupedMatches.slice(0, visibleLeaguesCount);
  }, [filteredGroupedMatches, visibleLeaguesCount]);

  const flattenedData = useMemo(() => {
    const flat: FlatListItem[] = [];
    
    paginatedGroupedMatches.forEach(group => {
      const isExpanded = expandedLeagueIds.has(group.leagueId);
      
      flat.push({
        type: 'header',
        leagueId: group.leagueId,
        leagueName: group.leagueName,
        leagueLogo: group.leagueLogo,
        matchCount: group.matches.length,
        isExpanded
      });
      
      if (isExpanded) {
        group.matches.forEach((match, index) => {
          flat.push({
            type: 'match',
            match,
            gradientIndex: index
          });
        });
      }
    });
    
    return flat;
  }, [paginatedGroupedMatches, expandedLeagueIds]);

  const hasMoreLeagues = filteredGroupedMatches.length > paginatedGroupedMatches.length;

  const loadMoreLeagues = useCallback(() => {
    if (!hasMoreLeagues) return;
    setVisibleLeaguesCount((prev) =>
      Math.min(prev + LEAGUES_PER_PAGE, filteredGroupedMatches.length)
    );
  }, [hasMoreLeagues, filteredGroupedMatches.length]);

  // Calculate filtered counts for indicators
  const filteredCounts = useMemo(() => ({
    matchesCount: filteredMatches.length,
    leaguesCount: filteredGroupedMatches.length,
  }), [filteredMatches, filteredGroupedMatches]);

  // Handle match press - using Map for O(1) lookup
  const handleMatchPress = useCallback(
    (matchId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const match = matchesMap.get(matchId);
      if (match && match.homeTeam && match.awayTeam) {
        router.push({
          pathname: '/(tabs)/match-details',
          params: {
            fixtureId: matchId,
            homeTeam: match.homeTeam.name || 'Home',
            awayTeam: match.awayTeam.name || 'Away',
            homeLogo: match.homeTeam.logo || '',
            awayLogo: match.awayTeam.logo || '',
            homeScore: match.score?.home?.toString() || '',
            awayScore: match.score?.away?.toString() || '',
            league: match.league?.name || '',
            leagueLogo: match.league?.logo || '',
            date: match.fixtureDate || '',
            time: match.time || '',
            status: match.status,
          },
        });
      }
    },
    [router, matchesMap]
  );

  // Handle refresh - optimized to skip if recently refreshed or offline
  const lastRefreshRef = useRef<number>(0);
  const handleRefresh = useCallback(async () => {
    if (!isOnlineRef.current) {
      setRefreshing(false);
      return;
    }
    const now = Date.now();
    if (now - lastRefreshRef.current < 3000) {
      setRefreshing(false);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    lastRefreshRef.current = now;
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleTabChange = useCallback((tab: MatchTabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  // Handle favorite press
  const handleFavoritePress = useCallback((match: Match) => {
    toggleFavorite(match);
  }, [toggleFavorite]);

  // Render flat items
  const renderItem = useCallback(({ item }: { item: FlatListItem }) => {
    if (item.type === 'header') {
      return (
        <LeagueSection
          leagueId={item.leagueId}
          leagueName={item.leagueName}
          leagueLogo={item.leagueLogo}
          matchCount={item.matchCount}
          isExpanded={item.isExpanded}
          onToggle={toggleLeague}
        />
      );
    }
    
    return (
      <View style={{ marginBottom: 12, paddingHorizontal: 4 }}>
        <GradientMatchCard
          match={item.match}
          gradientIndex={item.gradientIndex}
          onPress={() => handleMatchPress(item.match.id)}
          onFavoritePress={() => handleFavoritePress(item.match)}
          showFavorite={true}
          isFavorite={favoriteMatchIds.includes(item.match.id)}
        />
      </View>
    );
  }, [toggleLeague, handleMatchPress, handleFavoritePress, favoriteMatchIds]);

  // Key extractor
  const keyExtractor = useCallback((item: FlatListItem) => {
    return item.type === 'header' ? `header-${item.leagueId}` : `match-${item.match.id}`;
  }, []);

  // Loading state
  if (loading && !refreshing && matches.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={[MATCH_DETAILS_COLORS.background, MATCH_DETAILS_COLORS.background]}
          style={StyleSheet.absoluteFill}
        />
        <MatchTopBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          scrollY={scrollY}
        />
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 5 }).map((_, index) => (
            <MatchCardSkeleton key={index} index={index} />
          ))}
        </View>
      </View>
    );
  }

  // Error state with retry
  if (error && matches.length === 0) {
    const getErrorMessage = (errorMsg: string): { title: string; message: string; icon: keyof typeof Ionicons.glyphMap } => {
      const lowerError = errorMsg.toLowerCase();
      
      if (lowerError.includes('network') || lowerError.includes('fetch')) {
        return {
          title: t.matches.empty.errorLoadingMatches || 'Connection Error',
          message: 'Unable to connect to the server. Please check your internet connection.',
          icon: 'cloud-offline-outline'
        };
      }
      if (lowerError.includes('timeout')) {
        return {
          title: 'Request Timed Out',
          message: 'The server took too long to respond. Please try again.',
          icon: 'time-outline'
        };
      }
      if (lowerError.includes('500') || lowerError.includes('server')) {
        return {
          title: 'Service Unavailable',
          message: 'Our servers are currently experiencing high traffic. Please try again in a few moments.',
          icon: 'server-outline'
        };
      }
      if (lowerError.includes('api returned errors')) {
        return {
          title: 'Data Unavailable',
          message: 'Match data is currently unavailable. Please check back later.',
          icon: 'alert-circle-outline'
        };
      }
      return {
        title: t.matches.empty.errorLoadingMatches || 'Error Loading Matches',
        message: 'Something went wrong while loading matches.',
        icon: 'alert-circle-outline'
      };
    };

    const errorInfo = getErrorMessage(error);

    return (
      <View style={styles.container} accessibilityLabel="Matches screen error state">
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={[MATCH_DETAILS_COLORS.background, MATCH_DETAILS_COLORS.background]}
          style={StyleSheet.absoluteFill}
        />
        <MatchTopBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          scrollY={scrollY}
        />
        <EmptyState
          icon={errorInfo.icon}
          title={errorInfo.title}
          message={errorInfo.message}
          iconColor={MATCH_DETAILS_COLORS.error}
          onRetry={refetch}
          retryLabel={t.matches.empty.retry || 'Retry'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="Matches screen">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[MATCH_DETAILS_COLORS.background, MATCH_DETAILS_COLORS.background]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Network Status Indicator */}
      {!isOnline && (
        <View style={styles.networkIndicator} accessibilityLabel="No internet connection" accessibilityRole="alert">
          <Text style={styles.networkText}>
            {t.matches.networkOffline || 'No internet connection'}
          </Text>
        </View>
      )}

      {/* Top Bar */}
      <MatchTopBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        scrollY={scrollY}
      />

      {/* Quick Indicators - Hide for predictions tab */}
      {activeTab !== 'predictions' && (
        <QuickIndicators
          matchesCount={filteredCounts.matchesCount}
          leaguesCount={filteredCounts.leaguesCount}
        />
      )}

      {/* Tabs */}
      <MatchTabs 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />

      {/* Fix 6: Keep LazyPredictionsSection always mounted after first render.
          Use display:none instead of conditional rendering to prevent re-import delay on tab switch. */}
      <View style={{ display: activeTab === 'predictions' ? 'flex' : 'none', flex: activeTab === 'predictions' ? 1 : undefined }}>
        <AnimatedScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={MATCH_DETAILS_COLORS.accent}
              colors={[MATCH_DETAILS_COLORS.accent]}
              enabled={isOnline}
            />
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          accessibilityLabel="Predictions list"
        >
          <Suspense
            fallback={
              <View style={styles.skeletonContainer}>
                <ActivityIndicator size="large" color={MATCH_DETAILS_COLORS.accent} />
              </View>
            }
          >
            <LazyPredictionsSection
              matches={filteredMatches}
              onMatchPress={handleMatchPress}
            />
          </Suspense>
        </AnimatedScrollView>
      </View>

      {activeTab !== 'predictions' && filteredGroupedMatches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="calendar-outline"
            title={t.matches.empty.noMatches}
            message={t.matches.empty.tryDifferentDate}
          />
        </View>
      ) : activeTab !== 'predictions' ? (
        <View style={{ flex: 1, minHeight: 400 }}>
          <AnimatedFlashList
            ref={flatListRef}
          data={flattenedData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={(item: FlatListItem) => item.type}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={MATCH_DETAILS_COLORS.accent}
              colors={[MATCH_DETAILS_COLORS.accent]}
              enabled={isOnline}
            />
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          estimatedItemSize={280}
          onEndReached={loadMoreLeagues}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            hasMoreLeagues ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={MATCH_DETAILS_COLORS.accent} />
              </View>
            ) : null
          }
          accessibilityLabel="Matches list"
        />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MATCH_DETAILS_COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkIndicator: {
    backgroundColor: MATCH_DETAILS_COLORS.error + '20',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: MATCH_DETAILS_COLORS.error + '40',
  },
  networkText: {
    color: MATCH_DETAILS_COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MatchesScreen;
