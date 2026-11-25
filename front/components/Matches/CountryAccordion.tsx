/**
 * CountryAccordion
 *
 * Country → League → Matches nested accordion for the matches screen.
 *
 * Performance notes (the screen used to feel instant — keep it that way):
 *  - Both country *and* league sections start COLLAPSED. Expanding the
 *    country alone never paints any match cards; the user has to also
 *    open a league. First paint only mounts country headers.
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
import { useRecyclingState } from '@shopify/flash-list';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CountryGroup, GroupedMatches } from '../../hooks/useMatchesData';
import { Match } from './matchCardUtils';
import { useTranslation } from '../../src/i18n';
import { getCountryDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import {
  getCountryFlagEmoji,
  getCountryFlagUri,
  isInternationalCountryGroup,
} from '../../utils/countryFlagUri';
import { isMisTaggedWorldCupLeagueName } from '../../constants/worldCup';
import { useMatchesTheme, type MatchesThemeColors } from '../../hooks/useMatchesTheme';
import { InternationalFlagIcon } from './InternationalFlagIcon';

// LayoutAnimation on Android is janky on long lists — we keep it iOS-only.
const ANIMATE_TOGGLE = Platform.OS === 'ios';

const MATCHES_PREVIEW_COUNT = 2;

const CountryFlagThumb = memo(function CountryFlagThumb({
  country,
  apiFlag,
}: {
  country: string;
  apiFlag: string | null;
}) {
  const { colors, isDark } = useMatchesTheme();
  const styles = useMemo(() => createAccordionStyles(colors), [colors]);
  const uri = useMemo(() => getCountryFlagUri(country, apiFlag), [country, apiFlag]);
  const emoji = useMemo(() => getCountryFlagEmoji(country, apiFlag), [country, apiFlag]);
  const useBrandFlag = useMemo(() => {
    if (isInternationalCountryGroup(country, apiFlag)) return true;
    if (!uri) return true;
    return emoji === '🏳️' || emoji === '🌍';
  }, [country, apiFlag, uri, emoji]);

  // Light theme: solid brand purple flag in a lavender squircle (Figma matches list).
  // Covers World/International and continent rows that have no national PNG.
  if (useBrandFlag && !isDark) {
    return (
      <View style={styles.brandFlagWrap}>
        <InternationalFlagIcon size={18} color="#6A2BD9" />
      </View>
    );
  }

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
  onViewAllLeague,
}: {
  league: GroupedMatches;
  renderMatchCard: (match: Match, index: number) => React.ReactNode;
  onViewAllLeague?: (leagueId: number, leagueName: string) => void;
}) {
  const onViewAll = useMemo(
    () =>
      onViewAllLeague ? () => onViewAllLeague(league.leagueId, league.leagueName) : undefined,
    [onViewAllLeague, league.leagueId, league.leagueName],
  );
  // Leagues start COLLAPSED — opening a country shouldn't paint a wall of
  // match cards. The user explicitly asked for this and it's also much
  // faster on first paint.
  const [expanded, setExpanded] = useState(false);
  const { colors } = useMatchesTheme();
  const styles = useMemo(() => createAccordionStyles(colors), [colors]);

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
  // non-WC name — never show the World Cup trophy / leagues/1.png for those.
  const rawLogo = league.leagueLogo?.trim() || '';
  const leagueLogoUri =
    isMisTaggedWorldCupLeagueName(league.leagueName) ||
    (league.leagueId === 1 && !/world\s*cup|fifa|كأس\s*العالم|مونديال/i.test(league.leagueName || ''))
      ? rawLogo && !/leagues\/1\.png/i.test(rawLogo)
        ? rawLogo
        : ''
      : rawLogo;

  return (
    <View style={styles.leagueSection}>
      {/* Competition header — Figma: count+chevron | name+logo */}
      <TouchableOpacity style={styles.leagueHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.leagueCountSide}>
          {expanded ? (
            <ChevronUp size={17} color={colors.primary} />
          ) : (
            <ChevronDown size={17} color={colors.primary} />
          )}
          <Text style={styles.matchCount}>{matchCount}</Text>
        </View>
        <View style={styles.leagueNameSide}>
          <Text style={styles.leagueName} numberOfLines={1}>{localizedLeagueName}</Text>
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
        </View>
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

/** Country accordion — the outer collapsible header with flag. */
export const CountryAccordion = memo(function CountryAccordion({
  countryGroup,
  renderMatchCard,
  onViewAllLeague,
  defaultExpanded = false,
}: CountryAccordionProps) {
  // FlashList recycles cells: plain useState would carry another country's
  // expanded state over and ignore defaultExpanded.
  const [expanded, setExpanded] = useRecyclingState(defaultExpanded, [countryGroup.country]);
  const { colors } = useMatchesTheme();
  const styles = useMemo(() => createAccordionStyles(colors), [colors]);
  const { language } = useTranslation();
  const localizedCountryName = getCountryDisplayName(countryGroup.country, language);

  const toggle = useCallback(() => {
    if (ANIMATE_TOGGLE) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(prev => !prev);
  }, [setExpanded]);

  // Sum is O(leagues) — cheap, no useMemo needed.
  let totalMatches = 0;
  for (const l of countryGroup.leagues) totalMatches += l.matches.length;

  return (
    <View style={styles.countryShell}>
      <View style={styles.countryContainer}>
        {/* Region header — Figma: count+chevron | name+flag */}
        <TouchableOpacity style={styles.countryHeader} onPress={toggle} activeOpacity={0.7}>
          <View style={styles.countryCountSide}>
            {expanded ? (
              <ChevronUp size={20} color={colors.primary} />
            ) : (
              <ChevronDown size={20} color={colors.primary} />
            )}
            <Text style={styles.totalBadge}>{totalMatches}</Text>
          </View>
          <View style={styles.countryNameSide}>
            <Text style={styles.countryName} numberOfLines={1}>{localizedCountryName}</Text>
            <CountryFlagThumb country={countryGroup.country} apiFlag={countryGroup.countryFlag} />
          </View>
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
                onViewAllLeague={onViewAllLeague}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

function createAccordionStyles(c: MatchesThemeColors) {
  return StyleSheet.create({
    countryShell: {
      marginBottom: 10,
      borderRadius: 18,
      shadowColor: '#D5C3F4',
      shadowOpacity: 0.75,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 0 },
      elevation: 3,
    },
    countryContainer: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: c.cardBg,
      borderWidth: 1.5,
      borderColor: c.cardBorder,
    },
    countryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 15,
      paddingVertical: 10,
      gap: 12,
    },
    countryCountSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    countryNameSide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      minWidth: 0,
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
      backgroundColor: c.logoStubBg,
    },
    brandFlagWrap: {
      width: 37,
      height: 35,
      borderRadius: 10,
      backgroundColor: c.upcomingBadgeBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 7,
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
      flexShrink: 1,
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: 'right',
    },
    totalBadge: {
      minWidth: 42,
      height: 29,
      fontSize: 14,
      fontWeight: '700',
      color: c.primary,
      backgroundColor: c.upcomingBadgeBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 15,
      overflow: 'hidden',
      textAlign: 'center',
    },
    leaguesWrapper: {
      paddingHorizontal: 10,
      paddingBottom: 10,
      gap: 10,
    },
    leagueSection: {
      borderRadius: 12,
      backgroundColor: c.competitionGroupBg,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
    },
    leagueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 8,
    },
    leagueCountSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    leagueNameSide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      minWidth: 0,
    },
    leagueLogo: {
      width: 18,
      height: 18,
      borderRadius: 4,
    },
    placeholderLogo: {
      backgroundColor: c.logoStubBg,
    },
    leagueName: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: c.primary,
      textAlign: 'right',
    },
    matchCount: {
      fontSize: 14,
      fontWeight: '600',
      color: c.primary,
    },
    matchesContainer: {
      gap: 8,
    },
    viewAllBtn: {
      alignItems: 'center',
      paddingVertical: 8,
      marginTop: 2,
      borderRadius: 8,
      backgroundColor: c.primaryMuted,
      borderWidth: 1,
      borderColor: c.primaryBorder,
    },
    viewAllText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.primarySoft,
    },
    leagueEmptyWrap: {
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    leagueEmptyText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
