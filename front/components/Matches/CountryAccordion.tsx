/**
 * CountryAccordion
 *
 * Country → League → Matches nested accordion for the matches screen.
 *
 * Performance notes (the screen used to feel instant — keep it that way):
 *  - Both country *and* league sections start COLLAPSED. Expanding the
 *    country alone never paints any match cards; the user has to also
 *    open a league. This caps the worst-case render budget on first
 *    paint to ~5 country headers (TOP5 default-expanded).
 *  - LayoutAnimation runs on iOS only. On Android the legacy
 *    LayoutAnimation pipeline blocks the JS thread for ~200–300ms per
 *    toggle and stutters mid-scroll, so we just snap on Android.
 *  - Images use cachePolicy="memory-disk" with NO transition and NO
 *    recyclingKey. expo-image already keys its memory cache by URI;
 *    setting recyclingKey={uri} forces a re-decode per cell which is
 *    the opposite of what we want.
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CountryGroup, GroupedMatches } from '../../hooks/useMatchesData';
import { Match } from './matchCardUtils';
import { useTranslation } from '../../src/i18n';

// LayoutAnimation on Android is janky on long lists — we keep it iOS-only.
// Don't even enable it on Android.
const ANIMATE_TOGGLE = Platform.OS === 'ios';

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
  // Leagues start COLLAPSED — opening a country shouldn't paint a wall of
  // match cards. The user explicitly asked for this and it's also much
  // faster on first paint.
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    if (ANIMATE_TOGGLE) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(prev => !prev);
  }, []);

  const { translate: t } = useTranslation();
  const matchCount = league.matches.length;
  const hasMore = matchCount > MATCHES_PREVIEW_COUNT;

  return (
    <View style={styles.leagueSection}>
      {/* League Header */}
      <TouchableOpacity style={styles.leagueHeader} onPress={toggle} activeOpacity={0.7}>
        {league.leagueLogo ? (
          <Image
            source={{ uri: league.leagueLogo }}
            style={styles.leagueLogo}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="low"
          />
        ) : (
          <View style={[styles.leagueLogo, styles.placeholderLogo]} />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>{league.leagueName}</Text>
        <Text style={styles.matchCount}>{matchCount}</Text>
        {expanded ? (
          <ChevronUp size={14} color="rgba(255,255,255,0.4)" />
        ) : (
          <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
        )}
      </TouchableOpacity>

      {/* Match Cards — only rendered when this league is expanded.
          Slicing a small array is cheaper than mounting cards we won't show. */}
      {expanded && (
        <View style={styles.matchesContainer}>
          {league.matches.slice(0, MATCHES_PREVIEW_COUNT).map((match, i) => (
            // Fallback to index if the API ever returns a match without
            // a stable id — keeps React's reconciler happy either way.
            <View key={match.id ?? `m-${i}`}>{renderMatchCard(match, i)}</View>
          ))}
          {hasMore && onViewAll && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={onViewAll} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>
                {t('matches.screen.viewAll').replace('{{count}}', String(matchCount))}
              </Text>
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
    if (ANIMATE_TOGGLE) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(prev => !prev);
  }, []);

  // Sum is O(leagues) — cheap, no useMemo needed.
  let totalMatches = 0;
  for (const l of countryGroup.leagues) totalMatches += l.matches.length;

  return (
    <View style={styles.countryContainer}>
      {/* Country Header */}
      <TouchableOpacity style={styles.countryHeader} onPress={toggle} activeOpacity={0.7}>
        {countryGroup.countryFlag ? (
          <Image
            source={{ uri: countryGroup.countryFlag }}
            style={styles.countryFlag}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="low"
          />
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

      {/* Leagues are only mounted when the country is expanded. This is the
          single biggest win — non-expanded countries pay zero cost beyond
          their header. */}
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
