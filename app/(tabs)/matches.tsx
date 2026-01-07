/**
 * Match Listing Screen - Enhanced
 * Performance optimized with faster loading and smooth scrolling
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  RefreshControl,
  FlatList,
  InteractionManager,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Components
import MatchTopBar from '../../components/Matches/MatchTopBar';
import QuickIndicators from '../../components/Matches/QuickIndicators';
import MatchTabs, { MatchTabType } from '../../components/Matches/MatchTabs';
import LeagueSection from '../../components/Matches/LeagueSection';
import MatchCardSkeleton from '../../components/Matches/MatchCardSkeleton';
import TransfersSection from '../../components/Matches/TransfersSection';
import EmptyState from '../../components/Matches/EmptyState';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';

// Hooks & Data
import { useMatchesData } from '../../hooks/useMatchesData';
import { useFavoriteLeagues } from '../../hooks/useFavoriteLeagues';
import { Match } from '../../components/league-center/matchCardUtils';
import { logger } from '../../utils/logger';
import ApiFootballService, { Transfer, MAJOR_LEAGUES } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n/useTranslation';
import { transfersCacheService } from '../../services/transfersCache.service';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/**
 * Match Listing Screen
 * Optimized for performance
 */
const MatchesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<MatchTabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  const [initialRenderDone, setInitialRenderDone] = useState(false);
  
  // Transfer filters
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);
  const [transferType, setTransferType] = useState<'all' | 'free' | 'loan'>('all');
  const [timeRange, setTimeRange] = useState<'1month' | '3months' | '6months' | '1year'>('1year');
  const [availableLeagues, setAvailableLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);

  // Scroll position for sticky header
  const scrollY = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

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

  // Optimize initial render
  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      setInitialRenderDone(true);
    });
    return () => interaction.cancel();
  }, []);

  // Get date range based on time range selection
  const getDateRange = useCallback((range: typeof timeRange) => {
    const now = new Date();
    const from = new Date(now);
    
    switch (range) {
      case '1month':
        from.setMonth(now.getMonth() - 1);
        break;
      case '3months':
        from.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        from.setMonth(now.getMonth() - 6);
        break;
      case '1year':
      default:
        from.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  }, []);

  // Load transfers when transfers tab is active or filters change
  const loadTransfersRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'transfers' && !loadTransfersRef.current) {
      loadTransfersRef.current = true;
      loadTransfers();
    } else if (activeTab !== 'transfers') {
      loadTransfersRef.current = false;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'transfers' && (selectedLeagues.length > 0 || timeRange !== '1year')) {
      loadTransfers();
    }
  }, [selectedLeagues, timeRange]);

  const loadTransfers = useCallback(async () => {
    try {
      setTransfersLoading(true);
      setTransfersError(null);

      // Default: Top 5 leagues if no selection
      const leaguesToFetch = selectedLeagues.length > 0 
        ? selectedLeagues 
        : [
            MAJOR_LEAGUES.PREMIER_LEAGUE,
            MAJOR_LEAGUES.LA_LIGA,
            MAJOR_LEAGUES.BUNDESLIGA,
            MAJOR_LEAGUES.SERIE_A,
            MAJOR_LEAGUES.LIGUE_1,
          ];

      const dateRange = getDateRange(timeRange);
      const currentSeason = new Date().getFullYear();

      // Try cache first for zero-delay display
      const cached = await transfersCacheService.getCachedTransfers(currentSeason, leaguesToFetch);
      if (cached && cached.length > 0) {
        logger.debug('📦 Transfers from cache, displaying immediately');
        const allTransfers: Transfer[] = [];
        const leaguesList: Array<{ id: number; name: string; logo?: string }> = [];
        
        cached.forEach(leagueData => {
          allTransfers.push(...leagueData.transfers);
          leaguesList.push({
            id: leagueData.leagueId,
            name: leagueData.leagueName,
            logo: leagueData.leagueLogo,
          });
        });

        setTransfers(allTransfers);
        setAvailableLeagues(leaguesList);
        setTransfersLoading(false);

        // Refresh in background
        loadTransfersInBackground(leaguesToFetch, dateRange, currentSeason);
        return;
      }

      // No cache, fetch from backend cached endpoint
      const data = await transfersCacheService.fetchCachedTransfers(
        currentSeason,
        leaguesToFetch,
        dateRange
      );

      // Flatten transfers from all leagues
      const allTransfers: Transfer[] = [];
      const leaguesList: Array<{ id: number; name: string; logo?: string }> = [];
      
      data.forEach(leagueData => {
        allTransfers.push(...leagueData.transfers);
        leaguesList.push({
          id: leagueData.leagueId,
          name: leagueData.leagueName,
          logo: leagueData.leagueLogo,
        });
      });

      setTransfers(allTransfers);
      setAvailableLeagues(leaguesList);
    } catch (err: any) {
      logger.error('Failed to load transfers:', err);
      setTransfersError('Failed to load transfers');
    } finally {
      setTransfersLoading(false);
    }
  }, [selectedLeagues, timeRange, getDateRange]);

  // Background refresh function
  const loadTransfersInBackground = useCallback(async (
    leaguesToFetch: number[],
    dateRange: { from: string; to: string },
    season: number
  ) => {
    try {
      const data = await transfersCacheService.fetchCachedTransfers(
        season,
        leaguesToFetch,
        dateRange
      );

      const allTransfers: Transfer[] = [];
      const leaguesList: Array<{ id: number; name: string; logo?: string }> = [];
      
      data.forEach(leagueData => {
        allTransfers.push(...leagueData.transfers);
        leaguesList.push({
          id: leagueData.leagueId,
          name: leagueData.leagueName,
          logo: leagueData.leagueLogo,
        });
      });

      setTransfers(allTransfers);
      setAvailableLeagues(leaguesList);
    } catch (err) {
      // Silent fail for background refresh
      logger.warn('Background transfers refresh failed:', err);
    }
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
          const leagueId = m.league?.id || 0;
          return favoriteLeaguesSet.has(leagueId);
        });
        break;
      case 'all':
      default:
        // No filtering
        break;
    }

    return filtered;
  }, [matches, activeTab, favoriteLeaguesSet]);

  // Group filtered matches by league - using Set for O(1) lookup
  const filteredGroupedMatches = useMemo(() => {
    const groupsMap = new Map<number, typeof groupedMatches[0]>();

    filteredMatches.forEach((match) => {
      const leagueId = match.league?.id || 0;
      const leagueName = match.league?.name || 'Unknown League';
      const leagueLogo = match.league?.logo;

      if (!groupsMap.has(leagueId)) {
        groupsMap.set(leagueId, {
          leagueId,
          leagueName,
          leagueLogo,
          matches: [],
        });
      }

      groupsMap.get(leagueId)!.matches.push(match);
    });

    // Convert to array and filter out empty leagues
    const groups = Array.from(groupsMap.values()).filter(group => group.matches.length > 0);

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
      
      // Major leagues come first
      if (aIsMajor && !bIsMajor) return -1;
      if (bIsMajor && !aIsMajor) return 1;
      
      // If both are major, maintain order: Premier League, La Liga, Bundesliga, Serie A, Ligue 1
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
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
      }
      
      // Then favorites
      const aIsFavorite = favoriteLeaguesSet.has(a.leagueId);
      const bIsFavorite = favoriteLeaguesSet.has(b.leagueId);
      if (aIsFavorite && !bIsFavorite) return -1;
      if (bIsFavorite && !aIsFavorite) return 1;
      
      // Finally alphabetically
      return a.leagueName.localeCompare(b.leagueName);
    });

    // Sort matches within each league: Live first, then by time
    groups.forEach((group) => {
      group.matches.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        if (a.fixtureDate && b.fixtureDate) {
          return new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime();
        }
        return 0;
      });
    });

    return groups;
  }, [filteredMatches, favoriteLeaguesSet]);

  // Calculate filtered counts for indicators
  const filteredCounts = useMemo(() => ({
    matchesCount: filteredMatches.length,
    leaguesCount: filteredGroupedMatches.length,
  }), [filteredMatches.length, filteredGroupedMatches.length]);

  // Handle match press
  const handleMatchPress = useCallback(
    (matchId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const match = matches.find((m) => m.id === matchId);
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
    [router, matches]
  );

  // Handle refresh - optimized to skip if recently refreshed
  const lastRefreshRef = React.useRef<number>(0);
  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    // Skip if refreshed less than 3 seconds ago
    if (now - lastRefreshRef.current < 3000) {
      setRefreshing(false);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    lastRefreshRef.current = now;
    
    try {
      if (activeTab === 'transfers') {
        await loadTransfers();
      } else {
        await refetch();
      }
    } finally {
      setRefreshing(false);
    }
  }, [refetch, activeTab, loadTransfers]);

  // Handle tab change
  const handleTabChange = useCallback((tab: MatchTabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  // Handle player press in transfers
  const handlePlayerPress = useCallback((transfer: Transfer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const latestTransfer = transfer.transfers && transfer.transfers.length > 0 
      ? transfer.transfers[transfer.transfers.length - 1] 
      : null;
    const currentTeam = latestTransfer?.teams.in;
    
    router.push({
      pathname: '/player-profile' as any,
      params: {
        id: transfer.player.id.toString(),
        name: transfer.player.name,
        photo: transfer.player.photo || '',
        teamName: currentTeam?.name || '',
        teamLogo: currentTeam?.logo || '',
      }
    } as any);
  }, [router]);

  // Render league section
  const renderLeagueSection = useCallback(({ item: group, index }: { item: typeof filteredGroupedMatches[0]; index: number }) => (
    <LeagueSection
      leagueId={group.leagueId}
      leagueName={group.leagueName}
      leagueLogo={group.leagueLogo}
      matches={group.matches}
      onMatchPress={handleMatchPress}
      index={index}
    />
  ), [handleMatchPress]);

  // Key extractor
  const keyExtractor = useCallback((item: typeof filteredGroupedMatches[0]) => item.leagueId.toString(), []);

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

  // Error state
  if (error && matches.length === 0) {
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
        <EmptyState
          icon="alert-circle-outline"
          title={t.matches.empty.errorLoadingMatches}
          message={error}
          iconColor={MATCH_DETAILS_COLORS.error}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[MATCH_DETAILS_COLORS.background, MATCH_DETAILS_COLORS.background]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Top Bar */}
      <MatchTopBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        scrollY={scrollY}
      />

      {/* Quick Indicators - Hide for transfers tab */}
      {activeTab !== 'transfers' && (
        <QuickIndicators
          matchesCount={filteredCounts.matchesCount}
          leaguesCount={filteredCounts.leaguesCount}
        />
      )}

      {/* Tabs */}
      <MatchTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Content - Using FlatList for better performance */}
      {activeTab === 'transfers' ? (
        <AnimatedScrollView
          style={styles.scrollView}
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
            />
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <TransfersSection
            transfers={transfers}
            loading={transfersLoading}
            error={transfersError}
            selectedLeagues={selectedLeagues}
            onSelectedLeaguesChange={setSelectedLeagues}
            transferType={transferType}
            onTransferTypeChange={setTransferType}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            availableLeagues={availableLeagues}
            onPlayerPress={handlePlayerPress}
          />
        </AnimatedScrollView>
      ) : filteredGroupedMatches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="calendar-outline"
            title={t.matches.empty.noMatches}
            message={t.matches.empty.tryDifferentDate}
          />
        </View>
      ) : (
        <AnimatedFlatList
          ref={flatListRef as any}
          data={filteredGroupedMatches}
          renderItem={renderLeagueSection}
          keyExtractor={keyExtractor}
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
            />
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={100}
          initialNumToRender={2}
          windowSize={3}
          // Remove getItemLayout as item heights vary significantly
        />
      )}
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
});

export default MatchesScreen;
