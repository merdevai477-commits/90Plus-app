import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  FlatList,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDebouncedCallback } from 'use-debounce';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import ApiFootballService, { Transfer, TransfersByLeague, MAJOR_LEAGUES } from '../services/apiFootball';
import { useTranslation } from '../src/i18n';
import { TransferCardSkeleton } from '../components/Transfers/TransferCardSkeleton';
import { FiltersModal, TransferFilters } from '../components/Transfers/FiltersModal';
import { TransfersCharts } from '../components/Transfers/TransfersCharts';
import { TopLists } from '../components/Transfers/TopLists';
import { TransferDetailsModal } from '../components/Transfers/TransferDetailsModal';
// Example: Import user action tracker for Sentry breadcrumbs
// import { useUserActionTracker } from '../utils/userActionTracker';

const TRANSFERS_STORAGE_KEY = 'cached_transfers';
const TRANSFERS_TIMESTAMP_KEY = 'cached_transfers_timestamp';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'value-desc' | 'value-asc' | 'age-asc' | 'age-desc';

// Memoized Transfer Card Component
const TransferCard = React.memo(({ 
  transfer, 
  index,
  onPlayerPress,
  onTeamPress,
}: { 
  transfer: Transfer; 
  index: number;
  onPlayerPress?: (transfer: Transfer) => void;
  onTeamPress?: (teamId: number) => void;
}) => (
  <View style={styles.transferCard}>
    <View style={styles.transferHeader}>
      <TouchableOpacity 
        onPress={(e) => {
          e.stopPropagation();
          onPlayerPress?.(transfer);
        }}
      >
        <Image 
          source={{ uri: transfer.player.photo }} 
          style={styles.playerPhoto}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        />
      </TouchableOpacity>
      <View style={styles.playerInfo}>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            onPlayerPress?.(transfer);
          }}
        >
          <Text style={styles.playerName}>{transfer.player.name}</Text>
        </TouchableOpacity>
        <Text style={styles.transferDate}>{transfer.update}</Text>
        {transfer.league && (
          <View style={styles.leagueBadge}>
            {transfer.league.logo && (
              <Image 
                source={{ uri: transfer.league.logo }} 
                style={styles.leagueLogoSmall}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            )}
            <Text style={styles.leagueNameSmall}>{transfer.league.name}</Text>
          </View>
        )}
      </View>
    </View>

    {transfer.transfers.map((t, tIndex) => (
      <View key={tIndex} style={styles.transferDetails}>
        {t.teams.out && (
          <TouchableOpacity 
            style={styles.teamBox}
            onPress={(e) => {
              e.stopPropagation();
              onTeamPress?.(t.teams.out!.id);
            }}
          >
            <Image 
              source={{ uri: t.teams.out.logo }} 
              style={styles.teamLogo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            />
            <Text style={styles.teamName} numberOfLines={2}>
              {t.teams.out.name}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.transferArrow}>
          <Ionicons name="arrow-forward" size={24} color="#8B5CF6" />
          <Text style={styles.transferType}>{t.type}</Text>
          {t.date && <Text style={styles.transferDateSmall}>{t.date}</Text>}
        </View>

        {t.teams.in && (
          <TouchableOpacity 
            style={styles.teamBox}
            onPress={(e) => {
              e.stopPropagation();
              onTeamPress?.(t.teams.in!.id);
            }}
          >
            <Image 
              source={{ uri: t.teams.in.logo }} 
              style={styles.teamLogo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            />
            <Text style={styles.teamName} numberOfLines={2}>
              {t.teams.in.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    ))}
  </View>
));

TransferCard.displayName = 'TransferCard';

export default function TransfersScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [transfersByLeague, setTransfersByLeague] = useState<TransfersByLeague[]>([]);
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);
  const loadingRef = useRef(false);
  const [isOffline, setIsOffline] = useState(false);
  
  // Pagination state
  const PAGE_SIZE = 20;
  const [displayedTransfers, setDisplayedTransfers] = useState<Transfer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransferFilters>({
    transferType: 'all',
    position: [],
    ageRange: { min: 16, max: 45 },
    priceRange: { min: 0, max: 100000000 },
    dateRange: { from: null, date: null },
    nationality: [],
    leagueId: null,
  });
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const FAVORITES_STORAGE_KEY = 'transfer_favorites';
  const [groupBy, setGroupBy] = useState<'none' | 'league' | 'date' | 'team' | 'type'>('none');
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showTopLists, setShowTopLists] = useState(false);

  // Debounced search callback with 300ms delay
  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      setDebouncedSearchQuery(value);
    },
    300
  );

  // Calculate date range (last year)
  const getDateRange = useCallback(() => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    return {
      from: oneYearAgo.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  }, []);

  // Load transfers from AsyncStorage
  const loadTransfersFromStorage = useCallback(async (): Promise<boolean> => {
    try {
      const [storedTransfers, storedTimestamp] = await Promise.all([
        AsyncStorage.getItem(TRANSFERS_STORAGE_KEY),
        AsyncStorage.getItem(TRANSFERS_TIMESTAMP_KEY),
      ]);

      if (storedTransfers && storedTimestamp) {
        const timestamp = parseInt(storedTimestamp, 10);
        const age = Date.now() - timestamp;

        if (age < CACHE_TTL) {
          const data: TransfersByLeague[] = JSON.parse(storedTransfers);
          setTransfersByLeague(data);

          // Flatten all transfers
          const flattened: Transfer[] = [];
          data.forEach(leagueData => {
            flattened.push(...leagueData.transfers);
          });
          setAllTransfers(flattened);

          // Extract unique leagues for filter
          const uniqueLeagues = data.map(item => ({
            id: item.leagueId,
            name: item.leagueName,
            logo: item.leagueLogo,
          }));
          setLeagues(uniqueLeagues);
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to load transfers from storage:', err);
    }
    return false;
  }, []);

  // Save transfers to AsyncStorage
  const saveTransfersToStorage = useCallback(async (data: TransfersByLeague[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(TRANSFERS_STORAGE_KEY, JSON.stringify(data)),
        AsyncStorage.setItem(TRANSFERS_TIMESTAMP_KEY, Date.now().toString()),
      ]);
    } catch (err) {
      console.error('Failed to save transfers to storage:', err);
    }
  }, []);

  // Check network status
  const checkNetworkStatus = useCallback(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setIsOffline(!networkState.isConnected);
      return networkState.isConnected;
    } catch (err) {
      console.error('Failed to check network status:', err);
      return false;
    }
  }, []);

  // Load transfers by leagues
  const loadTransfers = useCallback(async () => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      // Check network status
      const isOnline = await checkNetworkStatus();

      if (!isOnline) {
        // Try to load from storage
        const loaded = await loadTransfersFromStorage();
        if (loaded) {
          setLoading(false);
          loadingRef.current = false;
          return;
        } else {
          setError('No internet connection and no cached data available');
          setLoading(false);
          loadingRef.current = false;
          return;
        }
      }

      const dateRange = getDateRange();
      const data = await ApiFootballService.getTransfersByLeagues({
        dateRange,
      });

      console.log('📦 Loaded transfers data:', {
        leaguesCount: data?.length || 0,
        data: data,
      });

      setTransfersByLeague(data || []);
      
      // Flatten all transfers
      const flattened: Transfer[] = [];
      if (data && Array.isArray(data)) {
        data.forEach(leagueData => {
          if (leagueData.transfers && Array.isArray(leagueData.transfers)) {
            flattened.push(...leagueData.transfers);
          }
        });
      }
      console.log('📦 Flattened transfers:', flattened.length);
      setAllTransfers(flattened);

      // Extract unique leagues for filter
      const uniqueLeagues = data.map(item => ({
        id: item.leagueId,
        name: item.leagueName,
        logo: item.leagueLogo,
      }));
      setLeagues(uniqueLeagues);

      // Save to storage for offline use
      await saveTransfersToStorage(data);
      setIsOffline(false);
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
      
      // Try to load from storage on error
      const loaded = await loadTransfersFromStorage();
      if (loaded) {
        setIsOffline(true);
      } else {
        setError('Failed to load transfers');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [getDateRange, checkNetworkStatus, loadTransfersFromStorage, saveTransfersToStorage]);

  // Load favorites from storage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored) {
          setFavorites(new Set(JSON.parse(stored)));
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
      }
    };
    loadFavorites();
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Navigation handlers
  const handlePlayerPress = useCallback((transfer: Transfer) => {
    console.log('🔄 Navigating to player profile:', transfer.player.name, transfer.player.id);
    
    // Get the current team (team "in" from the latest transfer)
    const latestTransfer = transfer.transfers && transfer.transfers.length > 0 
      ? transfer.transfers[transfer.transfers.length - 1] 
      : null;
    const currentTeam = latestTransfer?.teams.in;
    
    const params = {
      id: transfer.player.id.toString(),
      name: transfer.player.name,
      photo: transfer.player.photo || '',
      teamName: currentTeam?.name || '',
      teamLogo: currentTeam?.logo || '',
    };
    
    console.log('📋 Navigation params:', params);
    
    router.push({
      pathname: '/player-profile' as any,
      params: params
    } as any);
  }, [router]);

  const handleTeamPress = useCallback((teamId: number) => {
    router.push(`/team-profile?id=${teamId}`);
  }, [router]);

  // Favorite handlers with haptic feedback
  const toggleFavorite = useCallback(async (transferId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFavorites = new Set(favorites);
    if (newFavorites.has(transferId)) {
      newFavorites.delete(transferId);
    } else {
      newFavorites.add(transferId);
    }
    setFavorites(newFavorites);
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(newFavorites)));
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  }, [favorites]);

  // Share handler
  const handleShare = useCallback(async (transfer: Transfer) => {
    try {
      const shareText = `${transfer.player.name} transferred from ${transfer.transfers[0]?.teams.out?.name || 'Unknown'} to ${transfer.transfers[0]?.teams.in?.name || 'Unknown'}`;
      
      // Use React Native Share API
      await Share.share({
        message: shareText,
        title: 'Transfer Share',
      });
    } catch (err) {
      console.error('Failed to share:', err);
    }
  }, []);

  // Filter transfers based on search, filters, and league
  const filteredTransfers = useMemo(() => {
    let filtered = [...allTransfers];

    // Filter by league (from filters or selectedLeagueId)
    const leagueId = filters.leagueId !== null ? filters.leagueId : selectedLeagueId;
    if (leagueId !== null) {
      filtered = filtered.filter(t => t.league?.id === leagueId);
    }

    // Filter by transfer type
    if (filters.transferType !== 'all') {
      filtered = filtered.filter(transfer =>
        transfer.transfers.some(t => {
          const typeLower = t.type?.toLowerCase() || '';
          if (filters.transferType === 'free') {
            return typeLower.includes('free');
          } else if (filters.transferType === 'loan') {
            return typeLower.includes('loan');
          } else if (filters.transferType === 'permanent') {
            return typeLower.includes('permanent') || (!typeLower.includes('loan') && !typeLower.includes('free'));
          } else if (filters.transferType === 'swap') {
            return typeLower.includes('swap');
          }
          return true;
        })
      );
    }

    // Filter by debounced search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(transfer =>
        transfer.player.name.toLowerCase().includes(query) ||
        transfer.transfers.some((t) =>
          t.teams.in?.name.toLowerCase().includes(query) ||
          t.teams.out?.name.toLowerCase().includes(query)
        ) ||
        transfer.league?.name.toLowerCase().includes(query)
      );
    }

    // Sort transfers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          const dateA = a.transfers[0]?.date || '';
          const dateB = b.transfers[0]?.date || '';
          return dateB.localeCompare(dateA);
        case 'date-asc':
          const dateA2 = a.transfers[0]?.date || '';
          const dateB2 = b.transfers[0]?.date || '';
          return dateA2.localeCompare(dateB2);
        case 'name-asc':
          return a.player.name.localeCompare(b.player.name);
        case 'name-desc':
          return b.player.name.localeCompare(a.player.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [allTransfers, selectedLeagueId, debouncedSearchQuery, filters, sortBy]);

  // Group transfers if needed
  const groupedTransfers = useMemo(() => {
    if (groupBy === 'none') return filteredTransfers;
    
    const groups = new Map<string, Transfer[]>();
    
    filteredTransfers.forEach(transfer => {
      let key = '';
      switch (groupBy) {
        case 'league':
          key = transfer.league?.name || 'Unknown League';
          break;
        case 'date':
          key = transfer.transfers[0]?.date || 'Unknown Date';
          break;
        case 'team':
          key = transfer.transfers[0]?.teams.in?.name || transfer.transfers[0]?.teams.out?.name || 'Unknown Team';
          break;
        case 'type':
          key = transfer.transfers[0]?.type || 'Unknown Type';
          break;
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(transfer);
    });
    
    return Array.from(groups.entries()).map(([key, transfers]) => ({
      key,
      transfers,
    }));
  }, [filteredTransfers, groupBy]);

  // Update displayed transfers based on pagination
  useEffect(() => {
    const transfersToDisplay = groupBy === 'none' 
      ? filteredTransfers 
      : (groupedTransfers as any).flatMap((g: any) => g.transfers);
    const startIndex = 0;
    const endIndex = currentPage * PAGE_SIZE;
    setDisplayedTransfers(transfersToDisplay.slice(startIndex, endIndex));
  }, [filteredTransfers, currentPage, groupBy, groupedTransfers]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLeagueId, debouncedSearchQuery]);

  // Load more transfers (infinite scroll)
  const loadMore = useCallback(() => {
    if (isLoadingMore || displayedTransfers.length >= filteredTransfers.length) {
      return;
    }

    setIsLoadingMore(true);
    // Simulate loading delay for better UX
    setTimeout(() => {
      setCurrentPage(prev => prev + 1);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, displayedTransfers.length, filteredTransfers.length]);

  const renderTransfer = useCallback(({ item, index }: { item: Transfer; index: number }) => {
    const transferId = item.player.id;
    return (
      <TouchableOpacity
        style={styles.transferCardWrapper}
        onPress={() => {
          setSelectedTransfer(item);
          setShowDetailsModal(true);
        }}
        activeOpacity={0.7}
      >
        <TransferCard 
          transfer={item} 
          index={index}
          onPlayerPress={handlePlayerPress}
          onTeamPress={handleTeamPress}
        />
        <View style={styles.transferActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(transferId);
            }}
          >
            <Ionicons 
              name={favorites.has(transferId) ? 'heart' : 'heart-outline'} 
              size={20} 
              color={favorites.has(transferId) ? '#ef4444' : '#888'} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleShare(item);
            }}
          >
            <Ionicons name="share-outline" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [handlePlayerPress, handleTeamPress, toggleFavorite, handleShare, favorites]);

  const keyExtractor = useCallback((item: Transfer, index: number) => 
    `transfer-${item.player.id}-${index}`, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadTransfers();
    setRefreshing(false);
  }, [loadTransfers]);

  const onRefresh = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredTransfers.length;
    const free = filteredTransfers.filter(t => 
      t.transfers.some(tr => tr.type?.toLowerCase().includes('free'))
    ).length;
    const loan = filteredTransfers.filter(t => 
      t.transfers.some(tr => tr.type?.toLowerCase().includes('loan'))
    ).length;
    const permanent = filteredTransfers.filter(t =>
      t.transfers.some(tr => {
        const typeLower = tr.type?.toLowerCase() || '';
        return !typeLower.includes('loan') && !typeLower.includes('free');
      })
    ).length;

    return { total, free, loan, permanent };
  }, [filteredTransfers]);

  const renderHeader = () => (
    <>
      {/* Statistics Cards */}
      <View style={styles.statisticsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.free}</Text>
          <Text style={styles.statLabel}>Free</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.loan}</Text>
          <Text style={styles.statLabel}>Loan</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.permanent}</Text>
          <Text style={styles.statLabel}>Permanent</Text>
        </View>
      </View>

      {/* Charts & Top Lists Toggle */}
      <View style={styles.analyticsToggle}>
        <TouchableOpacity
          style={[styles.analyticsButton, showCharts && styles.analyticsButtonActive]}
          onPress={() => {
            setShowCharts(!showCharts);
            setShowTopLists(false);
          }}
        >
          <Ionicons name="bar-chart-outline" size={18} color={showCharts ? '#8B5CF6' : '#888'} />
          <Text style={[styles.analyticsButtonText, showCharts && styles.analyticsButtonTextActive]}>
            Charts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.analyticsButton, showTopLists && styles.analyticsButtonActive]}
          onPress={() => {
            setShowTopLists(!showTopLists);
            setShowCharts(false);
          }}
        >
          <Ionicons name="trophy-outline" size={18} color={showTopLists ? '#8B5CF6' : '#888'} />
          <Text style={[styles.analyticsButtonText, showTopLists && styles.analyticsButtonTextActive]}>
            Top Lists
          </Text>
        </TouchableOpacity>
      </View>

      {/* Charts */}
      {showCharts && <TransfersCharts transfers={filteredTransfers} />}

      {/* Top Lists */}
      {showTopLists && (
        <TopLists
          transfers={filteredTransfers}
          onTransferPress={(transfer) => {
            setSelectedTransfer(transfer);
            setShowDetailsModal(true);
          }}
        />
      )}

      {/* League Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.leagueFilter}
        contentContainerStyle={styles.leagueFilterContent}
      >
        <TouchableOpacity
          style={[
            styles.leagueFilterItem,
            selectedLeagueId === null && styles.leagueFilterItemActive
          ]}
          onPress={() => setSelectedLeagueId(null)}
        >
          <Text style={[
            styles.leagueFilterText,
            selectedLeagueId === null && styles.leagueFilterTextActive
          ]}>
            All Leagues
          </Text>
        </TouchableOpacity>
        {leagues.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={[
              styles.leagueFilterItem,
              selectedLeagueId === league.id && styles.leagueFilterItemActive
            ]}
            onPress={() => setSelectedLeagueId(league.id)}
          >
            {league.logo && (
              <Image 
                source={{ uri: league.logo }} 
                style={styles.leagueFilterLogo}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            )}
            <Text 
              style={[
                styles.leagueFilterText,
                selectedLeagueId === league.id && styles.leagueFilterTextActive
              ]}
              numberOfLines={1}
            >
              {league.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredTransfers.length} {filteredTransfers.length === 1 ? 'transfer' : 'transfers'}
          {selectedLeagueId && ` in ${leagues.find(l => l.id === selectedLeagueId)?.name}`}
        </Text>
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transfers</Text>
          <View style={styles.refreshButton} />
        </View>
        <FlatList
          data={Array(10).fill(0)}
          renderItem={() => <TransferCardSkeleton />}
          keyExtractor={(_, index) => `skeleton-${index}`}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>{t.common.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>Transfers</Text>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline-outline" size={12} color="#fff" />
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        )}
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
          <Ionicons name="filter" size={20} color="#8B5CF6" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by player, team, or league..."
          placeholderTextColor="#666"
          value={searchInput}
          onChangeText={(text) => {
            setSearchInput(text);
            debouncedSearch(text);
          }}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchInput('');
            debouncedSearch('');
          }}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort & Group Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortOptions}>
          {[
            { value: 'date-desc', label: 'Newest' },
            { value: 'date-asc', label: 'Oldest' },
            { value: 'name-asc', label: 'Name A-Z' },
            { value: 'name-desc', label: 'Name Z-A' },
          ].map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => setSortBy(option.value as SortOption)}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.groupContainer}>
          <Text style={styles.sortLabel}>Group by:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortOptions}>
            {[
              { value: 'none', label: 'None' },
              { value: 'league', label: 'League' },
              { value: 'date', label: 'Date' },
              { value: 'team', label: 'Team' },
              { value: 'type', label: 'Type' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  groupBy === option.value && styles.sortOptionActive,
                ]}
                onPress={() => setGroupBy(option.value as any)}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    groupBy === option.value && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Transfers List */}
      <FlatList
        data={displayedTransfers}
        renderItem={renderTransfer}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={15}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={onRefresh}
        getItemLayout={(data, index) => ({
          length: 200, // Approximate item height
          offset: 200 * index,
          index,
        })}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            </View>
          ) : displayedTransfers.length >= filteredTransfers.length && displayedTransfers.length > 0 ? (
            <View style={styles.endOfListContainer}>
              <Text style={styles.endOfListText}>No more transfers to load</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="swap-horizontal-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No transfers found</Text>
            {debouncedSearchQuery && (
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            )}
          </View>
        }
      />

      {/* Filters Modal */}
      <FiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setCurrentPage(1);
        }}
        initialFilters={filters}
        availableLeagues={leagues}
      />

      {/* Transfer Details Modal */}
      <TransferDetailsModal
        visible={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedTransfer(null);
        }}
        transfer={selectedTransfer}
        relatedTransfers={filteredTransfers.filter(t => 
          t.player.id !== selectedTransfer?.player.id &&
          (t.league?.id === selectedTransfer?.league?.id ||
           t.transfers.some(tr => 
             tr.teams.in?.id === selectedTransfer?.transfers[0]?.teams.in?.id ||
             tr.teams.out?.id === selectedTransfer?.transfers[0]?.teams.out?.id
           ))
        )}
        onPlayerPress={handlePlayerPress}
        onTeamPress={handleTeamPress}
        onShare={handleShare}
        onFavorite={toggleFavorite}
        isFavorite={selectedTransfer ? favorites.has(selectedTransfer.player.id) : false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  loadingSubtext: {
    color: '#666',
    marginTop: 8,
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sortLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  sortOptions: {
    flexDirection: 'row',
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
  },
  sortOptionActive: {
    backgroundColor: '#8B5CF6',
  },
  sortOptionText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  offlineText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  leagueFilter: {
    marginBottom: 12,
  },
  leagueFilterContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  leagueFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  leagueFilterItemActive: {
    backgroundColor: '#8B5CF6',
  },
  leagueFilterLogo: {
    width: 20,
    height: 20,
    marginRight: 6,
    borderRadius: 10,
  },
  leagueFilterText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  leagueFilterTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statisticsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#8B5CF6',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  statsText: {
    color: '#888',
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  transferCardWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  transferCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  transferActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  transferDate: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  leagueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  leagueLogoSmall: {
    width: 16,
    height: 16,
    marginRight: 4,
    borderRadius: 8,
  },
  leagueNameSmall: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '600',
  },
  transferDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  teamName: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  transferArrow: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  transferType: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  transferDateSmall: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#555',
    fontSize: 14,
    marginTop: 8,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  endOfListContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    color: '#666',
    fontSize: 12,
  },
  groupContainer: {
    marginTop: 12,
  },
  analyticsToggle: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  analyticsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  analyticsButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  analyticsButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  analyticsButtonTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
});
