import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import LeagueIcon from '../common/LeagueIcon';
import TeamBadge from '../common/TeamBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHaptic } from '../../hooks/useHaptic';
import ApiFootballService from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { cacheService } from '../../services/cacheService';
import { logger } from '../../utils/logger';
import { offlineDataService } from '../../services/offlineDataService';

type SearchTab = 'all' | 'players' | 'teams' | 'leagues' | 'matches';

interface AllLeaguesScreenProps {
  onLeagueSelect?: (leagueId: number) => void;
  onClose?: () => void;
}

const AllLeaguesScreen: React.FC<AllLeaguesScreenProps> = ({
  onLeagueSelect,
  onClose,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trigger } = useHaptic();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('leagues');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<{
    players: any[];
    teams: any[];
    leagues: any[];
    matches: {
      live: any[];
      upcoming: any[];
      finished: any[];
    };
  }>({ players: [], teams: [], leagues: [], matches: { live: [], upcoming: [], finished: [] } });
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch all leagues on mount
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const data = await ApiFootballService.getAllLeagues();
        if (data && data.length > 0) {
          const formattedLeagues = data.map((item: any) => ({
            id: item.league?.id || item.id,
            name: item.league?.name || item.name,
            country: item.country?.name || item.country || 'Unknown',
            logo: item.league?.logo || item.logo,
          }));
          setLeagues(formattedLeagues.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        logger.error('Failed to fetch leagues:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  // Handle unified search - optimized with shorter debounce
  useEffect(() => {
    const emptyResults = { 
      players: [], 
      teams: [], 
      leagues: [], 
      matches: { live: [], upcoming: [], finished: [] } 
    };

    // Don't search if query is too short
    if (searchQuery.length < 2) {
      setSearchResults(emptyResults);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    const delayDebounceFn = setTimeout(async () => {
      try {
        const normalizedQuery = searchQuery.toLowerCase().trim();

        // 1. Search local leagues first (fastest)
        const matchedLeagues = leagues.filter(l => 
          l.name.toLowerCase().includes(normalizedQuery) || 
          l.country.toLowerCase().includes(normalizedQuery)
        ).slice(0, 5);

        // 2. Search API for players and teams
        const [players, teams] = await Promise.all([
          ApiFootballService.searchPlayers(normalizedQuery),
          ApiFootballService.searchTeams(normalizedQuery)
        ]);

        // 3. Search matches (offline or cache first)
        const matches = await offlineDataService.searchMatches(normalizedQuery);
        
        // Ensure matches structure is correct
        const safeMatches = {
          live: matches?.live || [],
          upcoming: matches?.upcoming || [],
          finished: matches?.finished || []
        };

        setSearchResults({
          players: players || [],
          teams: teams || [],
          leagues: matchedLeagues,
          matches: safeMatches
        });
      } catch (error) {
        logger.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, leagues]);

  // Filter leagues based on search (local filtering for performance when in leagues tab)
  const filteredLeagues = useMemo(() => {
    if (!searchQuery.trim()) return leagues;
    const query = searchQuery.toLowerCase();
    return leagues.filter(
      (league) =>
        league.name.toLowerCase().includes(query) ||
        league.country.toLowerCase().includes(query)
    );
  }, [searchQuery, leagues]);

  // Group leagues by first letter
  const groupedLeagues = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredLeagues.forEach((league) => {
      const firstLetter = (league.name[0] || '').toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(league);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredLeagues]);

  const handleLeaguePress = (leagueId: number) => {
    trigger('selection');
    if (onLeagueSelect) {
      onLeagueSelect(leagueId);
    }
  };

  const handlePlayerPress = (playerId: number) => {
    trigger('light');
    router.push({
      pathname: '/player-profile',
      params: { id: playerId }
    } as any);
  };

  const handleTeamPress = (teamId: number) => {
    trigger('light');
    router.push({
      pathname: '/team-profile',
      params: { id: teamId },
    } as any);
  };

  const handleMatchPress = (fixtureId: number) => {
    trigger('light');
    router.push({
      pathname: '/match-details',
      params: { id: fixtureId },
    } as any);
  };

  const handleBack = () => {
    trigger('selection');
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const renderLeagueItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.leagueItem}
      onPress={() => handleLeaguePress(item.id)}
      activeOpacity={0.7}
    >
      <LeagueIcon name={item.name} size={40} color="#ffffff" />
      <View style={styles.leagueInfo}>
        <Text style={styles.leagueName}>{item.name}</Text>
        <Text style={styles.leagueCountry}>{item.country}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );

  const renderPlayerItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.leagueItem}
      onPress={() => handlePlayerPress(item.id)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.photo }} style={styles.leagueLogo} />
      <View style={styles.leagueInfo}>
        <Text style={styles.leagueName}>{item.name}</Text>
        <Text style={styles.leagueCountry}>{item.team}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );

  const renderTeamItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.leagueItem}
      onPress={() => handleTeamPress(item.id)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.logo }} style={styles.leagueLogo} />
      <View style={styles.leagueInfo}>
        <Text style={styles.leagueName}>{item.name}</Text>
        <Text style={styles.leagueCountry}>{item.country}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );

  const getMatchStatus = (status: string) => {
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
    const finishedStatuses = ['FT', 'AET', 'PEN'];
    if (liveStatuses.includes(status)) return 'live';
    if (finishedStatuses.includes(status)) return 'finished';
    return 'upcoming';
  };

  const getStatusColor = (status: string) => {
    const matchStatus = getMatchStatus(status);
    if (matchStatus === 'live') return '#22C55E';
    if (matchStatus === 'finished') return 'rgba(255,255,255,0.5)';
    return '#8B5CF6';
  };

  const getStatusText = (fixture: any) => {
    const status = fixture.fixture?.status?.short || fixture.status;
    const elapsed = fixture.fixture?.status?.elapsed;
    const matchStatus = getMatchStatus(status);

    if (matchStatus === 'live') {
      if (status === 'HT') return 'HT';
      return `${elapsed}'`;
    }
    if (matchStatus === 'finished') return 'FT';

    // Upcoming - show time
    const date = new Date(fixture.fixture?.date || fixture.date);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMatchItem = ({ item }: { item: any }) => {
    const homeTeam = item.teams?.home || {};
    const awayTeam = item.teams?.away || {};
    const goals = item.goals || {};
    const status = item.fixture?.status?.short || 'NS';
    const matchStatus = getMatchStatus(status);
    const homeGoals = goals.home ?? 0;
    const awayGoals = goals.away ?? 0;

    return (
      <TouchableOpacity
        style={styles.matchItem}
        onPress={() => handleMatchPress(item.fixture?.id)}
        activeOpacity={0.7}
      >
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
            {getStatusText(item)}
          </Text>
        </View>

        {/* Teams */}
        <View style={styles.matchTeams}>
          <View style={styles.teamRow}>
            <TeamBadge name={homeTeam.name} size={24} color="transparent" />
            <Text style={styles.teamName} numberOfLines={1}>{homeTeam.name}</Text>
            {matchStatus !== 'upcoming' && (
              <Text style={[styles.score, homeTeam.winner && styles.winnerScore]}>
                {homeGoals}
              </Text>
            )}
          </View>
          <View style={styles.teamRow}>
            <TeamBadge name={awayTeam.name} size={24} color="transparent" />
            <Text style={styles.teamName} numberOfLines={1}>{awayTeam.name}</Text>
            {matchStatus !== 'upcoming' && (
              <Text style={[styles.score, awayTeam.winner && styles.winnerScore]}>
                {awayGoals}
              </Text>
            )}
          </View>
        </View>

        {/* League */}
        <View style={styles.matchLeague}>
          <LeagueIcon name={item.league?.name} size={16} color="#ffffff" />
          <Text style={styles.leagueSmallName} numberOfLines={1}>{item.league?.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (letter: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLetter}>{letter}</Text>
    </View>
  );

  const renderTab = (id: SearchTab, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === id && styles.activeTab]}
      onPress={() => {
        trigger('light');
        setActiveTab(id);
      }}
    >
      <Text style={[styles.tabText, activeTab === id && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.leagues.allLeagues}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 20 : 35}
          tint="dark"
          style={styles.searchBlur}
        >
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.search.placeholder}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {(searchQuery.length > 0 || isSearching) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isSearching && <ActivityIndicator size="small" color="#8B5CF6" />}
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </BlurView>
      </View>

      {/* Search Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          data={[
            { id: 'matches', label: t.search.matches || 'المباريات' },
            { id: 'teams', label: t.search.teams },
            { id: 'players', label: t.search.players },
            { id: 'leagues', label: t.search.leagues },
            { id: 'all', label: t.search.all },
          ] as { id: SearchTab; label: string }[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderTab(item.id, item.label)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsList}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      ) : activeTab === 'leagues' ? (
        <FlatList
          data={groupedLeagues}
          keyExtractor={([letter]) => letter}
          renderItem={({ item: [letter, leagues] }) => (
            <View>
              {renderSectionHeader(letter)}
              {leagues.map((league) => (
                <View key={league.id}>{renderLeagueItem({ item: league })}</View>
              ))}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>{t.leagues.noMatchesFound}</Text>
            </View>
          }
        />
      ) : activeTab === 'players' ? (
        <FlatList
          data={searchResults.players}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPlayerItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>{t.search.noResults}</Text>
            </View>
          }
        />
      ) : activeTab === 'teams' ? (
        <FlatList
          data={searchResults.teams}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTeamItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>{t.search.noResults}</Text>
            </View>
          }
        />
      ) : activeTab === 'matches' ? (
        <FlatList
          data={(() => {
            // Safe access to matches with fallback
            const matches = searchResults?.matches || { live: [], upcoming: [], finished: [] };
            const live = Array.isArray(matches.live) ? matches.live : [];
            const upcoming = Array.isArray(matches.upcoming) ? matches.upcoming : [];
            const finished = Array.isArray(matches.finished) ? matches.finished : [];
            
            return [
              ...(live.length > 0 ? [{ type: 'header', title: '🔴 Live Matches' }] : []),
              ...live.map(m => ({ type: 'match', data: m })),
              ...(upcoming.length > 0 ? [{ type: 'header', title: '📅 Upcoming Matches' }] : []),
              ...upcoming.map(m => ({ type: 'match', data: m })),
              ...(finished.length > 0 ? [{ type: 'header', title: '✅ Finished Matches' }] : []),
              ...finished.map(m => ({ type: 'match', data: m })),
            ];
          })()}
          keyExtractor={(item: any, index) => item.type === 'header' ? `header-${index}` : (item.data?.fixture?.id || item.data?.id || index).toString()}
          renderItem={({ item }: { item: any }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.matchSectionHeader}>
                  <Text style={styles.matchSectionTitle}>{item.title}</Text>
                </View>
              );
            }
            return renderMatchItem({ item: item.data });
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="football-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>
                {searchQuery.length >= 2
                  ? t.search?.noResults || 'لا توجد نتائج'
                  : t.search?.searchForTeam || 'ابحث عن نادي لعرض مبارياته'}
              </Text>
            </View>
          }
        />
      ) : (
        // Unified 'All' view - show all search results
        <ScrollView 
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Players Section */}
          {searchResults.players.length > 0 && (
            <View>
              <View style={styles.matchSectionHeader}>
                <Text style={styles.matchSectionTitle}>{t.search.players || 'اللاعبين'}</Text>
              </View>
              {searchResults.players.map((player) => (
                <View key={player.id}>{renderPlayerItem({ item: player })}</View>
              ))}
            </View>
          )}
          
          {/* Teams Section */}
          {searchResults.teams.length > 0 && (
            <View>
              <View style={styles.matchSectionHeader}>
                <Text style={styles.matchSectionTitle}>{t.search.teams || 'الأندية'}</Text>
              </View>
              {searchResults.teams.map((team) => (
                <View key={team.id}>{renderTeamItem({ item: team })}</View>
              ))}
            </View>
          )}
          
          {/* Leagues Section */}
          {searchResults.leagues.length > 0 && (
            <View>
              <View style={styles.matchSectionHeader}>
                <Text style={styles.matchSectionTitle}>{t.search.leagues || 'الدوريات'}</Text>
              </View>
              {searchResults.leagues.map((league) => (
                <View key={league.id}>{renderLeagueItem({ item: league })}</View>
              ))}
            </View>
          )}
          
          {/* Matches Section */}
          {(() => {
            const matches = searchResults?.matches || { live: [], upcoming: [], finished: [] };
            const allMatches = [
              ...(matches.live || []),
              ...(matches.upcoming || []),
              ...(matches.finished || [])
            ];
            
            if (allMatches.length === 0) return null;
            
            return (
              <View>
                <View style={styles.matchSectionHeader}>
                  <Text style={styles.matchSectionTitle}>{t.search.matches || 'المباريات'}</Text>
                </View>
                {allMatches.map((match) => (
                  <View key={match.fixture?.id || match.id}>
                    {renderMatchItem({ item: match })}
                  </View>
                ))}
              </View>
            );
          })()}
          
          {/* Empty State */}
          {searchResults.players.length === 0 && 
           searchResults.teams.length === 0 && 
           searchResults.leagues.length === 0 && 
           (!searchResults.matches || 
            (searchResults.matches.live?.length === 0 && 
             searchResults.matches.upcoming?.length === 0 && 
             searchResults.matches.finished?.length === 0)) && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>
                {searchQuery.length >= 2
                  ? t.search?.noResults || 'لا توجد نتائج'
                  : t.search?.searchForTeam || 'ابحث عن لاعب، نادي، أو دوري'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    textAlign: Platform.OS === 'ios' ? 'left' : 'right', // Support RTL for placeholder/input
  },
  tabsContainer: {
    paddingVertical: 8,
  },
  tabsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeTab: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  leagueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  leagueLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  leagueCountry: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  // Match item styles
  matchItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchTeams: {
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  score: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    minWidth: 24,
    textAlign: 'center',
  },
  winnerScore: {
    color: '#22C55E',
  },
  matchLeague: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  leagueSmallLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  leagueSmallName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  // Match section headers
  matchSectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  matchSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B5CF6',
  },
});

export default AllLeaguesScreen;
