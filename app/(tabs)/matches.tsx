/**
 * Match Listing Screen - Enhanced
 * Performance optimized with animations, haptic feedback, and unified colors
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  RefreshControl,
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

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/**
 * Match Listing Screen
 * Enhanced with performance optimizations and unified design
 */
const MatchesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<MatchTabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  
  // Transfer filters
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);
  const [transferType, setTransferType] = useState<'all' | 'free' | 'loan'>('all');
  const [timeRange, setTimeRange] = useState<'1month' | '3months' | '6months' | '1year'>('1year');
  const [availableLeagues, setAvailableLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);

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
      
      const data = await ApiFootballService.getTransfersByLeagues({
        leagues: leaguesToFetch,
        dateRange,
      });

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

    // Convert to array and sort: favorites first, then alphabetically
    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => {
      const aIsFavorite = favoriteLeaguesSet.has(a.leagueId);
      const bIsFavorite = favoriteLeaguesSet.has(b.leagueId);
      if (aIsFavorite && !bIsFavorite) return -1;
      if (bIsFavorite && !aIsFavorite) return 1;
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
      if (match) {
        router.push({
          pathname: '/(tabs)/match-details',
          params: {
            fixtureId: matchId,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            homeLogo: match.homeTeam.logo,
            awayLogo: match.awayTeam.logo,
            homeScore: match.score.home?.toString() || '',
            awayScore: match.score.away?.toString() || '',
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

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
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
          title="Error Loading Matches"
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

      {/* Content */}
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
        {activeTab === 'transfers' ? (
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
        ) : filteredGroupedMatches.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No matches found"
            message="Try selecting a different date or tab"
          />
        ) : (
          filteredGroupedMatches.map((group, index) => (
            <LeagueSection
              key={group.leagueId}
              leagueId={group.leagueId}
              leagueName={group.leagueName}
              leagueLogo={group.leagueLogo}
              matches={group.matches}
              onMatchPress={handleMatchPress}
              index={index}
            />
          ))
        )}
      </AnimatedScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MATCH_DETAILS_COLORS.background,
  },
  scrollView: {
    flex: 1,
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
});

export default MatchesScreen;
