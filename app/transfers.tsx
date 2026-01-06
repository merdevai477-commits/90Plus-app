import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApiFootballService, { Transfer, TransfersByLeague, MAJOR_LEAGUES } from '../services/apiFootball';
import { useTranslation } from '../src/i18n';

// Memoized Transfer Card Component
const TransferCard = React.memo(({ transfer, index }: { transfer: Transfer; index: number }) => (
  <View style={styles.transferCard}>
    <View style={styles.transferHeader}>
      <Image 
        source={{ uri: transfer.player.photo }} 
        style={styles.playerPhoto}
      />
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{transfer.player.name}</Text>
        <Text style={styles.transferDate}>{transfer.update}</Text>
        {transfer.league && (
          <View style={styles.leagueBadge}>
            {transfer.league.logo && (
              <Image source={{ uri: transfer.league.logo }} style={styles.leagueLogoSmall} />
            )}
            <Text style={styles.leagueNameSmall}>{transfer.league.name}</Text>
          </View>
        )}
      </View>
    </View>

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
          <Ionicons name="arrow-forward" size={24} color="#8B5CF6" />
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
));

TransferCard.displayName = 'TransferCard';

export default function TransfersScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [transfersByLeague, setTransfersByLeague] = useState<TransfersByLeague[]>([]);
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);
  const loadingRef = useRef(false);

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

  // Load transfers by leagues
  const loadTransfers = useCallback(async () => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const dateRange = getDateRange();
      const data = await ApiFootballService.getTransfersByLeagues({
        dateRange,
      });

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
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
      setError('Failed to load transfers');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [getDateRange]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Filter transfers based on search and league
  const filteredTransfers = useMemo(() => {
    let filtered = [...allTransfers];

    // Filter by league
    if (selectedLeagueId !== null) {
      filtered = filtered.filter(t => t.league?.id === selectedLeagueId);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(transfer =>
        transfer.player.name.toLowerCase().includes(query) ||
        transfer.transfers.some((t) =>
          t.teams.in?.name.toLowerCase().includes(query) ||
          t.teams.out?.name.toLowerCase().includes(query)
        ) ||
        transfer.league?.name.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = a.transfers[0]?.date || '';
      const dateB = b.transfers[0]?.date || '';
      return dateB.localeCompare(dateA);
    });

    return filtered;
  }, [allTransfers, selectedLeagueId, searchQuery]);

  const renderTransfer = useCallback(({ item, index }: { item: Transfer; index: number }) => (
    <TransferCard transfer={item} index={index} />
  ), []);

  const renderHeader = () => (
    <>
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
              <Image source={{ uri: league.logo }} style={styles.leagueFilterLogo} />
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
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
        <Text style={styles.loadingSubtext}>Loading transfers from all leagues...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadTransfers}>
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
        <Text style={styles.headerTitle}>Transfers</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadTransfers}>
          <Ionicons name="refresh" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by player, team, or league..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Transfers List */}
      <FlatList
        data={filteredTransfers}
        renderItem={renderTransfer}
        keyExtractor={(item, index) => `transfer-${item.player.id}-${index}`}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="swap-horizontal-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No transfers found</Text>
            {searchQuery && (
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            )}
          </View>
        }
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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
  transferCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
});
