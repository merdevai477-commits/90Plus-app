/**
 * CountryAccordion
 *
 * Renders the Country → League → Matches nested accordion for the matches screen.
 * - Country header: flag + name (collapsible)
 * - League section: logo + name + first 2 matches + "View All" button
 * - Performance: uses memo + stable callbacks, no unnecessary re-renders
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CountryGroup, GroupedMatches } from '../../hooks/useMatchesData';
import { Match } from './matchCardUtils';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MATCHES_PREVIEW_COUNT = 2;

interface CountryAccordionProps {
  countryGroup: CountryGroup;
  renderMatchCard: (match: Match, index: number) => React.ReactNode;
  onViewAllLeague?: (leagueId: number, leagueName: string) => void;
  defaultExpanded?: boolean;
}

/** Single league section within a country */
const LeagueSection = memo(function LeagueSection({
  league,
  renderMatchCard,
  onViewAll,
}: {
  league: GroupedMatches;
  renderMatchCard: (match: Match, index: number) => React.ReactNode;
  onViewAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasMore = league.matches.length > MATCHES_PREVIEW_COUNT;
  const visibleMatches = expanded ? league.matches.slice(0, MATCHES_PREVIEW_COUNT) : [];

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  return (
    <View style={styles.leagueSection}>
      {/* League Header */}
      <TouchableOpacity style={styles.leagueHeader} onPress={toggle} activeOpacity={0.7}>
        {league.leagueLogo ? (
          <Image source={{ uri: league.leagueLogo }} style={styles.leagueLogo} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.leagueLogo, styles.placeholderLogo]} />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>{league.leagueName}</Text>
        <Text style={styles.matchCount}>{league.matches.length}</Text>
        {expanded ? (
          <ChevronUp size={14} color="rgba(255,255,255,0.4)" />
        ) : (
          <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
        )}
      </TouchableOpacity>

      {/* Match Cards */}
      {expanded && (
        <View style={styles.matchesContainer}>
          {visibleMatches.map((match, i) => (
            <View key={match.id}>{renderMatchCard(match, i)}</View>
          ))}
          {hasMore && onViewAll && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={onViewAll} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>عرض الكل ({league.matches.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

/** Country accordion — the outer collapsible header */
export const CountryAccordion = memo(function CountryAccordion({
  countryGroup,
  renderMatchCard,
  onViewAllLeague,
  defaultExpanded = false,
}: CountryAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  const totalMatches = countryGroup.leagues.reduce((sum, l) => sum + l.matches.length, 0);

  return (
    <View style={styles.countryContainer}>
      {/* Country Header */}
      <TouchableOpacity style={styles.countryHeader} onPress={toggle} activeOpacity={0.7}>
        {countryGroup.countryFlag ? (
          <Image source={{ uri: countryGroup.countryFlag }} style={styles.countryFlag} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <Text style={styles.flagEmoji}>🌍</Text>
        )}
        <Text style={styles.countryName}>{countryGroup.country}</Text>
        <Text style={styles.totalBadge}>{totalMatches}</Text>
        {expanded ? (
          <ChevronUp size={16} color="rgba(255,255,255,0.5)" />
        ) : (
          <ChevronDown size={16} color="rgba(255,255,255,0.5)" />
        )}
      </TouchableOpacity>

      {/* Leagues (visible when expanded) */}
      {expanded && (
        <View style={styles.leaguesWrapper}>
          {countryGroup.leagues.map(league => (
            <LeagueSection
              key={league.leagueId}
              league={league}
              renderMatchCard={renderMatchCard}
              onViewAll={onViewAllLeague ? () => onViewAllLeague(league.leagueId, league.leagueName) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  countryContainer: {
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  countryFlag: {
    width: 24,
    height: 16,
    borderRadius: 2,
  },
  flagEmoji: {
    fontSize: 16,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  leaguesWrapper: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  leagueSection: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  leagueLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  placeholderLogo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  leagueName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  matchCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginEnd: 4,
  },
  matchesContainer: {
    paddingHorizontal: 4,
    paddingBottom: 6,
    gap: 4,
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA',
  },
});

export default CountryAccordion;
