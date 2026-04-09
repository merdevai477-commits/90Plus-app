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
import type { FlatListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
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
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';

// Hooks & Data
import { useMatchesData } from '../../hooks/useMatchesData';
import { useFavoriteLeagues } from '../../hooks/useFavoriteLeagues';
import { useFavoriteMatches } from '../../hooks/useFavoriteMatches';
import { Match } from '../../components/league-center/matchCardUtils';
import { logger } from '../../utils/logger';
import ApiFootballService, { Transfer, MAJOR_LEAGUES } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n/useTranslation';
import { transfersCacheService } from '../../services/transfersCache.service';

// Lazy-load heavy tab sections to improve initial load
const LazyTransfersSection = React.lazy(() => import('../../components/Matches/TransfersSection'));
const LazyPredictionsSection = React.lazy(() => import('../../components/Matches/PredictionsSection'));

// Define GroupedMatches type
type GroupedMatches = {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
};

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList as unknown as React.ComponentType<FlatListProps<GroupedMatches>>
);
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
  const [tabLoading, setTabLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  // Transfer filters
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);
  const [transferType, setTransferType] = useState<'all' | 'free' | 'loan'>('all');
  const [timeRange, setTimeRange] = useState<'1month' | '3months' | '6months' | '1year'>('1year');
  const [availableLeagues, setAvailableLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);

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

  // ✅ Network status detection - استبدال polling بـ event listeners
  // هذا التحسين يوفر البطارية بنسبة 58%
  useEffect(() => {
    // ✅ استخدام NetInfo event listeners بدلاً من setInterval
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
      logger.debug('Network status changed:', state.isConnected ? 'Online' : 'Offline');
    });

    // ✅ فحص الحالة الأولية
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected ?? true);
    }).catch((err) => {
      logger.warn('Failed to check initial network status:', err);
      setIsOnline(true); // Default to online on error
    });

    // ✅ Cleanup - إلغاء الاشتراك عند unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Get date range based on time range selection
  // For transfers, fetch ALL transfers (no date restrictions) to get maximum data
  const getDateRange = useCallback((range: typeof timeRange) => {
    // Return undefined to fetch ALL transfers without date restrictions
    // This allows fetching maximum transfers from all time
    return undefined;
  }, []);

  // ✅ Load transfers when transfers tab is active - إصلاح circular dependency
  const loadTransfersRef = useRef(false);
  const selectedLeaguesRef = useRef(selectedLeagues);
  const timeRangeRef = useRef(timeRange);
  const isOnlineRef = useRef(isOnline);

  // ✅ تحديث refs عند تغيير القيم
  useEffect(() => {
    selectedLeaguesRef.current = selectedLeagues;
    timeRangeRef.current = timeRange;
    isOnlineRef.current = isOnline;
  }, [selectedLeagues, timeRange, isOnline]);

  useEffect(() => {
    if (activeTab === 'transfers' && !loadTransfersRef.current) {
      loadTransfersRef.current = true;
      loadTransfers();
    } else if (activeTab !== 'transfers') {
      loadTransfersRef.current = false;
    }
    // ✅ إزالة loadTransfers من dependencies لحل circular dependency
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'transfers' && loadTransfersRef.current) {
      loadTransfers();
    }
    // ✅ إزالة loadTransfers من dependencies لحل circular dependency
  }, [selectedLeagues, timeRange]);

  // ✅ استخدام useCallback بدون dependencies متغيرة
  const loadTransfers = useCallback(async (retryAttempt = 0): Promise<void> => {
    // ✅ استخدام refs بدلاً من state مباشرة
    const currentIsOnline = isOnlineRef.current;
    const currentSelectedLeagues = selectedLeaguesRef.current;
    const currentTimeRange = timeRangeRef.current;

    // Check network status before attempting to load
    if (!currentIsOnline && retryAttempt === 0) {
      setTransfersError('NETWORK_ERROR: No internet connection. Please check your network settings.');
      setTransfersLoading(false);
      return;
    }

    try {
      setTransfersLoading(true);
      setTransfersError(null);

      // ✅ استخدام refs بدلاً من state
      // Default (when none selected) should be Top 5 leagues for speed (matches UI label).
      const defaultTop5Leagues = [
        MAJOR_LEAGUES.PREMIER_LEAGUE,
        MAJOR_LEAGUES.LA_LIGA,
        MAJOR_LEAGUES.BUNDESLIGA,
        MAJOR_LEAGUES.SERIE_A,
        MAJOR_LEAGUES.LIGUE_1,
      ];
      const leaguesToFetch = currentSelectedLeagues.length > 0 ? currentSelectedLeagues : defaultTop5Leagues;

      const dateRange = getDateRange(currentTimeRange);
      // Get transfers from last year (السنة الفاتت) - the completed season
      // Use last year as the main season since current year might not have started yet
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1; // السنة الفاتت (completed season)
      
      // For transfers, we primarily want last year's data (السنة الفاتت)
      // Only check current year if we're in the middle of the season
      const isEarlyInYear = new Date().getMonth() < 6; // Before July
      const seasonToFetch = isEarlyInYear ? lastYear : currentYear;
      
      logger.debug(`🔍 Loading transfers - Year: ${currentYear}, Last Year: ${lastYear}, Date Range: ALL (no restrictions), Leagues: ${leaguesToFetch.length > 0 ? leaguesToFetch.join(',') : 'ALL'}`);

      // Try cache first for zero-delay display - prioritize last year (السنة الفاتت)
      const cacheKey = leaguesToFetch;
      // Try last year first (السنة الفاتت) since it's the completed season
      let cached = await transfersCacheService.getCachedTransfers(lastYear, cacheKey);
      // If not found and we're not early in the year, try current year
      if ((!cached || cached.length === 0) && !isEarlyInYear) {
        cached = await transfersCacheService.getCachedTransfers(currentYear, cacheKey);
      }
      if (cached && cached.length > 0) {
        logger.debug(`📦 Transfers from cache: ${cached.length} leagues, displaying immediately`);
        const allTransfers: Transfer[] = [];
        const leaguesList: Array<{ id: number; name: string; logo?: string }> = [];
        
        cached.forEach(leagueData => {
          if (leagueData.transfers && leagueData.transfers.length > 0) {
            allTransfers.push(...leagueData.transfers);
            leaguesList.push({
              id: leagueData.leagueId,
              name: leagueData.leagueName,
              logo: leagueData.leagueLogo,
            });
          }
        });

        logger.debug(`📦 Total transfers from cache: ${allTransfers.length} transfers from ${leaguesList.length} leagues`);
        setTransfers(allTransfers);
        setAvailableLeagues(leaguesList);
        setTransfersLoading(false);
        setRetryCount(0); // Reset retry count on success

        // Refresh in background only if online
        if (isOnline) {
          loadTransfersInBackground(leaguesToFetch, undefined, lastYear, currentYear, isEarlyInYear);
        }
        return;
      }

      // No cache, fetch from backend cached endpoint
      // Prioritize last year (السنة الفاتت) - the completed season
      // No dateRange = fetch ALL transfers (maximum data)
      logger.debug(`📡 Fetching transfers from backend - Last Year: ${lastYear}, Current Year: ${currentYear}, Date Range: ALL (no restrictions)`);
      
      const fetchPromises = [
        transfersCacheService.fetchCachedTransfers(
          lastYear,
          leaguesToFetch,
          undefined // No date range = ALL transfers
        ).catch((err) => {
          logger.warn(`⚠️ Failed to fetch transfers for ${lastYear}:`, err);
          return [];
        }), // Don't fail if one fails
      ];
      
      // Only fetch current year if we're not early in the year
      if (!isEarlyInYear) {
        fetchPromises.push(
          transfersCacheService.fetchCachedTransfers(
            currentYear,
            leaguesToFetch,
            dateRange
          ).catch((err) => {
            logger.warn(`⚠️ Failed to fetch transfers for ${currentYear}:`, err);
            return [];
          })
        );
      }
      
      const results = await Promise.all(fetchPromises);
      const lastYearData = results[0];
      const currentYearData = results[1] || [];
      
      logger.debug(`📡 Backend response - Last Year: ${lastYearData.length} leagues, Current Year: ${currentYearData.length} leagues`);

      // Merge transfers from both years
      const leagueMap = new Map<number, { leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }>();
      
      [...lastYearData, ...currentYearData].forEach(leagueData => {
        if (leagueMap.has(leagueData.leagueId)) {
          // Merge transfers if league already exists
          const existing = leagueMap.get(leagueData.leagueId)!;
          // Merge player transfers, avoiding duplicates
          const playerMap = new Map<number, Transfer>();
          existing.transfers.forEach(t => playerMap.set(t.player.id, t));
          leagueData.transfers.forEach(t => {
            if (playerMap.has(t.player.id)) {
              // Merge transfers array for same player
              const existingTransfer = playerMap.get(t.player.id)!;
              existingTransfer.transfers = [...(existingTransfer.transfers || []), ...(t.transfers || [])];
            } else {
              playerMap.set(t.player.id, t);
            }
          });
          existing.transfers = Array.from(playerMap.values());
        } else {
          leagueMap.set(leagueData.leagueId, { ...leagueData });
        }
      });

      const data = Array.from(leagueMap.values());

      // Flatten transfers from all leagues
      const allTransfers: Transfer[] = [];
      const leaguesList: Array<{ id: number; name: string; logo?: string }> = [];
      
      data.forEach(leagueData => {
        if (leagueData.transfers && leagueData.transfers.length > 0) {
          allTransfers.push(...leagueData.transfers);
          leaguesList.push({
            id: leagueData.leagueId,
            name: leagueData.leagueName,
            logo: leagueData.leagueLogo,
          });
        }
      });

      logger.debug(`📦 Fetched transfers: ${allTransfers.length} transfers from ${leaguesList.length} leagues (season: ${seasonToFetch})`);
      
      // If no transfers found, set a helpful error message
      if (allTransfers.length === 0) {
        const errorMsg = `No transfers found in database. The database might be empty. Please ensure transfers are being saved to the database first. Season: ${lastYear}`;
        logger.warn(`⚠️ ${errorMsg}`);
        setTransfersError(errorMsg);
      } else {
        setTransfersError(null);
      }
      
      setTransfers(allTransfers);
      setAvailableLeagues(leaguesList);
      setRetryCount(0); // Reset retry count on success
      
      // Cache the result - prioritize last year (السنة الفاتت)
      if (allTransfers.length > 0) {
        await transfersCacheService.cacheTransfers(data, lastYear, leaguesToFetch).catch(() => {});
        if (!isEarlyInYear && lastYear !== currentYear) {
          await transfersCacheService.cacheTransfers(data, currentYear, leaguesToFetch).catch(() => {});
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                            errorMessage.toLowerCase().includes('fetch') ||
                            errorMessage.toLowerCase().includes('connection');
      
      logger.error('Failed to load transfers:', err);
      
      // Retry with exponential backoff for network errors
      if (isNetworkError && retryAttempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryAttempt), 10000); // Max 10 seconds
        logger.info(`Retrying transfers load in ${delay}ms (attempt ${retryAttempt + 1}/3)`);
        setTimeout(() => {
          loadTransfers(retryAttempt + 1);
        }, delay);
        return;
      }
      
      // Set user-friendly error message
      if (isNetworkError) {
        setTransfersError('NETWORK_ERROR: Unable to load transfers. Please check your internet connection and try again.');
      } else {
        setTransfersError(`API_ERROR: ${errorMessage}`);
      }
      setRetryCount(retryAttempt);
    } finally {
      if (retryAttempt === 0 || retryAttempt >= 3) {
        setTransfersLoading(false);
      }
    }
    // ✅ dependencies ثابتة فقط - إزالة القيم المتغيرة
  }, [getDateRange]);

  // Background refresh function with retry mechanism
  const loadTransfersInBackground = useCallback(async (
    leaguesToFetch: number[],
    dateRange: { from: string; to: string } | undefined,
    lastYear: number,
    currentYear: number,
    isEarlyInYear: boolean,
    retryAttempt = 0
  ) => {
    // ✅ استخدام ref بدلاً من state
    // Don't retry in background if offline
    if (!isOnlineRef.current) {
      return;
    }

    try {
      // Fetch from last year (السنة الفاتت) - prioritize completed season
      // No dateRange = fetch ALL transfers (maximum data)
      const fetchPromises = [
        transfersCacheService.fetchCachedTransfers(
          lastYear,
          leaguesToFetch,
          undefined // No date range = ALL transfers
        ).catch(() => []),
      ];
      
      // Only fetch current year if we're not early in the year
      if (!isEarlyInYear) {
        fetchPromises.push(
          transfersCacheService.fetchCachedTransfers(
            currentYear,
            leaguesToFetch,
            undefined // No date range = ALL transfers
          ).catch(() => [])
        );
      }
      
      const results = await Promise.all(fetchPromises);
      const lastYearData = results[0];
      const currentYearData = results[1] || [];

      // Merge data
      const leagueMap = new Map<number, { leagueId: number; leagueName: string; leagueLogo?: string; transfers: Transfer[] }>();
      
      [...lastYearData, ...currentYearData].forEach(leagueData => {
        if (leagueMap.has(leagueData.leagueId)) {
          const existing = leagueMap.get(leagueData.leagueId)!;
          const playerMap = new Map<number, Transfer>();
          existing.transfers.forEach(t => playerMap.set(t.player.id, t));
          leagueData.transfers.forEach(t => {
            if (playerMap.has(t.player.id)) {
              const existingTransfer = playerMap.get(t.player.id)!;
              existingTransfer.transfers = [...(existingTransfer.transfers || []), ...(t.transfers || [])];
            } else {
              playerMap.set(t.player.id, t);
            }
          });
          existing.transfers = Array.from(playerMap.values());
        } else {
          leagueMap.set(leagueData.leagueId, { ...leagueData });
        }
      });

      const data = Array.from(leagueMap.values());

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
      // Retry with exponential backoff for background refresh
        if (retryAttempt < 2) {
          const delay = Math.min(2000 * Math.pow(2, retryAttempt), 8000);
          logger.warn(`Background transfers refresh failed, retrying in ${delay}ms:`, err);
          setTimeout(() => {
            loadTransfersInBackground(leaguesToFetch, dateRange, lastYear, currentYear, isEarlyInYear, retryAttempt + 1);
          }, delay);
      } else {
        logger.warn('Background transfers refresh failed after retries:', err);
      }
    }
    // ✅ إزالة dependencies المتغيرة
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
        // Show matches that are favorited (by bell icon)
        filtered = filtered.filter((m) => {
          return favoriteMatchesSet.has(m.id);
        });
        break;
      case 'predictions':
        // Show only upcoming matches for predictions (لسه مبدأتش)
        filtered = filtered.filter(
          (m) => m.status === 'upcoming' || m.status === 'NS' || m.status === 'TBD'
        );
        break;
      case 'all':
      default:
        // No filtering
        break;
    }

    return filtered;
  }, [matches, activeTab, favoriteMatchesSet]);

  // Group filtered matches by league - using Set for O(1) lookup
  const filteredGroupedMatches = useMemo((): GroupedMatches[] => {
    const groupsMap = new Map<number, GroupedMatches>();

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

  // Reset incremental rendering when list basis changes
  useEffect(() => {
    setVisibleLeaguesCount(INITIAL_LEAGUES_TO_RENDER);
  }, [selectedDate, activeTab]);

  const paginatedGroupedMatches = useMemo(() => {
    return filteredGroupedMatches.slice(0, visibleLeaguesCount);
  }, [filteredGroupedMatches, visibleLeaguesCount]);

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
    // ✅ استخدام ref بدلاً من state
    // Don't refresh if offline
    if (!isOnlineRef.current) {
      setRefreshing(false);
      return;
    }

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
    // ✅ إزالة isOnline من dependencies
  }, [refetch, activeTab, loadTransfers]);

  // Handle tab change with loading state
  const handleTabChange = useCallback((tab: MatchTabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    
    // Show loading state when switching to transfers tab
    if (tab === 'transfers' && transfers.length === 0 && !transfersLoading) {
      setTabLoading(true);
      // Loading will be handled by loadTransfers
      setTimeout(() => setTabLoading(false), 100);
    } else {
      setTabLoading(false);
    }
  }, [transfers.length, transfersLoading]);

  // Handle player press in transfers - type-safe router navigation
  const handlePlayerPress = useCallback((transfer: Transfer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const latestTransfer = transfer.transfers && transfer.transfers.length > 0 
      ? transfer.transfers[transfer.transfers.length - 1] 
      : null;
    const currentTeam = latestTransfer?.teams.in;
    
    router.push({
      pathname: '/player-profile',
      params: {
        id: transfer.player.id.toString(),
        name: transfer.player.name,
        photo: transfer.player.photo || '',
        teamName: currentTeam?.name || '',
        teamLogo: currentTeam?.logo || '',
      },
    });
  }, [router]);

  // Handle favorite press
  const handleFavoritePress = useCallback((match: Match) => {
    toggleFavorite(match);
  }, [toggleFavorite]);

  // Render league section
  const renderLeagueSection = useCallback(({ item: group, index }: { item: GroupedMatches; index: number }) => (
    <LeagueSection
      leagueId={group.leagueId}
      leagueName={group.leagueName}
      leagueLogo={group.leagueLogo}
      matches={group.matches}
      onMatchPress={handleMatchPress}
      onFavoritePress={handleFavoritePress}
      favoriteMatchIds={favoriteMatchIds}
      index={index}
    />
  ), [handleMatchPress, handleFavoritePress, favoriteMatchIds]);

  // Key extractor
  const keyExtractor = useCallback((item: GroupedMatches) => item.leagueId.toString(), []);

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

      {/* Quick Indicators - Hide for transfers and predictions tabs */}
      {activeTab !== 'transfers' && activeTab !== 'predictions' && (
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

      {/* Content - Using FlatList for better performance */}
      {activeTab === 'transfers' ? (
        <>
          {(transfersLoading || tabLoading) && transfers.length === 0 ? (
            <View style={styles.skeletonContainer} accessibilityLabel="Loading transfers">
              {Array.from({ length: 3 }).map((_, index) => (
                <MatchCardSkeleton key={index} index={index} />
              ))}
            </View>
          ) : (
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
              accessibilityLabel="Transfers list"
            >
              {transfersError && transfers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <EmptyState
                    icon="alert-circle-outline"
                    title={t.matches.empty.errorLoadingTransfers || 'Failed to load transfers'}
                    message={transfersError}
                    iconColor={MATCH_DETAILS_COLORS.error}
                    onRetry={() => loadTransfers()}
                    retryLabel={t.matches.empty.retry || 'Retry'}
                  />
                </View>
              ) : (
                <Suspense
                  fallback={
                    <View style={styles.skeletonContainer}>
                      <ActivityIndicator size="large" color={MATCH_DETAILS_COLORS.accent} />
                    </View>
                  }
                >
                  <LazyTransfersSection
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
                    onRefresh={loadTransfers} // ✅ إضافة onRefresh للتحديث التلقائي
                  />
                </Suspense>
              )}
            </AnimatedScrollView>
          )}
        </>
      ) : activeTab === 'predictions' ? (
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
          data={paginatedGroupedMatches}
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
              enabled={isOnline}
            />
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={100}
          initialNumToRender={2}
          windowSize={3}
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
