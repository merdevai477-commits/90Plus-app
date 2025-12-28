import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Import our custom components
import {
  SearchBar,
  MatchCard,
  PredictionSystem,
  StatsHeader,
  FilterModal,
  useHapticFeedback,
  useFadeIn,
  useSlideIn,
  useStagger,
  Prediction,
  UserStats,
  FilterOptions,
} from '../../components/leagues';

// Import API services
import ApiFootballService, { Fixture, Match, MAJOR_LEAGUES } from '../../services/apiFootball';
import PredictionStorage, { StoredPrediction } from '../../services/predictionStorage';
import { useSettings } from '../../contexts/SettingsContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCoins } from '../../contexts/CoinsContext';
import { CoinsBadge } from '../../components/common/CoinsBadge';

const { width, height } = Dimensions.get('window');

// ============================================
// ENHANCED STATS CARD COMPONENT
// ============================================
const StatsCard = ({ iconName, iconFamily = 'Ionicons', label, value, color, trend }: any) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, []);

  const IconComponent = iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons :
    iconFamily === 'FontAwesome5' ? FontAwesome5 : Ionicons;

  return (
    <Animated.View
      style={[
        styles.statsCard,
        {
          transform: [{ scale: scaleAnim }],
          borderLeftColor: color,
        }
      ]}
    >
      <View style={styles.statsCardHeader}>
        <View style={[styles.statsIconContainer, { backgroundColor: `${color}15` }]}>
          <IconComponent name={iconName} size={14} color={color} />
        </View>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: trend > 0 ? '#22c55e15' : '#ef444415' }]}>
            <Ionicons name={trend > 0 ? "trending-up" : "trending-down"} size={9} color={trend > 0 ? "#22c55e" : "#ef4444"} />
            <Text style={[styles.trendText, { color: trend > 0 ? '#22c55e' : '#ef4444' }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </Animated.View>
  );
};

// ============================================
// ENHANCED HEADER WITH LIVE STATS
// ============================================
const Header = ({ liveCount, todayCount, userStats, t }: { liveCount: number; todayCount: number; userStats: UserStats; t: any }) => {
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('down', 600);

  return (
    <Animated.View
      style={[
        styles.header,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.headerContent}>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t.leagues.title}</Text>
            <View style={styles.headerBadges}>
              {liveCount > 0 && (
                <View style={styles.livePulse}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{liveCount} {t.leagues.live}</Text>
                </View>
              )}
              {/* Unified Coins Badge */}
              <CoinsBadge />
            </View>
          </View>
          <Text style={styles.subtitle}>{t.leagues.subtitle}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.headerStatsScroll}
          contentContainerStyle={styles.headerStatsContent}
        >
          <StatsCard
            iconName="pulse"
            iconFamily="Ionicons"
            label={t.leagues.todayMatchesCount}
            value={todayCount}
            color="#3b82f6"
          />
          <StatsCard
            iconName="radio-button-on"
            iconFamily="Ionicons"
            label={t.leagues.predictionAccuracy}
            value={`${userStats.accuracy}%`}
            color="#22c55e"
          />
          <StatsCard
            iconName="trophy"
            iconFamily="Ionicons"
            label={t.leagues.bestStreakCount}
            value={userStats.bestStreak || 0}
            color="#f59e0b"
          />
          <StatsCard
            iconName="flame"
            iconFamily="Ionicons"
            label={t.leagues.currentStreak}
            value={userStats.streak}
            color="#ef4444"
          />
        </ScrollView>
      </View>
    </Animated.View>
  );
};

// ============================================
// ENHANCED TAB SELECTOR
// ============================================
const TabSelector = ({ activeTab, onTabChange, t }: { activeTab: string; onTabChange: (tab: string) => void; t: any }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHapticFeedback();

  // حساب عرض التاب بشكل صحيح
  const containerWidth = width - 40; // العرض الكلي للـ container (minus margins)
  const tabWidth = (containerWidth - 8) / 2; // عرض كل تاب (minus padding)

  useEffect(() => {
    Animated.spring(slideAnim, {
      // Results على اليسار (0)، Predictions على اليمين (tabWidth + 4)
      toValue: activeTab === 'predictions' ? tabWidth + 4 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 9,
    }).start();
  }, [activeTab, tabWidth]);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    haptic.tabSwitch();
    onTabChange(tab);
  };

  return (
    <View style={styles.tabContainer}>
      <Animated.View
        style={[
          styles.tabIndicator,
          {
            width: tabWidth,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      />

      <View style={styles.tabWrapper}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'results' && styles.activeTab]}
          onPress={() => handleTabChange('results')}
          activeOpacity={0.8}
        >
          <View style={{ marginRight: 6 }}>
            <Ionicons name="trophy" size={20} color={activeTab === 'results' ? '#fff' : '#666'} />
          </View>
          <Text style={[styles.tabText, activeTab === 'results' && styles.activeTabText]}>
            {t.leagues.results}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'predictions' && styles.activeTab]}
          onPress={() => handleTabChange('predictions')}
          activeOpacity={0.8}
        >
          <View style={{ marginRight: 6 }}>
            <Ionicons name="radio-button-on" size={20} color={activeTab === 'predictions' ? '#fff' : '#666'} />
          </View>
          <Text style={[styles.tabText, activeTab === 'predictions' && styles.activeTabText]}>
            {t.leagues.predictions}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================
// QUICK FILTERS COMPONENT
// ============================================
const QuickFilters = ({
  activeFilter,
  onFilterChange,
  counts,
  t
}: {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  counts: { live: number; today: number; upcoming: number; top5: number };
  t: any;
}) => {
  const filters = [
    { key: 'today', label: t.leagues.today, iconName: 'calendar', count: counts.today },
    { key: 'live', label: t.leagues.live, iconName: 'flash', count: counts.live, pulse: true },
    { key: 'upcoming', label: t.leagues.upcoming, iconName: 'time', count: counts.upcoming },
    { key: 'top5', label: t.leagues.topLeagues, iconName: 'trophy', count: counts.top5 },
  ];

  const scaleAnims = useRef(
    filters.reduce((acc, filter) => {
      acc[filter.key] = new Animated.Value(1);
      return acc;
    }, {} as { [key: string]: Animated.Value })
  ).current;

  const handleFilterPress = (filterKey: string) => {
    if (filterKey === activeFilter) return;

    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnims[filterKey], {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[filterKey], {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    onFilterChange(filterKey);
  };

  return (
    <View style={styles.quickFiltersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFiltersContent}
        style={{ overflow: 'visible' }}
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;

          return (
            <Animated.View
              key={filter.key}
              style={{
                transform: [{ scale: scaleAnims[filter.key] }]
              }}
            >
              <TouchableOpacity
                style={[styles.quickFilter, isActive && styles.quickFilterActive]}
                onPress={() => handleFilterPress(filter.key)}
                activeOpacity={0.7}
              >
                <View style={{ marginLeft: 2 }}>
                  <Ionicons name={filter.iconName as any} size={16} color={isActive ? '#000' : '#888'} />
                </View>
                <Text style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}>
                  {filter.label}
                </Text>
                {filter.count > 0 && (
                  <View style={[
                    styles.filterBadge,
                    isActive && styles.filterBadgeActive,
                    filter.pulse && styles.filterBadgePulse
                  ]}>
                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                      {filter.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ============================================
// ============================================
// HELPER FUNCTIONS
// ============================================
const formatFixtureDate = (dateString: string, locale: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  // Map app language codes to standard locales if needed
  const localeMap: { [key: string]: string } = {
    'ar': 'ar-EG',
    'en': 'en-US',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'tr': 'tr-TR',
  };

  return date.toLocaleDateString(localeMap[locale] || 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const formatFixtureTime = (dateString: string, locale: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const localeMap: { [key: string]: string } = {
    'ar': 'ar-EG',
    'en': 'en-US',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'tr': 'tr-TR',
  };

  return date.toLocaleTimeString(localeMap[locale] || 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getMatchStatus = (statusShort: string): Match['status'] => {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(statusShort)) {
    return 'live';
  }
  if (['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(statusShort)) {
    return 'finished';
  }
  return 'upcoming';
};

const mapApiFixtureToMatch = (fixture: Fixture, language: string, userPrediction?: StoredPrediction): Match => {
  const status = getMatchStatus(fixture.fixture.status.short);
  const minute = ApiFootballService.getMatchMinute(fixture); // ✅ Get live match minute

  return {
    id: String(fixture.fixture.id),
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    homeScore: fixture.goals.home ?? undefined,
    awayScore: fixture.goals.away ?? undefined,
    homeLogo: fixture.teams.home.logo,
    awayLogo: fixture.teams.away.logo,
    date: formatFixtureDate(fixture.fixture.date, language),
    time: formatFixtureTime(fixture.fixture.date, language),
    status,
    league: fixture.league.name,
    leagueLogo: fixture.league.logo,
    venue: fixture.fixture.venue.name ?? undefined,
    minute: minute || undefined, // ✅ ADD: Live match time for display
    prediction: userPrediction ? {
      type: userPrediction.prediction.type === 'home' ? 'win' :
        userPrediction.prediction.type === 'away' ? 'lose' : 'draw',
      homeScore: userPrediction.prediction.homeScore,
      awayScore: userPrediction.prediction.awayScore,
      points: userPrediction.points,
      isCorrect: userPrediction.status === 'correct',
    } : undefined,
  };
};

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fbbf2415',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf2430',
  },
  coinsBadgeIcon: {
    fontSize: 14,
  },
  coinsBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  header: {
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  headerContent: {
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 20,
  },
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef444415',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  headerStatsScroll: {
    marginTop: 8,
  },
  headerStatsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  statsCard: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 10,
    minWidth: 90,
    borderLeftWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  statsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statsIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 5,
  },
  trendText: {
    fontSize: 8,
    fontWeight: '700',
  },
  statsValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  statsLabel: {
    fontSize: 9,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickFiltersContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  quickFiltersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  quickFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#333',
  },
  quickFilterActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
  },
  quickFilterTextActive: {
    color: '#000',
  },
  filterBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: '#000',
  },
  filterBadgePulse: {
    backgroundColor: '#ef4444',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  tabContainer: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 4,
    marginTop: 8,
    position: 'relative',
  },
  tabWrapper: {
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: '#22c55e',
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 6,
    zIndex: 10,
    minHeight: 44,
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 20,
  },
  activeTabText: {
    color: '#fff',
  },
  matchesContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: '#fecdd3',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  loadingMatches: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingMatchesText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  predictionInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  predictionInfoText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 18,
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  cacheIndicatorText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  leagueHeader: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  leagueHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  leagueHeaderLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  leagueHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  leagueHeaderLine: {
    height: 1,
    backgroundColor: '#333',
    width: '100%',
    opacity: 0.5,
  },
});

// ============================================
// MAIN LEAGUES SCREEN
// ============================================
/**
 * Leagues Screen with Smart Caching System
 * 
 * Performance Optimizations:
 * 1. Single API Request: Fetches all today's matches in ONE request
 * 2. Smart Caching: Caches fixtures for 30 seconds to reduce API calls
 * 3. Filter from Cache: Quick filters use cached data when available
 * 4. Force Refresh: Pull-to-refresh bypasses cache for fresh data
 * 
 * Benefits:
 * - 50% reduction in API requests (1 request instead of 2)
 * - Instant filter switching (no API call needed)
 * - Better user experience (faster loading)
 * - Lower API quota usage (more users can use the app)
 */
const LeaguesScreen = () => {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { coins } = useCoins();

  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(1000);
  const staggerAnimations = useStagger(10, 100);

  // Ref for FlatList to enable smooth scrolling
  const flatListRef = useRef<FlatList>(null);

  // State for matches and fixtures
  const [matches, setMatches] = useState<Match[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'results' | 'predictions'>('results');
  const [quickFilter, setQuickFilter] = useState<string>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);
  const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    status: 'all',
    league: 'all',
    time: 'all',
  });

  // Animation states
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  // Cache state - stores fixtures for 5 minutes to reduce API calls
  const [cachedFixtures, setCachedFixtures] = useState<Fixture[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 300000; // 5 minutes cache (توفير استهلاك API)

  // User predictions and stats state
  const [userPredictions, setUserPredictions] = useState<{ [key: string]: StoredPrediction }>({});
  const [userStats, setUserStats] = useState<UserStats>({
    totalPredictions: 0,
    correctPredictions: 0,
    accuracy: 0,
    streak: 0,
    bestStreak: 0,
    totalPoints: 0,
    rank: 0,
    level: 1,
  });

  const loadUserData = useCallback(async () => {
    try {
      const predictions = await PredictionStorage.getAllPredictions();
      const stats = await PredictionStorage.getUserStats();

      const predictionsMap: { [key: string]: StoredPrediction } = {};
      predictions.forEach(pred => {
        predictionsMap[pred.matchId] = pred;
      });

      setUserPredictions(predictionsMap);
      setUserStats(stats);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, []);

  // Load fixtures from API with caching
  const loadFixtures = useCallback(
    async ({ fromRefresh = false, forceRefresh = false }: { fromRefresh?: boolean; forceRefresh?: boolean } = {}) => {
      const now = Date.now();
      const today = getTodayDate();

      // Check if we can use cached data
      if (!forceRefresh && !fromRefresh && cachedFixtures.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
        console.log('📦 Using cached fixtures');

        // Filter cached fixtures based on current filter
        let filteredFixtures = cachedFixtures;

        if (quickFilter === 'live') {
          filteredFixtures = cachedFixtures.filter(f =>
            ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(f.fixture.status.short)
          );
        } else if (quickFilter === 'upcoming') {
          filteredFixtures = cachedFixtures.filter(f =>
            getMatchStatus(f.fixture.status.short) === 'upcoming'
          );
        } else if (quickFilter === 'top5') {
          const top5Leagues = [39, 140, 78, 135, 61];
          filteredFixtures = cachedFixtures.filter(f => top5Leagues.includes(f.league.id));
        }

        // Apply tab filter
        if (activeTab === 'predictions') {
          filteredFixtures = filteredFixtures.filter(f => {
            const status = f.fixture.status.short;
            return status === 'NS' || status === 'TBD' || getMatchStatus(status) === 'upcoming';
          });
        }

        // Sort and map
        const sortedFixtures = ApiFootballService.sortFixturesByPriority(filteredFixtures);
        setFixtures(sortedFixtures);

        const mappedMatches = sortedFixtures.map(fixture => {
          const matchId = String(fixture.fixture.id);
          const prediction = userPredictions[matchId];
          const minute = ApiFootballService.getMatchMinute(fixture);

          const match = mapApiFixtureToMatch(fixture, language, prediction);
          return {
            ...match,
            minute: minute || undefined,
          };
        });

        setMatches(mappedMatches);

        if (mappedMatches.length === 0) {
          setMatchesError(t.leagues.noMatchesAvailable);
        }

        return;
      }

      // Fetch fresh data
      if (fromRefresh) {
        setRefreshing(true);
      } else {
        setLoadingMatches(true);
      }
      setMatchesError(null);

      try {
        console.log('🌐 Fetching fresh fixtures from API');
        let apiFixtures: Fixture[] = [];

        // Apply quick filters
        if (quickFilter === 'live') {
          apiFixtures = await ApiFootballService.getLiveFixtures();
        } else if (quickFilter === 'top5') {
          apiFixtures = await ApiFootballService.getTop5LeaguesFixtures({ date: today });
        } else if (quickFilter === 'upcoming') {
          const upcomingMatches = await ApiFootballService.getFixturesByDate(today);
          const tomorrowDate = new Date();
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrowMatches = await ApiFootballService.getFixturesByDate(
            tomorrowDate.toISOString().split('T')[0]
          );
          apiFixtures = [
            ...upcomingMatches.filter(f => getMatchStatus(f.fixture.status.short) === 'upcoming'),
            ...tomorrowMatches.filter(f => getMatchStatus(f.fixture.status.short) === 'upcoming'),
          ];
        } else {
          // Default: today's matches - ONE REQUEST for all matches (live + upcoming + finished)
          const todayMatches = await ApiFootballService.getFixturesByDate(today);
          apiFixtures = todayMatches;
        }

        // Remove duplicates
        const uniqueFixtures = apiFixtures.filter((fixture, index, self) =>
          index === self.findIndex(f => f.fixture.id === fixture.fixture.id)
        );

        // Cache the fixtures
        setCachedFixtures(uniqueFixtures);
        setLastFetchTime(now);
        console.log(`✅ Cached ${uniqueFixtures.length} fixtures for 30 seconds`);

        // Filter based on active tab
        let filteredFixtures = uniqueFixtures;
        if (activeTab === 'predictions') {
          filteredFixtures = uniqueFixtures.filter(f => {
            const status = f.fixture.status.short;
            return status === 'NS' || status === 'TBD' || getMatchStatus(status) === 'upcoming';
          });
        }

        // Sort by priority
        const sortedFixtures = ApiFootballService.sortFixturesByPriority(filteredFixtures);
        setFixtures(sortedFixtures);

        // Map to Match objects with predictions
        const mappedMatches = sortedFixtures.map(fixture => {
          const matchId = String(fixture.fixture.id);
          const prediction = userPredictions[matchId];
          const minute = ApiFootballService.getMatchMinute(fixture);

          const match = mapApiFixtureToMatch(fixture, language, prediction);
          return {
            ...match,
            minute: minute || undefined,
          };
        });

        setMatches(mappedMatches);

        if (mappedMatches.length === 0) {
          setMatchesError(t.leagues.noMatchesAvailable);
        }
      } catch (error: any) {
        console.error('Failed to load fixtures:', error);

        // Check if it's a rate limit error
        if (error?.message?.includes('Rate limit') || error?.message?.includes('Too many requests')) {
          setMatchesError('⏳ تم تجاوز الحد المسموح. يرجى الانتظار دقيقة واحدة...');
        } else {
          setMatchesError(error?.message || t.common.errorLoadingMatches);
        }
      } finally {
        if (fromRefresh) {
          setRefreshing(false);
        } else {
          setLoadingMatches(false);
        }
      }
    },
    [activeTab, userPredictions, quickFilter, cachedFixtures, lastFetchTime, CACHE_DURATION, t, language],
  );

  // Initial load
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (Object.keys(userPredictions).length >= 0) {
      loadFixtures();
    }
  }, [activeTab, quickFilter]);

  // 🔄 Smart Polling System
  // Updates live matches every 60 seconds without refreshing the whole list
  useEffect(() => {
    const pollLiveMatches = async () => {
      // 1. Identify live or upcoming matches (starting in 10 mins)
      const now = Date.now();
      const liveOrSoonFixtures = fixtures.filter(f => {
        const status = f.fixture.status.short;
        const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(status);
        const startTime = f.fixture.timestamp * 1000;
        const startsSoon = startTime > now && startTime - now < 10 * 60 * 1000; // 10 mins

        return isLive || startsSoon;
      });

      if (liveOrSoonFixtures.length === 0) {
        // No live matches, no need to poll
        return;
      }

      console.log(`🔄 Smart Polling: Updating ${liveOrSoonFixtures.length} live matches...`);

      try {
        // 2. Fetch all live fixtures (Free plan friendly)
        // Note: Free plan doesn't support 'ids' parameter, so we fetch all live matches
        // and filter them locally.
        const allLiveFixtures = await ApiFootballService.getLiveFixtures();

        // 3. Filter to get only the ones we are interested in (that are in our list)
        const idsToUpdate = liveOrSoonFixtures.map(f => f.fixture.id);
        const updatedFixtures = allLiveFixtures.filter(f => idsToUpdate.includes(f.fixture.id));

        if (updatedFixtures.length > 0) {
          // 4. Merge updates into local state
          setFixtures(currentFixtures => {
            const newFixtures = [...currentFixtures];
            updatedFixtures.forEach(updated => {
              const index = newFixtures.findIndex(f => f.fixture.id === updated.fixture.id);
              if (index !== -1) {
                newFixtures[index] = updated;
              }
            });
            return newFixtures;
          });

          // Also update matches state
          setMatches(currentMatches => {
            const newMatches = [...currentMatches];
            updatedFixtures.forEach(updated => {
              const matchId = String(updated.fixture.id);
              const index = newMatches.findIndex(m => m.id === matchId);
              if (index !== -1) {
                const prediction = userPredictions[matchId];
                const minute = ApiFootballService.getMatchMinute(updated);
                const updatedMatch = mapApiFixtureToMatch(updated, language, prediction);
                newMatches[index] = { ...updatedMatch, minute: minute || undefined };
              }
            });
            return newMatches;
          });

          console.log('✅ Smart Polling: Updates merged successfully');
        } else {
          console.log('ℹ️ Smart Polling: No updates needed (no matching live fixtures)');
        }
      } catch (error) {
        console.error('❌ Smart Polling failed:', error);
      }
    };

    // Poll every 60 seconds if there are live matches
    const interval = setInterval(pollLiveMatches, 60000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fixtures, userPredictions, language]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    haptic.search();
  };

  const handleMatchPress = useCallback((match: Match) => {
    haptic.tabSwitch();
    const fixture = fixtures.find(f => String(f.fixture.id) === match.id);
    if (!fixture) {
      console.error('❌ Fixture not found for match:', match.id);
      return;
    }

    console.log('🏁 Opening match details for fixture ID:', fixture.fixture.id);

    router.push({
      pathname: '/(tabs)/match-details',
      params: {
        fixtureId: String(fixture.fixture.id), // ✅ FIX: Use numeric fixture.id from API
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeLogo: match.homeLogo,
        awayLogo: match.awayLogo,
        homeScore: match.homeScore?.toString() || '',
        awayScore: match.awayScore?.toString() || '',
        league: match.league,
        leagueLogo: match.leagueLogo || '',
        date: match.date,
        time: match.time,
        status: match.status,
      },
    });
  }, [fixtures, router, haptic]);


  const handlePredictionSubmit = async (matchId: string, prediction: any) => {
    try {
      console.log('📥 Received prediction:', prediction);
      console.log('📥 Prediction type:', prediction.type);

      haptic.predictionSubmit();

      const fixture = fixtures.find(f => String(f.fixture.id) === matchId);
      if (!fixture) return;

      const storedPrediction: StoredPrediction = {
        id: `pred_${matchId}_${Date.now()}`,
        matchId,
        fixtureId: fixture.fixture.id,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        prediction: {
          type: prediction.type === 'home' ? 'home' :
            prediction.type === 'away' ? 'away' : 'draw',
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
        },
        timestamp: Date.now(),
        status: 'pending',
      };

      console.log('💾 Stored prediction:', storedPrediction.prediction);

      await PredictionStorage.savePrediction(storedPrediction);
      await loadUserData();
      await loadFixtures();
    } catch (error) {
      console.error('Error submitting prediction:', error);
    }
  };

  const handleRefresh = useCallback(async () => {
    haptic.refresh();
    await loadUserData();
    await loadFixtures({ fromRefresh: true, forceRefresh: true }); // Force refresh to bypass cache
  }, [haptic, loadFixtures, loadUserData]);

  // ============================================
  // LEAGUE GROUPING LOGIC
  // ============================================
  const groupMatchesByLeague = (matches: Match[]) => {
    const groups: { [key: string]: Match[] } = {};
    const leagueInfo: { [key: string]: { name: string; logo: string; id: number } } = {};

    // 1. Group by league
    matches.forEach(match => {
      if (!groups[match.league]) {
        groups[match.league] = [];
        // Find fixture to get league ID (we need to optimize this mapping later)
        const fixture = fixtures.find(f => String(f.fixture.id) === match.id);
        leagueInfo[match.league] = {
          name: match.league,
          logo: match.leagueLogo || '',
          id: fixture?.league.id || 0
        };
      }
      groups[match.league].push(match);
    });

    // 2. Convert to sections array
    const sections = Object.keys(groups).map(leagueName => ({
      title: leagueName,
      logo: leagueInfo[leagueName].logo,
      id: leagueInfo[leagueName].id,
      data: groups[leagueName]
    }));

    // 3. Sort sections by priority
    // ترتيب الدوريات من الأكثر أهمية للأقل أهمية
    // Priority: Champions League > Top 5 Leagues > Other Major Leagues > Others

    // ترتيب الدوريات الكبرى بشكل واضح ومحدد
    const leaguePriorityOrder = [
      // دوري أبطال أوروبا (الأعلى أهمية)
      MAJOR_LEAGUES.CHAMPIONS_LEAGUE,      // 2
      // الدوريات الخمسة الكبرى
      MAJOR_LEAGUES.PREMIER_LEAGUE,        // 39
      MAJOR_LEAGUES.LA_LIGA,               // 140
      MAJOR_LEAGUES.BUNDESLIGA,            // 78
      MAJOR_LEAGUES.SERIE_A,               // 135
      MAJOR_LEAGUES.LIGUE_1,               // 61
    ];

    return sections.sort((a, b) => {
      // الحصول على موقع كل دوري في ترتيب الأولوية
      const aIndex = leaguePriorityOrder.indexOf(a.id);
      const bIndex = leaguePriorityOrder.indexOf(b.id);

      // إذا كان كلاهما في قائمة الأولوية، رتبهم حسب الترتيب المحدد
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // إذا كان واحد فقط في قائمة الأولوية، اجعله في الأعلى
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // باقي الدوريات: رتبهم أبجدياً
      return a.title.localeCompare(b.title);
    });
  };

  // ============================================
  // LEAGUE HEADER COMPONENT
  // ============================================
  const LeagueHeader = ({ title, logo }: { title: string; logo: string }) => (
    <View style={styles.leagueHeader}>
      <View style={styles.leagueHeaderContent}>
        {logo ? <Image source={{ uri: logo }} style={styles.leagueHeaderLogo} /> : null}
        <Text style={styles.leagueHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.leagueHeaderLine} />
    </View>
  );

  // ============================================
  // LEAGUE ACCORDION ITEM COMPONENT
  // ============================================
  const LeagueAccordionItem = ({
    league,
    matches,
    isExpanded,
    onToggle,
    onMatchPress,
    onPredictionSubmit,
    userPredictions,
    activeTab
  }: {
    league: { id: string; name: string; logo: string; country: string };
    matches: Match[];
    isExpanded: boolean;
    onToggle: () => void;
    onMatchPress: (match: Match) => void;
    onPredictionSubmit: (matchId: string, prediction: any) => Promise<void>;
    userPredictions: { [key: string]: StoredPrediction };
    activeTab: string;
  }) => {
    return (
      <View>
        <TouchableOpacity
          style={styles.leagueHeader}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View style={styles.leagueHeaderContent}>
            {league.logo ? <Image source={{ uri: league.logo }} style={styles.leagueHeaderLogo} /> : null}
            <Text style={styles.leagueHeaderTitle}>{league.name}</Text>
            <View style={{ marginLeft: 8, flex: 1, alignItems: 'flex-end' }}>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#888"
              />
            </View>
          </View>
          <View style={styles.leagueHeaderLine} />
        </TouchableOpacity>

        {isExpanded && matches.map((match, index) => (
          <Animated.View
            key={match.id}
            style={{
              opacity: staggerAnimations[index % 10] || 1,
              transform: [
                {
                  translateY: staggerAnimations[index % 10]?.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }) || 0
                }
              ]
            }}
          >
            <MatchCard
              match={match}
              onPredictionSubmit={onPredictionSubmit}
              showPrediction={activeTab === 'predictions'}
              userPredictions={userPredictions}
              onPress={() => onMatchPress(match)}
            />
          </Animated.View>
        ))}
      </View>
    );
  };

  useEffect(() => {
    // Animate content when tab or filter changes
    Animated.sequence([
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(contentOpacity, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeTab, quickFilter]);

  // Filter matches with improved search
  const filteredMatches = matches.filter(match => {
    const fixture = fixtures.find(f => String(f.fixture.id) === match.id);

    // في تاب التوقعات: فقط المباريات القادمة اللي لسه ما بدأتش
    if (activeTab === 'predictions') {
      // فقط المباريات اللي لسه ما بدأتش (upcoming)
      if (match.status !== 'upcoming') {
        return false;
      }

      // تأكد إن المباراة ما عندهاش نتيجة (لسه ما بدأتش)
      if (match.homeScore !== undefined || match.awayScore !== undefined) {
        return false;
      }
    }

    // Search Query Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch =
        match.homeTeam.toLowerCase().includes(query) ||
        match.awayTeam.toLowerCase().includes(query) ||
        match.league.toLowerCase().includes(query) ||
        (fixture?.league.country?.toLowerCase().includes(query)) ||
        (fixture?.teams.home.name?.toLowerCase().includes(query)) ||
        (fixture?.teams.away.name?.toLowerCase().includes(query));

      if (!matchesSearch) return false;
    }

    // Advanced Filter Options (من FilterModal)
    if (filterOptions.continent && filterOptions.continent !== 'all') {
      // يمكن إضافة منطق القارة هنا إذا كان الـ API يدعمها
      // حالياً نتجاهلها لأن API-Football مش بيرجع القارة مباشرة
    }

    if (filterOptions.country && filterOptions.country !== 'all') {
      if (!fixture?.league.country) return false;

      const countryMap: { [key: string]: string[] } = {
        'england': ['england', 'united kingdom', 'uk'],
        'spain': ['spain', 'españa'],
        'germany': ['germany', 'deutschland'],
        'italy': ['italy', 'italia'],
        'france': ['france'],
        'egypt': ['egypt', 'مصر'],
        'saudi': ['saudi arabia', 'السعودية'],
      };

      const selectedCountryNames = countryMap[filterOptions.country] || [filterOptions.country];
      const fixtureCountry = fixture.league.country.toLowerCase();

      if (!selectedCountryNames.some(name => fixtureCountry.includes(name))) {
        return false;
      }
    }

    // Status Filter
    if (filterOptions.status && filterOptions.status !== 'all') {
      const status = match.status;
      if (filterOptions.status === 'live' && status !== 'live') return false;
      if (filterOptions.status === 'finished' && status !== 'finished') return false;
      if (filterOptions.status === 'upcoming' && status !== 'upcoming') return false;
    }

    // Time Filter
    if (filterOptions.time && filterOptions.time !== 'all') {
      const matchDate = new Date(match.date + ' ' + match.time);
      const hour = matchDate.getHours();

      if (filterOptions.time === 'morning' && (hour < 5 || hour >= 12)) return false;
      if (filterOptions.time === 'afternoon' && (hour < 12 || hour >= 18)) return false;
      if (filterOptions.time === 'evening' && (hour < 18 && hour >= 5)) return false;
    }

    if (filterOptions.league && filterOptions.league !== 'all') {
      if (!fixture?.league.name) return false;

      const leagueMap: { [key: string]: string[] } = {
        'premier-league': ['premier league', 'epl'],
        'la-liga': ['la liga', 'laliga'],
        'bundesliga': ['bundesliga'],
        'serie-a': ['serie a'],
        'ligue-1': ['ligue 1'],
        'champions-league': ['champions league', 'uefa champions'],
      };

      const selectedLeagueNames = leagueMap[filterOptions.league] || [filterOptions.league];
      const fixtureLeague = fixture.league.name.toLowerCase();

      if (!selectedLeagueNames.some(name => fixtureLeague.includes(name))) {
        return false;
      }
    }

    // Selected Leagues Filter (القديم)
    if (selectedLeagues.length > 0) {
      if (fixture && !selectedLeagues.includes(fixture.league.id)) {
        return false;
      }
    }

    return true;
  });

  // Convert predictions for PredictionSystem component
  const predictionsList: Prediction[] = Object.values(userPredictions).map(pred => ({
    id: pred.id,
    matchId: pred.matchId,
    userId: 'current_user',
    type: pred.prediction.type === 'home' ? 'win' :
      pred.prediction.type === 'away' ? 'lose' : 'draw',
    homeScore: pred.prediction.homeScore,
    awayScore: pred.prediction.awayScore,
    points: pred.points || 0,
    isCorrect: pred.status === 'correct',
    submittedAt: new Date(pred.timestamp),
  }));


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <Header
        liveCount={matches.filter(m => m.status === 'live').length}
        todayCount={matches.length}
        userStats={userStats}
        t={t}
      />

      <SearchBar
        onSearch={handleSearch}
        placeholder={t.leagues.searchPlaceholder}
        onFilterPress={() => setShowFilterModal(true)}
      />

      <QuickFilters
        activeFilter={quickFilter}
        onFilterChange={setQuickFilter}
        counts={{
          live: matches.filter(m => m.status === 'live').length,
          today: matches.length,
          upcoming: matches.filter(m => m.status === 'upcoming').length,
          top5: matches.filter(m => {
            const fixture = fixtures.find(f => String(f.fixture.id) === m.id);
            return fixture && [39, 140, 78, 135, 61].includes(fixture.league.id);
          }).length,
        }}
        t={t}
      />

      <TabSelector
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'results' | 'predictions')}
        t={t}
      />

      {matchesError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#fda4af" />
          <Text style={styles.errorText}>{matchesError}</Text>
        </View>
      )}

      {/* Cache Indicator - shows when using cached data */}
      {!loadingMatches && !refreshing && cachedFixtures.length > 0 && (Date.now() - lastFetchTime) < CACHE_DURATION && (
        <View style={styles.cacheIndicator}>
          <Ionicons name="flash" size={12} color="#22c55e" />
          <Text style={styles.cacheIndicatorText}>
            {t.leagues.usingCache}
          </Text>
        </View>
      )}

      <Animated.View
        style={{
          flex: 1,
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslateY }]
        }}
      >
        <FlatList
          ref={flatListRef as any}
          data={groupMatchesByLeague(filteredMatches)}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item: section }) => {
            // Get country from first match's fixture
            const firstMatchFixture = fixtures.find(f => String(f.fixture.id) === section.data[0]?.id);
            return (
              <LeagueAccordionItem
                league={{
                  id: String(section.id),
                  name: section.title,
                  logo: section.logo,
                  country: firstMatchFixture?.league?.country || '',
                }}
                matches={section.data}
                isExpanded={expandedLeagueId === String(section.id)}
                onToggle={() => {
                  setExpandedLeagueId(
                    expandedLeagueId === String(section.id) ? null : String(section.id)
                  );
                }}
                onMatchPress={handleMatchPress}
                onPredictionSubmit={handlePredictionSubmit}
                userPredictions={userPredictions}
                activeTab={activeTab}
              />
            );
          }}
          ListEmptyComponent={
            !loadingMatches ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name={activeTab === 'predictions' ? "radio-button-on" : "trophy"}
                  size={64}
                  color="#666"
                />
                <Text style={styles.emptyStateTitle}>
                  {activeTab === 'predictions' ? t.predictions.noPredictableMatches : t.leagues.noMatches}
                </Text>
                <Text style={styles.emptyStateText}>
                  {activeTab === 'predictions'
                    ? t.predictions.noPredictableMatches
                    : searchQuery
                      ? t.leagues.noMatchesFound
                      : t.leagues.noMatchesAvailable}
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.matchesContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#22c55e"
              colors={['#22c55e']}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={5}
          scrollEventThrottle={16}
          decelerationRate="normal"
        />
      </Animated.View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={(filters) => {
          setFilterOptions(filters);
          setShowFilterModal(false);
        }}
        currentFilters={filterOptions}
      />
    </View>
  );
};

export default LeaguesScreen;
