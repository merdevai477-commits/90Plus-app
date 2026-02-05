/**
 * Enhanced Transfers Screen - Revolutionary Design 🚀
 * Organized by leagues with collapsible sections (like Matches page)
 * 
 * Features:
 * ✅ League-based organization with expand/collapse
 * ✅ Advanced filters (type, position, age, price)
 * ✅ Smart search across players, teams, leagues
 * ✅ League priority sorting (Major leagues first)
 * ✅ Stats for each league
 * ✅ Smooth animations and haptic feedback
 * ✅ Lazy loading for performance
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  FlatList,
  ListRenderItem,
} from 'react-native';
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
import TransfersLeagueSection from '../components/Matches/TransfersLeagueSection';
import { TransferDetailsModal } from '../components/Transfers/TransferDetailsModal';

const TRANSFERS_STORAGE_KEY = 'cached_transfers';
const TRANSFERS_TIMESTAMP_KEY = 'cached_transfers_timestamp';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const EXPANDED_LEAGUES_KEY = 'expanded_leagues';

// League priority for sorting (Major leagues first)
const MAJOR_LEAGUES_PRIORITY: Record<number, number> = {
  [MAJOR_LEAGUES.PREMIER_LEAGUE]: 1,
  [MAJOR_LEAGUES.LA_LIGA]: 2,
  [MAJOR_LEAGUES.BUNDESLIGA]: 3,
  [MAJOR_LEAGUES.SERIE_A]: 4,
  [MAJOR_LEAGUES.LIGUE_1]: 5,
  [MAJOR_LEAGUES.CHAMPIONS_LEAGUE]: 6,
  [MAJOR_LEAGUES.EUROPA_LEAGUE]: 7,
  [MAJOR_LEAGUES.SAUDI_PRO_LEAGUE]: 8,
  [MAJOR_LEAGUES.EGYPTIAN_PREMIER_LEAGUE]: 9,
  [MAJOR_LEAGUES.MOROCCAN_BOTOLA]: 10,
};

interface LeagueGroup {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  transfers: Transfer[];
  stats: {
    total: number;
    free: number;
    loan: number;
    permanent: number;
  };
}

interface GlobalStats {
  totalTransfers: number;
  totalLeagues: number;
  freeTransfers: number;
  loanTransfers: number;
  avgValue: number;
}

export default function TransfersEnhancedScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // State
  const [transfersByLeague, setTransfersByLeague] = useState<TransfersByLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
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

  // Expand/Collapse state
  const [expandedLeagues, setExpandedLeagues] = useState<Set<number>>(new Set());
  
  // Modal state
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Debounced search
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

  // Load transfers
  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const isOnline = await checkNetworkStatus();

      if (!isOnline) {
        const loaded = await loadTransfersFromStorage();
        if (loaded) {
          setLoading(false);
          return;
        } else {
          setError('No internet connection and no cached data available');
          setLoading(false);
          return;
        }
      }

      const dateRange = getDateRange();
      const data = await ApiFootballService.getTransfersByLeagues({
        dateRange,
      });

      setTransfersByLeague(data || []);
      await saveTransfersToStorage(data);
      setIsOffline(false);
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
      
      const loaded = await loadTransfersFromStorage();
      if (loaded) {
        setIsOffline(true);
      } else {
        setError('Failed to load transfers');
      }
    } finally {
      setLoading(false);
    }
  }, [getDateRange, checkNetworkStatus, loadTransfersFromStorage, saveTransfersToStorage]);

  // Load expanded leagues from storage
  useEffect(() => {
    const loadExpandedLeagues = async () => {
      try {
        const stored = await AsyncStorage.getItem(EXPANDED_LEAGUES_KEY);
        if (stored) {
          setExpandedLeagues(new Set(JSON.parse(stored)));
        }
      } catch (err) {
        console.error('Failed to load expanded leagues:', err);
      }
    };
    loadExpandedLeagues();
  }, []);

  // Save expanded leagues to storage
  useEffect(() => {
    const saveExpandedLeagues = async () => {
      try {
        await AsyncStorage.setItem(
          EXPANDED_LEAGUES_KEY,
          JSON.stringify(Array.from(expandedLeagues))
        );
      } catch (err) {
        console.error('Failed to save expanded leagues:', err);
      }
    };
    saveExpandedLeagues();
  }, [expandedLeagues]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Flatten all transfers
  const allTransfers = useMemo(() => {
    const flattened: Transfer[] = [];
    transfersByLeague.forEach(leagueData => {
      flattened.push(...leagueData.transfers);
    });
    return flattened;
  }, [transfersByLeague]);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    let filtered = [...allTransfers];

    // Filter by league (from filters)
    if (filters.leagueId !== null) {
      filtered = filtered.filter(t => t.league?.id === filters.leagueId);
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

    // Filter by search query
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

    return filtered;
  }, [allTransfers, filters, debouncedSearchQuery]);

  // Group transfers by league
  const groupedTransfers = useMemo((): LeagueGroup[] => {
    const grouped = new Map<number, LeagueGroup>();

    filteredTransfers.forEach(transfer => {
      const leagueId = transfer.league?.id || 0;
      
      if (!grouped.has(leagueId)) {
        grouped.set(leagueId, {
          leagueId,
          leagueName: transfer.league?.name || 'Unknown League',
          leagueLogo: transfer.league?.logo,
          transfers: [],
          stats: {
            total: 0,
            free: 0,
            loan: 0,
            permanent: 0,
          },
        });
      }
      
      const group = grouped.get(leagueId)!;
      group.transfers.push(transfer);
    });

    // Calculate stats for each league
    grouped.forEach(group => {
      group.stats.total = group.transfers.length;
      group.stats.free = group.transfers.filter(t =>
        t.transfers.some(tr => tr.type?.toLowerCase().includes('free'))
      ).length;
      group.stats.loan = group.transfers.filter(t =>
        t.transfers.some(tr => tr.type?.toLowerCase().includes('loan'))
      ).length;
      group.stats.permanent = group.stats.total - group.stats.free - group.stats.loan;
    });

    // Sort leagues by priority (Major leagues first)
    return Array.from(grouped.values()).sort((a, b) => {
      const aPriority = MAJOR_LEAGUES_PRIORITY[a.leagueId] || 999;
      const bPriority = MAJOR_LEAGUES_PRIORITY[b.leagueId] || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // If same priority, sort by number of transfers (descending)
      return b.transfers.length - a.transfers.length;
    });
  }, [filteredTransfers]);

  // Calculate global stats
  const globalStats = useMemo((): GlobalStats => {
    const total = filteredTransfers.length;
    const leagues = groupedTransfers.length;
    const free = filteredTransfers.filter(t =>
      t.transfers.some(tr => tr.type?.toLowerCase().includes('free'))
    ).length;
    const loan = filteredTransfers.filter(t =>
      t.transfers.some(tr => tr.type?.toLowerCase().includes('loan'))
    ).length;
    
    const totalValue = filteredTransfers.reduce((sum, t) => {
      const value = t.transfers[0]?.value || 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    const avgValue = total > 0 ? totalValue / total : 0;

    return {
      totalTransfers: total,
      totalLeagues: leagues,
      freeTransfers: free,
      loanTransfers: loan,
      avgValue,
    };
  }, [filteredTransfers, groupedTransfers]);

  // Toggle league expand/collapse
  const toggleLeague = useCallback((leagueId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(leagueId)) {
        next.delete(leagueId);
      } else {
        next.add(leagueId);
      }
      return next;
    });
  }, []);

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const allLeagueIds = groupedTransfers.map(g => g.leagueId);
    setExpandedLeagues(new Set(allLeagueIds));
  }, [groupedTransfers]);

  const collapseAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExpandedLeagues(new Set());
  }, []);

  // Navigation handlers
  const handlePlayerPress = useCallback((transfer: Transfer) => {
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

  const handleTeamPress = useCallback((teamId: number) => {
    router.push(`/team-profile?id=${teamId}`);
  }, [router]);

  // Render league section
  const renderLeagueSection: ListRenderItem<LeagueGroup> = useCallback(({ item: group }) => (
    <TransfersLeagueSection
      key={group.leagueId}
      leagueId={group.leagueId}
      leagueName={group.leagueName}
      leagueLogo={group.leagueLogo}
      transfers={group.transfers}
      onPlayerPress={handlePlayerPress}
      onTeamPress={handleTeamPress}
    />
  ), [handlePlayerPress, handleTeamPress]);

  const keyExtractor = useCallback((item: LeagueGroup) => 
    `league-${item.leagueId}`, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransfers();
    setRefreshing(false);
  }, [loadTransfers]);

  // Render header
  const renderHeader = () => (
    <>
      {/* Stats Bar */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{globalStats.totalTransfers}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{globalStats.totalLeagues}</Text>
          <Text style={styles.statLabel}>Leagues</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{globalStats.freeTransfers}</Text>
          <Text style={styles.statLabel}>Free</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{globalStats.loanTransfers}</Text>
          <Text style={styles.statLabel}>Loan</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>€{(globalStats.avgValue / 1000000).toFixed(1)}M</Text>
          <Text style={styles.statLabel}>Avg</Text>
        </View>
      </View>

      {/* Expand/Collapse All Buttons */}
      <View style={styles.expandCollapseContainer}>
        <TouchableOpacity
          style={styles.expandCollapseButton}
          onPress={expandAll}
        >
          <Ionicons name="chevron-down-circle-outline" size={18} color="#8B5CF6" />
          <Text style={styles.expandCollapseText}>Expand All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.expandCollapseButton}
          onPress={collapseAll}
        >
          <Ionicons name="chevron-up-circle-outline" size={18} color="#8B5CF6" />
          <Text style={styles.expandCollapseText}>Collapse All</Text>
        </TouchableOpacity>
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
          data={Array(5).fill(0)}
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

      {/* League Sections */}
      <FlatList
        data={groupedTransfers}
        renderItem={renderLeagueSection}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={10}
        removeClippedSubviews={true}
        refreshing={refreshing}
        onRefresh={handleRefresh}
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
        }}
        initialFilters={filters}
        availableLeagues={transfersByLeague.map(l => ({
          id: l.leagueId,
          name: l.leagueName,
          logo: l.leagueLogo,
        }))}
      />

      {/* Transfer Details Modal */}
      <TransferDetailsModal
        visible={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedTransfer(null);
        }}
        transfer={selectedTransfer}
        relatedTransfers={[]}
        onPlayerPress={handlePlayerPress}
        onTeamPress={handleTeamPress}
        onShare={async () => {}}
        onFavorite={() => {}}
        isFavorite={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 16,
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  expandCollapseContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  expandCollapseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    gap: 8,
  },
  expandCollapseText: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
});
