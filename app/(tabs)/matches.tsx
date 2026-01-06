
/**
 * Match Listing Screen - 365Scores Style
 * Main screen for viewing matches grouped by league
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Components
import MatchTopBar from '../../components/Matches/MatchTopBar';
import QuickIndicators from '../../components/Matches/QuickIndicators';
import MatchTabs, { MatchTabType } from '../../components/Matches/MatchTabs';
import LeagueSection from '../../components/Matches/LeagueSection';
import MatchCardSkeleton from '../../components/Matches/MatchCardSkeleton';
import { COLORS } from '../../components/reels/constants';

// Hooks & Data
import { useMatchesData } from '../../hooks/useMatchesData';
import { useFavoriteLeagues } from '../../hooks/useFavoriteLeagues';
import { Match } from '../../components/league-center/matchCardUtils';
import { logger } from '../../utils/logger';
import ApiFootballService, { Transfer, MAJOR_LEAGUES } from '../../services/apiFootball';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/**
 * Match Listing Screen
 * 365Scores style implementation
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
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]); // Empty = all major leagues
  const [transferType, setTransferType] = useState<'all' | 'free' | 'loan'>('all');
  const [timeRange, setTimeRange] = useState<'1month' | '3months' | '6months' | '1year'>('1year');
  const [availableLeagues, setAvailableLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);

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

  // Favorite leagues hook
  const { favoriteLeagues } = useFavoriteLeagues();

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
  useEffect(() => {
    if (activeTab === 'transfers') {
      loadTransfers();
    }
  }, [activeTab, selectedLeagues, timeRange]);

  const loadTransfers = async () => {
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
  };

  // Filter transfers by type (free/loan)
  const filteredTransfers = useMemo(() => {
    let filtered = [...transfers];

    if (transferType !== 'all') {
      filtered = filtered.filter(transfer => {
        return transfer.transfers.some(t => {
          const typeLower = t.type?.toLowerCase() || '';
          if (transferType === 'free') {
            return typeLower.includes('free') || typeLower.includes('عارية');
          } else if (transferType === 'loan') {
            return typeLower.includes('loan') || typeLower.includes('سوا');
          }
          return true;
        });
      });
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = a.transfers[0]?.date || '';
      const dateB = b.transfers[0]?.date || '';
      return dateB.localeCompare(dateA);
    });

    return filtered;
  }, [transfers, transferType]);

  // Filter matches by active tab
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
          return favoriteLeagues.includes(leagueId);
        });
        break;
      case 'all':
      default:
        // No filtering
        break;
    }

    return filtered;
  }, [matches, activeTab, favoriteLeagues]);

  // Group filtered matches by league
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
      const aIsFavorite = favoriteLeagues.includes(a.leagueId);
      const bIsFavorite = favoriteLeagues.includes(b.leagueId);
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
  }, [filteredMatches, favoriteLeagues]);

  // Calculate filtered counts for indicators
  const filteredCounts = useMemo(() => {
    return {
      matchesCount: filteredMatches.length,
      leaguesCount: filteredGroupedMatches.length,
    };
  }, [filteredMatches.length, filteredGroupedMatches.length]);

  // Handle match press
  const handleMatchPress = useCallback(
    (matchId: string) => {
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
    setRefreshing(true);
    if (activeTab === 'transfers') {
      await loadTransfers();
    } else {
      await refetch();
    }
    setRefreshing(false);
  }, [refetch, activeTab]);

  // Loading state
  if (loading && !refreshing && matches.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={[COLORS.deepBlack, COLORS.deepBlack]}
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
          colors={[COLORS.deepBlack, COLORS.deepBlack]}
          style={StyleSheet.absoluteFill}
        />
        <MatchTopBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          scrollY={scrollY}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <View style={styles.errorText}>
              <Text style={styles.errorTitle}>Error Loading Matches</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[COLORS.deepBlack, COLORS.deepBlack]}
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
      <MatchTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Transfer Filters */}
      {activeTab === 'transfers' && (
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons 
              name={showFilters ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={COLORS.neonGreen} 
            />
            <Text style={styles.filterToggleText}>Filters</Text>
            {(selectedLeagues.length > 0 || transferType !== 'all' || timeRange !== '1year') && (
              <View style={styles.filterBadge} />
            )}
          </TouchableOpacity>

          {showFilters && (
            <View style={styles.filtersContent}>
              {/* Time Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Time Period</Text>
                <View style={styles.filterOptions}>
                  {(['1month', '3months', '6months', '1year'] as const).map((range) => (
                    <TouchableOpacity
                      key={range}
                      style={[
                        styles.filterOption,
                        timeRange === range && styles.filterOptionActive
                      ]}
                      onPress={() => setTimeRange(range)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        timeRange === range && styles.filterOptionTextActive
                      ]}>
                        {range === '1month' ? '1 Month' : 
                         range === '3months' ? '3 Months' :
                         range === '6months' ? '6 Months' : '1 Year'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Transfer Type Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Transfer Type</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'free', 'loan'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterOption,
                        transferType === type && styles.filterOptionActive
                      ]}
                      onPress={() => setTransferType(type)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        transferType === type && styles.filterOptionTextActive
                      ]}>
                        {type === 'all' ? 'All' : 
                         type === 'free' ? 'Free (عارية)' : 'Loan (سوا)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* League Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  Leagues {selectedLeagues.length > 0 && `(${selectedLeagues.length} selected)`}
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.leagueFilterScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.leagueFilterItem,
                      selectedLeagues.length === 0 && styles.leagueFilterItemActive
                    ]}
                    onPress={() => setSelectedLeagues([])}
                  >
                    <Text style={[
                      styles.leagueFilterText,
                      selectedLeagues.length === 0 && styles.leagueFilterTextActive
                    ]}>
                      Top 5 Leagues
                    </Text>
                  </TouchableOpacity>
                  {availableLeagues.map((league) => {
                    const isSelected = selectedLeagues.includes(league.id);
                    return (
                      <TouchableOpacity
                        key={league.id}
                        style={[
                          styles.leagueFilterItem,
                          isSelected && styles.leagueFilterItemActive
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedLeagues(selectedLeagues.filter(id => id !== league.id));
                          } else {
                            setSelectedLeagues([...selectedLeagues, league.id]);
                          }
                        }}
                      >
                        {league.logo && (
                          <Image source={{ uri: league.logo }} style={styles.leagueFilterLogo} />
                        )}
                        <Text style={[
                          styles.leagueFilterText,
                          isSelected && styles.leagueFilterTextActive
                        ]} numberOfLines={1}>
                          {league.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      )}

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
            tintColor={COLORS.neonGreen}
            colors={[COLORS.neonGreen]}
          />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {activeTab === 'transfers' ? (
          // Transfers Content
          transfersLoading && transfers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={COLORS.neonGreen} />
              <Text style={styles.emptySubtext}>Loading transfers...</Text>
            </View>
          ) : transfersError && transfers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyContent}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Error Loading Transfers</Text>
                <Text style={styles.emptySubtext}>{transfersError}</Text>
              </View>
            </View>
          ) : filteredTransfers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyContent}>
                <Ionicons name="swap-horizontal-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No transfers found</Text>
                <Text style={styles.emptySubtext}>
                  {transfers.length === 0 
                    ? 'Try refreshing or check back later'
                    : 'Try adjusting your filters'}
                </Text>
              </View>
            </View>
          ) : (
            filteredTransfers.map((transfer, index) => (
              <View key={index} style={styles.transferCard}>
                <View style={styles.transferHeader}>
                  <Image
                    source={{ uri: transfer.player.photo }}
                    style={styles.playerPhoto}
                  />
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{transfer.player.name}</Text>
                    <Text style={styles.transferDate}>{transfer.update}</Text>
                  </View>
                </View>

                {transfer.league && (
                  <View style={styles.leagueBadge}>
                    {transfer.league.logo && (
                      <Image source={{ uri: transfer.league.logo }} style={styles.leagueLogoSmall} />
                    )}
                    <Text style={styles.leagueNameSmall}>{transfer.league.name}</Text>
                  </View>
                )}

                {transfer.transfers.map((t, tIndex) => (
                  <View key={tIndex} style={styles.transferDetails}>
                    {t.teams.out && (
                      <View style={styles.teamBox}>
                        <Image
                          source={{ uri: t.teams.out.logo }}
                          style={styles.teamLogo}
                        />
                        <Text style={styles.teamName} numberOfLines={2}>
                          {t.teams.out.name}
                        </Text>
                      </View>
                    )}

                    <View style={styles.transferArrow}>
                      <Ionicons name="arrow-forward" size={20} color={COLORS.neonGreen} />
                      <Text style={styles.transferType}>{t.type}</Text>
                      {t.date && <Text style={styles.transferDateSmall}>{t.date}</Text>}
                    </View>

                    {t.teams.in && (
                      <View style={styles.teamBox}>
                        <Image
                          source={{ uri: t.teams.in.logo }}
                          style={styles.teamLogo}
                        />
                        <Text style={styles.teamName} numberOfLines={2}>
                          {t.teams.in.name}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))
          )
        ) : filteredGroupedMatches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyText}>No matches found</Text>
              <Text style={styles.emptySubtext}>
                Try selecting a different date or tab
              </Text>
            </View>
          </View>
        ) : (
          filteredGroupedMatches.map((group) => (
            <LeagueSection
              key={group.leagueId}
              leagueId={group.leagueId}
              leagueName={group.leagueName}
              leagueLogo={group.leagueLogo}
              matches={group.matches}
              onMatchPress={handleMatchPress}
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
    backgroundColor: COLORS.deepBlack,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorContent: {
    alignItems: 'center',
  },
  errorText: {
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyContent: {
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  transferCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  transferDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  transferDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 40,
    height: 40,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamName: {
    fontSize: 11,
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '500',
  },
  transferArrow: {
    alignItems: 'center',
    marginHorizontal: 12,
    minWidth: 80,
  },
  transferType: {
    fontSize: 10,
    color: COLORS.neonGreen,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  transferDateSmall: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filtersContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterToggleText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  filterBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neonGreen,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterOptionActive: {
    backgroundColor: COLORS.neonGreen,
    borderColor: COLORS.neonGreen,
  },
  filterOptionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: COLORS.deepBlack,
    fontWeight: '700',
  },
  leagueFilterScroll: {
    maxHeight: 50,
  },
  leagueFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leagueFilterItemActive: {
    backgroundColor: COLORS.neonGreen,
    borderColor: COLORS.neonGreen,
  },
  leagueFilterLogo: {
    width: 16,
    height: 16,
    marginRight: 6,
    borderRadius: 8,
  },
  leagueFilterText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  leagueFilterTextActive: {
    color: COLORS.deepBlack,
    fontWeight: '700',
  },
  leagueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  leagueLogoSmall: {
    width: 14,
    height: 14,
    marginRight: 6,
    borderRadius: 7,
  },
  leagueNameSmall: {
    color: COLORS.neonGreen,
    fontSize: 10,
    fontWeight: '600',
  },
});

export default MatchesScreen;

