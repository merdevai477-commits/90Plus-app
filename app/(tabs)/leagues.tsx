/**
 * Leagues Screen - 365 Days Style Design
 * ✅ INTEGRATED: Direct backend API integration
 * Clean, modern design inspired by 365 Days app
 * Uses react-native-reanimated, FlashList, and optimized performance
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Dimensions,
  Platform,
  Share,
  ActionSheetIOS,
  Alert,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  FadeInDown,
  FadeIn,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { logger } from '../../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Components
import PremiumHeader from '../../components/league-center/PremiumHeader';
import DatePickerStrip from '../../components/league-center/DatePickerStrip';
import PremiumBottomNav from '../../components/league-center/PremiumBottomNav';
import PredictionMatchCard from '../../components/league-center/PredictionMatchCard';
import CollapsibleLeagueSection from '../../components/league-center/CollapsibleLeagueSection';
import MatchCardSkeleton from '../../components/league-center/MatchCardSkeleton';
import EmptyState from '../../components/league-center/EmptyState';
import ErrorState from '../../components/league-center/ErrorState';
import FilterModal, { FilterState, FilterStatus, FilterTime, FilterMatchType } from '../../components/league-center/FilterModal';
import CouponsBar from '../../components/league-center/CouponsBar';

// Hooks & Utilities
import { useLeagueCenterData } from '../../components/league-center/useLeagueCenterData';
import { usePredictionsStore } from '../../src/store/usePredictionsStore';
import { Match } from '../../components/league-center/matchCardUtils';
import { useHomeStore } from '../../src/store/home.store';
import { useFavoriteLeagues } from '../../hooks/useFavoriteLeagues';
import { fetchLiveMatches } from '../../components/league-center/leagueApiUtils';
import ApiFootballService, { TopScorer, TopAssist } from '../../services/apiFootball';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Storage keys
const FILTERS_STORAGE_KEY = '@leagues_filters';
const SORT_STORAGE_KEY = '@leagues_sort_preference';

// Sort types
type SortType = 'time_earliest' | 'time_latest' | 'time_now' | 'league_alphabetical' | 'status_priority' | 'popularity';

interface SortState {
  type: SortType;
}

const DEFAULT_SORT: SortState = {
  type: 'status_priority',
};

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<Match>);

/**
 * Leagues Screen - 365 Days Style
 * Clean, modern design with direct backend integration
 */
const LeaguesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();
  const { toggleFavorite: toggleHomeFavorite } = useHomeStore();

  // Favorite leagues hook
  const { favoriteLeagues, isFavorite: isFavoriteLeague, toggleFavorite: toggleFavoriteLeague } = useFavoriteLeagues();

  // Tab state
  const [activeTab, setActiveTab] = useState<'predictions' | 'matches'>('matches');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [leagueView, setLeagueView] = useState<'matches' | 'scorers' | 'assists' | 'rounds'>('matches');
  
  // League features data
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [topAssists, setTopAssists] = useState<TopAssist[]>([]);
  const [rounds, setRounds] = useState<string[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [loadingFeatures, setLoadingFeatures] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    leagues: [],
    status: 'all',
    time: 'all',
    matchType: 'all',
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeCoupon, setActiveCoupon] = useState(1);

  // Sort state
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);

  // Predictions store
  const {
    userCoins,
    remainingPredictions,
    totalDailyPredictions,
    userPredictions: storePredictions,
    fetchUserData,
    fetchUserPredictions,
    submitPrediction,
  } = usePredictionsStore();

  // Fetch data - Direct backend integration
  const { matches: apiMatches, loading, error, refetch } = useLeagueCenterData(selectedDate);
  
  // Log backend integration status
  useEffect(() => {
    if (apiMatches.length > 0) {
      logger.debug('[LeaguesScreen] Matches loaded from backend', {
        count: apiMatches.length,
        date: selectedDate.toISOString().split('T')[0],
      });
    }
  }, [apiMatches.length, selectedDate]);

  // Scroll position for sticky header
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load filters from AsyncStorage
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (stored) {
          setFilters(JSON.parse(stored));
        }
      } catch (error) {
        logger.warn('Failed to load filters:', error);
      }
    };
    loadFilters();
  }, []);

  // Load sort preference from AsyncStorage
  useEffect(() => {
    const loadSort = async () => {
      try {
        const stored = await AsyncStorage.getItem(SORT_STORAGE_KEY);
        if (stored) {
          setSortState(JSON.parse(stored));
        }
      } catch (error) {
        logger.warn('Failed to load sort preference:', error);
      }
    };
    loadSort();
  }, []);

  // Save filters to AsyncStorage
  const saveFilters = useCallback(async (newFilters: FilterState) => {
    try {
      await AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
    } catch (error) {
      logger.warn('Failed to save filters:', error);
    }
  }, []);

  // Save sort preference to AsyncStorage
  const saveSortPreference = useCallback(async (newSort: SortState) => {
    try {
      await AsyncStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(newSort));
    } catch (error) {
      logger.warn('Failed to save sort preference:', error);
    }
  }, []);

  // Fetch user data on mount
  useEffect(() => {
    if (userId) {
      const loadData = async () => {
        const token = await getToken();
        if (token) {
          await fetchUserData(token);
          await fetchUserPredictions(token);
        }
      };
      loadData();
    }
  }, [userId, getToken, fetchUserData, fetchUserPredictions]);

  // Load league features when league is selected
  const loadLeagueFeatures = useCallback(async (leagueId: number, season: number = 2024) => {
    if (!leagueId) return;
    
    try {
      setLoadingFeatures(true);
      const [scorers, assists, roundsData] = await Promise.allSettled([
        ApiFootballService.getTopScorers(leagueId, season),
        ApiFootballService.getTopAssists(leagueId, season),
        ApiFootballService.getLeagueRounds(leagueId, season, true),
      ]);

      if (scorers.status === 'fulfilled') setTopScorers(scorers.value);
      if (assists.status === 'fulfilled') setTopAssists(assists.value);
      if (roundsData.status === 'fulfilled') setRounds(roundsData.value);
    } catch (error) {
      logger.error('Failed to load league features:', error);
    } finally {
      setLoadingFeatures(false);
    }
  }, []);

  // Auto-detect league from matches and load features when view changes
  useEffect(() => {
    if (apiMatches.length > 0 && leagueView !== 'matches' && !selectedLeagueId) {
      const firstMatch = apiMatches[0];
      const leagueId = firstMatch.league?.id;
      if (leagueId) {
        setSelectedLeagueId(leagueId);
        loadLeagueFeatures(leagueId);
      }
    } else if (leagueView !== 'matches' && selectedLeagueId) {
      loadLeagueFeatures(selectedLeagueId);
    }
  }, [leagueView, selectedLeagueId, loadLeagueFeatures, apiMatches]);

  // Live matches auto-refresh (30 seconds) - Feature 12
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = selectedDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
    const isLiveFilter = filters.status === 'live';

    // Only refresh if viewing "Today" or "Live" filter
    if (!isToday && !isLiveFilter) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // Background refresh - don't show loading
        const liveMatches = await fetchLiveMatches();
        logger.debug('[LeaguesScreen] Live matches auto-refresh', {
          count: liveMatches.length,
        });
        // The useLeagueCenterData hook will handle merging
        await refetch();
      } catch (error) {
        logger.warn('[LeaguesScreen] Auto-refresh failed:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [selectedDate, filters.status, refetch]);

  // Filter matches by search query - Feature 2
  const searchFilteredMatches = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return apiMatches;
    }

    const query = debouncedSearchQuery.toLowerCase().trim();
    return apiMatches.filter((match) => {
      const homeTeam = match.homeTeam?.name?.toLowerCase() || '';
      const awayTeam = match.awayTeam?.name?.toLowerCase() || '';
      const leagueName = match.league?.name?.toLowerCase() || '';
      const status = match.status?.toLowerCase() || '';

      return (
        homeTeam.includes(query) ||
        awayTeam.includes(query) ||
        leagueName.includes(query) ||
        status.includes(query)
      );
    });
  }, [apiMatches, debouncedSearchQuery]);

  // Filter matches by filter state - Feature 3
  const filteredMatches = useMemo(() => {
    let filtered = [...searchFilteredMatches];

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter((m) => {
        if (filters.status === 'live') return m.status === 'live';
        if (filters.status === 'finished') return m.status === 'finished';
        if (filters.status === 'upcoming') return m.status === 'upcoming' || m.status === 'NS' || m.status === 'TBD';
        return true;
      });
    }

    // Filter by league
    if (filters.leagues.length > 0) {
      filtered = filtered.filter((m) => {
        const leagueId = m.league?.id || 0;
        return filters.leagues.includes(leagueId);
      });
    }

    // Filter by match type
    if (filters.matchType === 'favorites') {
      filtered = filtered.filter((m) => {
        const leagueId = m.league?.id || 0;
        return favoriteLeagues.includes(leagueId);
      });
    } else if (filters.matchType === 'with_predictions') {
      filtered = filtered.filter((m) => {
        return storePredictions[m.id] !== undefined;
      });
    }

    // Filter by time
    if (filters.time === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((m) => {
        if (!m.fixtureDate) return false;
        const matchDate = new Date(m.fixtureDate);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate.getTime() === today.getTime();
      });
    } else if (filters.time === 'next7days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      filtered = filtered.filter((m) => {
        if (!m.fixtureDate) return false;
        const matchDate = new Date(m.fixtureDate);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate >= today && matchDate <= nextWeek;
      });
    } else if (filters.time === 'thisweek') {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      filtered = filtered.filter((m) => {
        if (!m.fixtureDate) return false;
        const matchDate = new Date(m.fixtureDate);
        return matchDate >= startOfWeek && matchDate <= endOfWeek;
      });
    }

    // Filter by tab
    if (activeTab === 'predictions') {
      filtered = filtered.filter(
        (m) => m.status === 'upcoming' || m.status === 'NS' || m.status === 'TBD'
      );
    }

    return filtered;
  }, [searchFilteredMatches, filters, activeTab, favoriteLeagues, storePredictions]);

  // Sort matches - Feature 11
  const sortedMatches = useMemo(() => {
    const sorted = [...filteredMatches];

    switch (sortState.type) {
      case 'time_earliest':
        sorted.sort((a, b) => {
          const dateA = a.fixtureDate ? new Date(a.fixtureDate).getTime() : 0;
          const dateB = b.fixtureDate ? new Date(b.fixtureDate).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'time_latest':
        sorted.sort((a, b) => {
          const dateA = a.fixtureDate ? new Date(a.fixtureDate).getTime() : 0;
          const dateB = b.fixtureDate ? new Date(b.fixtureDate).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'time_now':
        // Live first, then upcoming, then finished
        sorted.sort((a, b) => {
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (b.status === 'live' && a.status !== 'live') return 1;
          if (a.status === 'upcoming' && b.status === 'finished') return -1;
          if (b.status === 'upcoming' && a.status === 'finished') return 1;
          return 0;
        });
        break;
      case 'league_alphabetical':
        sorted.sort((a, b) => {
          const aName = a.league?.name || '';
          const bName = b.league?.name || '';
          return aName.localeCompare(bName);
        });
        break;
      case 'status_priority':
        // Live → Upcoming → Finished
        sorted.sort((a, b) => {
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (b.status === 'live' && a.status !== 'live') return 1;
          if (a.status === 'upcoming' && b.status === 'finished') return -1;
          if (b.status === 'upcoming' && a.status === 'finished') return 1;
          return 0;
        });
        // Then by favorite leagues
        sorted.sort((a, b) => {
          const aLeagueId = a.league?.id || 0;
          const bLeagueId = b.league?.id || 0;
          const aIsFavorite = favoriteLeagues.includes(aLeagueId);
          const bIsFavorite = favoriteLeagues.includes(bLeagueId);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (bIsFavorite && !aIsFavorite) return 1;
          return 0;
        });
        break;
      case 'popularity':
        // Could sort by view count or other metrics
        // For now, keep current order
        break;
    }

    return sorted;
  }, [filteredMatches, sortState.type, favoriteLeagues]);

  // Group matches by league for matches tab - Feature 15 (League Statistics)
  const groupedByLeague = useMemo(() => {
    if (activeTab !== 'matches') return [];

    const groups: { [key: number]: Match[] } = {};
    sortedMatches.forEach((match) => {
      const leagueId = match.league?.id || 0;
      if (!groups[leagueId]) {
        groups[leagueId] = [];
      }
      groups[leagueId].push(match);
    });

    // Convert to array and calculate statistics
    const result = Object.entries(groups).map(([leagueId, matches]) => {
      const leagueIdNum = parseInt(leagueId);
      const liveCount = matches.filter((m) => m.status === 'live').length;
      const finishedCount = matches.filter((m) => m.status === 'finished').length;
      const upcomingCount = matches.filter((m) => m.status === 'upcoming' || m.status === 'NS' || m.status === 'TBD').length;

      return {
        leagueId: leagueIdNum,
        leagueName: matches[0]?.league?.name || 'Unknown League',
        leagueLogo: matches[0]?.league?.logo,
        matches,
        isFavorite: favoriteLeagues.includes(leagueIdNum),
        statistics: {
          total: matches.length,
          live: liveCount,
          finished: finishedCount,
          upcoming: upcomingCount,
        },
      };
    });

    // Sort: favorites first, then alphabetically
    result.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (b.isFavorite && !a.isFavorite) return 1;
      return a.leagueName.localeCompare(b.leagueName);
    });

    return result;
  }, [sortedMatches, activeTab, favoriteLeagues]);

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.leagues.length > 0) count++;
    if (filters.status !== 'all') count++;
    if (filters.time !== 'all') count++;
    if (filters.matchType !== 'all') count++;
    return count;
  }, [filters]);

  // Handle prediction submission
  const handlePredictionSubmit = useCallback(
    async (matchId: string, prediction: { type: 'home' | 'draw' | 'away' }) => {
      if (!userId) {
        Alert.alert('Error', 'Please sign in first');
        return;
      }

      const match = apiMatches.find((m) => m.id === matchId);
      if (!match) return;

      const token = await getToken();
      if (!token) return;

      try {
        const result = await submitPrediction(
          token,
          parseInt(matchId),
          prediction,
          {
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            homeTeamLogo: match.homeTeam.logo,
            awayTeamLogo: match.awayTeam.logo,
            matchDate: match.fixtureDate,
            leagueName: match.league?.name,
          }
        );

        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to save prediction');
        }
      } catch (error) {
        logger.error('Prediction error:', error);
        Alert.alert('Error', 'An error occurred while saving the prediction');
      }
    },
    [userId, apiMatches, getToken, submitPrediction]
  );

  // Handle match press
  const handleMatchPress = useCallback(
    (matchId: string) => {
      const match = apiMatches.find((m) => m.id === matchId);
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
    [router, apiMatches]
  );

  // Handle favorite league toggle - Feature 1
  const handleFavoriteLeagueToggle = useCallback(
    async (leagueId: number) => {
      try {
        await toggleFavoriteLeague(leagueId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        logger.error('Error toggling favorite league:', error);
        Alert.alert('Error', 'Failed to update favorite league');
      }
    },
    [toggleFavoriteLeague]
  );

  // Handle filter apply - Feature 3
  const handleFilterApply = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters);
      saveFilters(newFilters);
      setShowFilterModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [saveFilters]
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    if (userId) {
      const token = await getToken();
      if (token) {
        await fetchUserData(token);
        await fetchUserPredictions(token);
      }
    }
    setRefreshing(false);
  }, [refetch, userId, getToken, fetchUserData, fetchUserPredictions]);

  // Transform store predictions to match component format
  const transformedPredictions = useMemo(() => {
    return Object.entries(storePredictions).reduce(
      (acc, [matchId, pred]: [string, any]) => {
        acc[matchId] = {
          type: pred.prediction?.type || pred.type,
          points: pred.coinsSpent || 5,
        };
        return acc;
      },
      {} as { [key: string]: { type: 'home' | 'draw' | 'away'; points?: number } }
    );
  }, [storePredictions]);

  // Render functions for new features
  const renderTopScorers = () => {
    if (loadingFeatures) {
      return (
        <View style={styles.featuresLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      );
    }

    if (topScorers.length === 0) {
      return (
        <View style={styles.emptyFeatures}>
          <Text style={styles.emptyFeaturesText}>No top scorers data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Top Scorers</Text>
        {topScorers.map((scorer, index) => {
          const stats = scorer.statistics?.[0];
          return (
            <View key={`scorer-${scorer.player.id}`} style={styles.scorerCard}>
              <View style={styles.scorerRank}>
                <Text style={styles.scorerRankText}>{index + 1}</Text>
              </View>
              <Image source={{ uri: scorer.player.photo }} style={styles.scorerPhoto} />
              <View style={styles.scorerInfo}>
                <Text style={styles.scorerName}>{scorer.player.name}</Text>
                <Text style={styles.scorerTeam}>{stats?.team?.name}</Text>
              </View>
              <View style={styles.scorerStats}>
                <Text style={styles.scorerGoals}>{stats?.goals?.total || 0}</Text>
                <Text style={styles.scorerLabel}>Goals</Text>
              </View>
              <View style={styles.scorerStats}>
                <Text style={styles.scorerAssists}>{stats?.goals?.assists || 0}</Text>
                <Text style={styles.scorerLabel}>Assists</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTopAssists = () => {
    if (loadingFeatures) {
      return (
        <View style={styles.featuresLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      );
    }

    if (topAssists.length === 0) {
      return (
        <View style={styles.emptyFeatures}>
          <Text style={styles.emptyFeaturesText}>No top assists data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Top Assists / Playmakers</Text>
        {topAssists.map((assist, index) => {
          const stats = assist.statistics?.[0];
          return (
            <View key={`assist-${assist.player.id}`} style={styles.scorerCard}>
              <View style={styles.scorerRank}>
                <Text style={styles.scorerRankText}>{index + 1}</Text>
              </View>
              <Image source={{ uri: assist.player.photo }} style={styles.scorerPhoto} />
              <View style={styles.scorerInfo}>
                <Text style={styles.scorerName}>{assist.player.name}</Text>
                <Text style={styles.scorerTeam}>{stats?.team?.name}</Text>
              </View>
              <View style={styles.scorerStats}>
                <Text style={styles.scorerAssists}>{stats?.goals?.assists || 0}</Text>
                <Text style={styles.scorerLabel}>Assists</Text>
              </View>
              <View style={styles.scorerStats}>
                <Text style={styles.scorerGoals}>{stats?.goals?.total || 0}</Text>
                <Text style={styles.scorerLabel}>Goals</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderRounds = () => {
    if (loadingFeatures) {
      return (
        <View style={styles.featuresLoading}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      );
    }

    if (rounds.length === 0) {
      return (
        <View style={styles.emptyFeatures}>
          <Text style={styles.emptyFeaturesText}>No rounds data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>League Rounds</Text>
        {rounds.map((round, index) => (
          <View key={`round-${index}`} style={styles.roundCard}>
            <Text style={styles.roundText}>{round}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Quick actions for match cards - Feature 14
  const handleMatchLongPress = useCallback(
    (match: Match) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const options = ['Share', 'Copy Link', 'Cancel'];
      const cancelButtonIndex = 2;

      const handleAction = async (buttonIndex: number) => {
        if (buttonIndex === 0) {
          // Share
          try {
            const message = `${match.homeTeam.name} vs ${match.awayTeam.name}\n${match.league?.name || 'Match'}`;
            await Share.share({
              message,
              title: 'Match Details',
            });
          } catch (error) {
            logger.error('Share error:', error);
          }
        } else if (buttonIndex === 1) {
          // Copy Link - Using Share API since Clipboard package not available
          try {
            const matchUrl = `90plus://match/${match.id}`;
            await Share.share({
              message: matchUrl,
              title: 'Match Link',
            });
          } catch (error) {
            logger.error('Share error:', error);
          }
        }
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex,
          },
          handleAction
        );
      } else {
        // Android: Use Alert with options
        Alert.alert('Match Actions', 'Choose an action', [
          { text: 'Share', onPress: () => handleAction(0) },
          { text: 'Copy Link', onPress: () => handleAction(1) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    []
  );

  // FlatList/SectionList renderers and optimizations
  const renderPredictionCard = useCallback(
    ({ item, index }: { item: Match; index: number }) => (
      <PredictionMatchCard
        key={item.id}
        match={item}
        index={index}
        userPrediction={transformedPredictions[item.id]}
        onPredictionSubmit={handlePredictionSubmit}
      />
    ),
    [transformedPredictions, handlePredictionSubmit]
  );

  const keyExtractor = useCallback((item: Match) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 280, // Approximate PredictionMatchCard height
      offset: 280 * index,
      index,
    }),
    []
  );

  // Render content based on state
  if (loading && !refreshing && apiMatches.length === 0) {
    // Feature 4: Skeleton Loading States
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
          style={StyleSheet.absoluteFill}
        />
        <PremiumHeader scrollY={scrollY} activeFiltersCount={activeFiltersCount} />
        <DatePickerStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} scrollY={scrollY} />
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 5 }).map((_, index) => (
            <MatchCardSkeleton key={index} type={activeTab === 'predictions' ? 'prediction' : 'live'} index={index} />
          ))}
        </View>
      </View>
    );
  }

  if (error && apiMatches.length === 0) {
    // Feature 9: Error States with Retry
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
          style={StyleSheet.absoluteFill}
        />
        <PremiumHeader scrollY={scrollY} activeFiltersCount={activeFiltersCount} />
        <DatePickerStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} scrollY={scrollY} />
        <ErrorState error={error} onRetry={handleRefresh} />
      </View>
    );
  }

  // Feature 8: Empty States
  if (sortedMatches.length === 0) {
    const emptyType = debouncedSearchQuery.trim()
      ? 'no_search_results'
      : activeTab === 'predictions'
      ? 'no_predictions'
      : 'no_matches';

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
          style={StyleSheet.absoluteFill}
        />
        <PremiumHeader
          scrollY={scrollY}
          activeFiltersCount={activeFiltersCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterPress={() => setShowFilterModal(true)}
        />
        <DatePickerStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} scrollY={scrollY} />
        <EmptyState
          type={emptyType}
          title={
            debouncedSearchQuery.trim()
              ? 'No Results Found'
              : activeTab === 'predictions'
              ? 'No Predictions Yet'
              : 'No Matches Available'
          }
          subtitle={
            debouncedSearchQuery.trim()
              ? 'Try adjusting your search or filters'
              : activeTab === 'predictions'
              ? 'Make your first prediction on an upcoming match'
              : 'Try selecting a different date or filter'
          }
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
          colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Premium Header - Feature 3, 5, 6 */}
      <PremiumHeader
        scrollY={scrollY}
        activeFiltersCount={activeFiltersCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterPress={() => setShowFilterModal(true)}
      />

      {/* Date Picker Strip - Feature 7 */}
      <DatePickerStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} scrollY={scrollY} />

      {/* League View Selector - New Features */}
      {activeTab === 'matches' && sortedMatches.length > 0 && (
        <View style={styles.viewSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewSelectorScroll}>
            {[
              { key: 'matches', label: 'Matches', icon: 'football' },
              { key: 'scorers', label: 'Top Scorers', icon: 'trophy' },
              { key: 'assists', label: 'Top Assists', icon: 'football-outline' },
              { key: 'rounds', label: 'Rounds', icon: 'calendar' },
            ].map((view) => (
              <TouchableOpacity
                key={view.key}
                style={[styles.viewButton, leagueView === view.key && styles.activeViewButton]}
                onPress={() => {
                  setLeagueView(view.key as any);
                  if (view.key !== 'matches' && selectedLeagueId) {
                    loadLeagueFeatures(selectedLeagueId);
                  }
                }}
              >
                <Text style={[styles.viewButtonText, leagueView === view.key && styles.activeViewButtonText]}>
                  {view.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* CouponsBar - Feature 13 */}
      {sortedMatches.length > 0 && leagueView === 'matches' && (
        <CouponsBar activeCoupon={activeCoupon} onCouponPress={setActiveCoupon} matchesCount={sortedMatches.length} />
      )}

      {/* Content - Feature 7: FlashList for Performance */}
      {activeTab === 'predictions' ? (
        <AnimatedFlashList
          data={sortedMatches}
          renderItem={renderPredictionCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          // Feature 10: Entry Animations
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      ) : (
        // For matches tab, show different views based on leagueView state
        leagueView === 'matches' ? (
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#3B82F6"
                colors={['#3B82F6']}
              />
            }
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {groupedByLeague.map((group, groupIndex) => (
              <CollapsibleLeagueSection
                key={group.leagueId}
                leagueId={group.leagueId}
                leagueName={group.leagueName}
                leagueLogo={group.leagueLogo}
                matches={group.matches}
                isFavorite={group.isFavorite}
                onFavoriteToggle={handleFavoriteLeagueToggle}
                onMatchPress={handleMatchPress}
                startIndex={groupIndex * 100}
              />
            ))}
          </Animated.ScrollView>
        ) : (
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#3B82F6"
                colors={['#3B82F6']}
              />
            }
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {leagueView === 'scorers' && renderTopScorers()}
            {leagueView === 'assists' && renderTopAssists()}
            {leagueView === 'rounds' && renderRounds()}
          </Animated.ScrollView>
        )
      )}

      {/* Filter Modal - Feature 3 */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleFilterApply}
        initialFilters={filters}
      />

      {/* Premium Bottom Navigation */}
      <View style={[styles.bottomNavContainer, { bottom: insets.bottom }]}>
        <PremiumBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
  },
  viewSelector: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  viewSelectorScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  viewButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
  },
  activeViewButton: {
    backgroundColor: '#3B82F6',
  },
  viewButtonText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  activeViewButtonText: {
    color: '#fff',
  },
  featuresContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  featuresLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyFeatures: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyFeaturesText: {
    color: '#666',
    fontSize: 14,
  },
  scorerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  scorerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scorerRankText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scorerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  scorerInfo: {
    flex: 1,
  },
  scorerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scorerTeam: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  scorerStats: {
    alignItems: 'center',
    marginLeft: 12,
  },
  scorerGoals: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scorerAssists: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scorerLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  roundCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  roundText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LeaguesScreen;
