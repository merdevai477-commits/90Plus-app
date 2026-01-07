/**
 * Transfers Section Component
 * Enhanced with league grouping and collapsible sections
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useDebouncedCallback } from 'use-debounce';
import { Transfer, MAJOR_LEAGUES } from '../../services/apiFootball';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';
import EmptyState from './EmptyState';
import TransfersLeagueSection from './TransfersLeagueSection';
import { useTranslation } from '../../src/i18n/useTranslation';

interface TransfersSectionProps {
  transfers: Transfer[];
  loading: boolean;
  error: string | null;
  selectedLeagues: number[];
  onSelectedLeaguesChange: (leagues: number[]) => void;
  transferType: 'all' | 'free' | 'loan';
  onTransferTypeChange: (type: 'all' | 'free' | 'loan') => void;
  timeRange: '1month' | '3months' | '6months' | '1year';
  onTimeRangeChange: (range: '1month' | '3months' | '6months' | '1year') => void;
  availableLeagues: Array<{ id: number; name: string; logo?: string }>;
  onPlayerPress?: (transfer: Transfer) => void;
  onTeamPress?: (teamId: number) => void;
}

const TransfersSection: React.FC<TransfersSectionProps> = React.memo(({
  transfers,
  loading,
  error,
  selectedLeagues,
  onSelectedLeaguesChange,
  transferType,
  onTransferTypeChange,
  timeRange,
  onTimeRangeChange,
  availableLeagues,
  onPlayerPress,
  onTeamPress,
}) => {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);

  // Debounced filter handlers
  const debouncedLeagueChange = useDebouncedCallback(
    (leagues: number[]) => {
      onSelectedLeaguesChange(leagues);
    },
    300
  );

  const debouncedTypeChange = useDebouncedCallback(
    (type: 'all' | 'free' | 'loan') => {
      onTransferTypeChange(type);
    },
    300
  );

  const debouncedTimeRangeChange = useDebouncedCallback(
    (range: '1month' | '3months' | '6months' | '1year') => {
      onTimeRangeChange(range);
    },
    300
  );

  // Filter transfers
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

    // Sort by date (newest first) within each league
    filtered.sort((a, b) => {
      const dateA = a.transfers[0]?.date || '';
      const dateB = b.transfers[0]?.date || '';
      return dateB.localeCompare(dateA);
    });

    return filtered;
  }, [transfers, transferType]);

  // Group transfers by league
  const groupedTransfersByLeague = useMemo(() => {
    const groupsMap = new Map<number, {
      leagueId: number;
      leagueName: string;
      leagueLogo?: string;
      transfers: Transfer[];
    }>();

    filteredTransfers.forEach((transfer) => {
      const leagueId = transfer.league?.id || 0;
      const leagueName = transfer.league?.name || 'Unknown League';
      const leagueLogo = transfer.league?.logo;

      if (!groupsMap.has(leagueId)) {
        groupsMap.set(leagueId, {
          leagueId,
          leagueName,
          leagueLogo,
          transfers: [],
        });
      }

      groupsMap.get(leagueId)!.transfers.push(transfer);
    });

    // Convert to array and filter out empty leagues
    const groups = Array.from(groupsMap.values()).filter(group => group.transfers.length > 0);

    // Major leagues IDs (Top 5)
    const majorLeaguesSet = new Set([
      MAJOR_LEAGUES.PREMIER_LEAGUE,
      MAJOR_LEAGUES.LA_LIGA,
      MAJOR_LEAGUES.BUNDESLIGA,
      MAJOR_LEAGUES.SERIE_A,
      MAJOR_LEAGUES.LIGUE_1,
    ]);

    // Sort: Major leagues first (in order), then alphabetically
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
      
      // Finally alphabetically
      return a.leagueName.localeCompare(b.leagueName);
    });

    return groups;
  }, [filteredTransfers]);

  const handleLeagueToggle = useCallback((leagueId: number) => {
    const isSelected = selectedLeagues.includes(leagueId);
    const newLeagues = isSelected
      ? selectedLeagues.filter(id => id !== leagueId)
      : [...selectedLeagues, leagueId];
    debouncedLeagueChange(newLeagues);
  }, [selectedLeagues, debouncedLeagueChange]);

  if (loading && transfers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MATCH_DETAILS_COLORS.accent} />
        <Text style={styles.loadingText}>{t.matches.transfers.loading}</Text>
      </View>
    );
  }

  if (error && transfers.length === 0) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={t.matches.transfers.error}
        message={error}
        iconColor={MATCH_DETAILS_COLORS.error}
      />
    );
  }

  if (groupedTransfersByLeague.length === 0) {
    return (
      <EmptyState
        icon="swap-horizontal-outline"
        title={t.matches.transfers.noTransfersFound}
        message={
          transfers.length === 0
            ? t.matches.transfers.tryRefreshing
            : t.matches.transfers.tryAdjustingFilters
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={MATCH_DETAILS_COLORS.accent}
          />
          <Text style={styles.filterToggleText}>{t.matches.transfers.filters}</Text>
          {(selectedLeagues.length > 0 || transferType !== 'all' || timeRange !== '1year') && (
            <View style={styles.filterBadge} />
          )}
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filtersContent}>
            {/* Time Range Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t.matches.transfers.timePeriod}</Text>
              <View style={styles.filterOptions}>
                {(['1month', '3months', '6months', '1year'] as const).map((range) => (
                  <TouchableOpacity
                    key={range}
                    style={[
                      styles.filterOption,
                      timeRange === range && styles.filterOptionActive
                    ]}
                    onPress={() => debouncedTimeRangeChange(range)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      timeRange === range && styles.filterOptionTextActive
                    ]}>
                      {range === '1month' ? t.matches.transfers.oneMonth :
                       range === '3months' ? t.matches.transfers.threeMonths :
                       range === '6months' ? t.matches.transfers.sixMonths : t.matches.transfers.oneYear}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Transfer Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t.matches.transfers.transferType}</Text>
              <View style={styles.filterOptions}>
                {(['all', 'free', 'loan'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterOption,
                      transferType === type && styles.filterOptionActive
                    ]}
                    onPress={() => debouncedTypeChange(type)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      transferType === type && styles.filterOptionTextActive
                    ]}>
                      {type === 'all' ? t.matches.transfers.all :
                       type === 'free' ? t.matches.transfers.free : t.matches.transfers.loan}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* League Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>
                {t.matches.transfers.leagues} {selectedLeagues.length > 0 && `(${selectedLeagues.length} selected)`}
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
                  onPress={() => debouncedLeagueChange([])}
                >
                  <Text style={[
                    styles.leagueFilterText,
                    selectedLeagues.length === 0 && styles.leagueFilterTextActive
                  ]}>
                    {t.matches.transfers.top5Leagues}
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
                      onPress={() => handleLeagueToggle(league.id)}
                    >
                      {league.logo && (
                        <Image
                          source={{ uri: league.logo }}
                          style={styles.leagueFilterLogo}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
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

      {/* Transfers List Grouped by League */}
      <View style={styles.leaguesList}>
        {groupedTransfersByLeague.map((group, index) => (
          <TransfersLeagueSection
            key={group.leagueId}
            leagueId={group.leagueId}
            leagueName={group.leagueName}
            leagueLogo={group.leagueLogo}
            transfers={group.transfers}
            onPlayerPress={onPlayerPress}
            onTeamPress={onTeamPress}
            index={index}
          />
        ))}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.transfers.length === nextProps.transfers.length &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.transferType === nextProps.transferType &&
    prevProps.timeRange === nextProps.timeRange &&
    prevProps.selectedLeagues.length === nextProps.selectedLeagues.length
  );
});

TransfersSection.displayName = 'TransfersSection';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  filtersContainer: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_DETAILS_COLORS.border,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterToggleText: {
    color: MATCH_DETAILS_COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  filterBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MATCH_DETAILS_COLORS.accent,
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
    color: MATCH_DETAILS_COLORS.textSecondary,
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
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  filterOptionActive: {
    backgroundColor: MATCH_DETAILS_COLORS.accent,
    borderColor: MATCH_DETAILS_COLORS.accent,
  },
  filterOptionText: {
    color: MATCH_DETAILS_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: MATCH_DETAILS_COLORS.text,
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
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  leagueFilterItemActive: {
    backgroundColor: MATCH_DETAILS_COLORS.accent,
    borderColor: MATCH_DETAILS_COLORS.accent,
  },
  leagueFilterLogo: {
    width: 16,
    height: 16,
    marginRight: 6,
    borderRadius: 8,
  },
  leagueFilterText: {
    color: MATCH_DETAILS_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  leagueFilterTextActive: {
    color: MATCH_DETAILS_COLORS.text,
    fontWeight: '700',
  },
  leaguesList: {
    gap: 12,
  },
});

export default TransfersSection;
