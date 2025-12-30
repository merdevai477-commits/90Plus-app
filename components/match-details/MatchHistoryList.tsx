/**
 * MatchHistoryList Component
 * Displays a list of archived matches with date grouping.
 * 
 * Requirements: 6.5
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { History } from 'lucide-react-native';
import { MatchArchive, matchArchiveService } from '../../services/matchArchiveService';
import MatchHistoryCard from './MatchHistoryCard';

interface MatchHistoryListProps {
  /** Number of days to look back for archived matches */
  daysBack?: number;
  /** Callback when a match is pressed */
  onMatchPress?: (match: MatchArchive) => void;
  /** Optional header component */
  ListHeaderComponent?: React.ReactElement;
}

/**
 * Group matches by date
 */
const groupMatchesByDate = (matches: MatchArchive[]): Map<string, MatchArchive[]> => {
  const groups = new Map<string, MatchArchive[]>();
  
  matches.forEach(match => {
    const dateKey = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(match.date);
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(match);
  });
  
  return groups;
};

const MatchHistoryList: React.FC<MatchHistoryListProps> = ({
  daysBack = 30,
  onMatchPress,
  ListHeaderComponent,
}) => {
  const [matches, setMatches] = useState<MatchArchive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      const archivedMatches = await matchArchiveService.getArchivedMatches(startDate, endDate);
      setMatches(archivedMatches);
    } catch (error) {
      console.error('[MatchHistoryList] Error loading matches:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [daysBack]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadMatches();
  }, [loadMatches]);

  const renderItem = useCallback(({ item }: { item: MatchArchive }) => (
    <MatchHistoryCard
      match={item}
      onPress={onMatchPress ? () => onMatchPress(item) : undefined}
    />
  ), [onMatchPress]);

  const keyExtractor = useCallback((item: MatchArchive) => item.matchId, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading match history...</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <History size={48} color="#666" />
        <Text style={styles.emptyTitle}>No Match History</Text>
        <Text style={styles.emptyText}>
          Finished matches will appear here once they are archived.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#22c55e"
          colors={['#22c55e']}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default MatchHistoryList;
