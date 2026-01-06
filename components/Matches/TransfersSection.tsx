/**
 * Transfers Section Component
 * Extracted from matches.tsx with debounced filters and better organization
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
import { Transfer } from '../../services/apiFootball';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';
import EmptyState from './EmptyState';

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

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = a.transfers[0]?.date || '';
      const dateB = b.transfers[0]?.date || '';
      return dateB.localeCompare(dateA);
    });

    return filtered;
  }, [transfers, transferType]);

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
        <Text style={styles.loadingText}>Loading transfers...</Text>
      </View>
    );
  }

  if (error && transfers.length === 0) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Error Loading Transfers"
        message={error}
        iconColor={MATCH_DETAILS_COLORS.error}
      />
    );
  }

  if (filteredTransfers.length === 0) {
    return (
      <EmptyState
        icon="swap-horizontal-outline"
        title="No transfers found"
        message={
          transfers.length === 0
            ? 'Try refreshing or check back later'
            : 'Try adjusting your filters'
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
                    onPress={() => debouncedTimeRangeChange(range)}
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
                    onPress={() => debouncedTypeChange(type)}
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
                  onPress={() => debouncedLeagueChange([])}
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

      {/* Transfers List */}
      <View style={styles.transfersList}>
        {filteredTransfers.map((transfer, index) => (
          <View key={`${transfer.player.id}-${index}`} style={styles.transferCard}>
            <View style={styles.transferHeader}>
              <TouchableOpacity
                onPress={() => onPlayerPress?.(transfer)}
                style={styles.playerPhotoContainer}
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
                <TouchableOpacity onPress={() => onPlayerPress?.(transfer)}>
                  <Text style={styles.playerName}>{transfer.player.name}</Text>
                </TouchableOpacity>
                <Text style={styles.transferDate}>{transfer.update}</Text>
              </View>
            </View>

            {transfer.league && (
              <View style={styles.leagueBadge}>
                {transfer.league.logo && (
                  <Image
                    source={{ uri: transfer.league.logo }}
                    style={styles.leagueLogoSmall}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                )}
                <Text style={styles.leagueNameSmall}>{transfer.league.name}</Text>
              </View>
            )}

            {transfer.transfers.map((t, tIndex) => (
              <View key={tIndex} style={styles.transferDetails}>
                {t.teams.out && (
                  <TouchableOpacity
                    style={styles.teamBox}
                    onPress={() => onTeamPress?.(t.teams.out!.id)}
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
                  <Ionicons name="arrow-forward" size={20} color={MATCH_DETAILS_COLORS.accent} />
                  <Text style={styles.transferType}>{t.type}</Text>
                  {t.date && <Text style={styles.transferDateSmall}>{t.date}</Text>}
                </View>

                {t.teams.in && (
                  <TouchableOpacity
                    style={styles.teamBox}
                    onPress={() => onTeamPress?.(t.teams.in!.id)}
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
  transfersList: {
    gap: 12,
  },
  transferCard: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerPhotoContainer: {
    marginRight: 12,
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    marginBottom: 4,
  },
  transferDate: {
    fontSize: 12,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  leagueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `rgba(34, 197, 94, 0.15)`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  leagueLogoSmall: {
    width: 14,
    height: 14,
    marginRight: 6,
    borderRadius: 7,
  },
  leagueNameSmall: {
    color: MATCH_DETAILS_COLORS.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  transferDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: MATCH_DETAILS_COLORS.border,
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 40,
    height: 40,
    marginBottom: 8,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    borderRadius: 20,
  },
  teamName: {
    fontSize: 11,
    color: MATCH_DETAILS_COLORS.text,
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
    color: MATCH_DETAILS_COLORS.accent,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  transferDateSmall: {
    fontSize: 9,
    color: MATCH_DETAILS_COLORS.textSecondary,
    marginTop: 2,
  },
});

export default TransfersSection;

