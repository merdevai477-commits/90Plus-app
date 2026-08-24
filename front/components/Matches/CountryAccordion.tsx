/**
 * CountryAccordion
 *
 * Country → League → Matches nested accordion for the matches screen.
 *
 * Performance notes (the screen used to feel instant — keep it that way):
 *  - Both country *and* league sections start COLLAPSED. Expanding the
 *    country alone never paints any match cards; the user has to also
 *    open a league. This caps the worst-case render budget on first
 *    paint to England + live countries (default-expanded).
 *  - LayoutAnimation runs on iOS only. On Android the legacy
 *    LayoutAnimation pipeline blocks the JS thread for ~200–300ms per
 *    toggle and stutters mid-scroll, so we just snap on Android.
 *  - Images use cachePolicy="memory-disk" with NO transition and NO
 *    recyclingKey. expo-image already keys its memory cache by URI;
 *    setting recyclingKey={uri} forces a re-decode per cell which is
 *    the opposite of what we want.
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CountryGroup, GroupedMatches } from '../../hooks/useMatchesData';
import { Match } from './matchCardUtils';
import { useTranslation } from '../../src/i18n';
import { getCountryDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import { getCountryFlagEmoji, getCountryFlagUri } from '../../utils/countryFlagUri';

// LayoutAnimation on Android is janky on long lists — we keep it iOS-only.
// Don't even enable it on Android.
const ANIMATE_TOGGLE = Platform.OS === 'ios';

const MATCHES_PREVIEW_COUNT = 2;

const CountryFlagThumb = memo(function CountryFlagThumb({
  country,
  apiFlag,
}: {
  country: string;
  apiFlag: string | null;
}) {
  const uri = useMemo(() => getCountryFlagUri(country, apiFlag), [country, apiFlag]);
  const emoji = useMemo(() => getCountryFlagEmoji(country, apiFlag), [country, apiFlag]);

  if (!uri) {
    return <Text style={styles.flagEmoji}>{emoji}</Text>;
  }

  return (
    <View style={styles.flagWrap}>
      <Text style={styles.flagEmojiPlaceholder}>{emoji}</Text>
      <Image
        source={{ uri }}
        style={styles.countryFlag}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
      />
    </View>
  );
});

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

  const { translate: t, language } = useTranslation();
  const localizedLeagueName = getLeagueDisplayName(
    league.leagueName,
    language,
    league.leagueId,
    league.matches[0]?.league?.country,
  );
  const matchCount = league.matches.length;
  const hasMore = matchCount > MATCHES_PREVIEW_COUNT;
  // Mis-tagged synthetic rows sometimes land on WORLD_CUP_LEAGUE_ID (1) with a
  // non-WC name — never show the World Cup trophy for those.
  const leagueLogoUri =
    league.leagueId === 1 && !/world\s*cup|fifa/i.test(league.leagueName || '')
      ? ''
      : league.leagueLogo;

  return (
    <View style={styles.leagueSection}>
      {/* League Header */}
      <TouchableOpacity style={styles.leagueHeader} onPress={toggle} activeOpacity={0.7}>
        {leagueLogoUri ? (
          <Image
            source={{ uri: leagueLogoUri }}
            style={styles.leagueLogo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
        ) : (
          <View style={[styles.leagueLogo, styles.placeholderLogo]} />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>{localizedLeagueName}</Text>
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
          {matchCount === 0 ? (
            <View style={styles.leagueEmptyWrap}>
              <Text style={styles.leagueEmptyText}>{t('matches.screen.leagueDataUnavailable')}</Text>
            </View>
          ) : (
            <>
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
            </>
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
  const { language } = useTranslation();
  const localizedCountryName = getCountryDisplayName(countryGroup.country, language);

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
        <CountryFlagThumb country={countryGroup.country} apiFlag={countryGroup.countryFlag} />
        <Text style={styles.countryName} numberOfLines={1}>{localizedCountryName}</Text>
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
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
  },
  flagWrap: {
    width: 24,
    height: 16,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  flagEmoji: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  flagEmojiPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.85,
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
  leagueEmptyWrap: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  leagueEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default CountryAccordion;
