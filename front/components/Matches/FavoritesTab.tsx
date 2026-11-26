/**
 * FavoritesTab — followed teams (league-style accordion) + active bell matches.
 *
 * Notified match cards only render for real bell subscriptions.
 * Team rows mirror CountryAccordion / LeagueSection chrome: club logo + name,
 * championship groups when expanded, MatchRow cards identical to Matches.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, ChevronRight, Heart, Search } from 'lucide-react-native';
import { useMatchesTheme, type MatchesThemeColors } from '../../hooks/useMatchesTheme';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import {
    useFavoriteCompetitorMatches,
    usePrefetchFavoriteCompetitorMatches,
} from '../../hooks/useTeamProfile';
import {
    apiFixtureToListFixture,
    groupFixturesByLeague,
    sliceTeamFavoriteMatches,
    storedMatchToListFixture,
    type FavoritesListFixture,
} from '../../hooks/useFavoritesFeed';
import { useFavoritesLiveOverlay } from '../../hooks/useFavoritesLiveOverlay';
import {
    overlayLiveListOnFavorites,
    type FavoriteLiveFields,
} from '../../utils/overlaySnapshotsOnFavorites';
import type { StoredFollowedTeam } from '../../src/storage/teamFavorites.storage';
import type { StoredFollowedLeague } from '../../src/storage/leagueFavorites.storage';
import type { StoredFavoriteMatch } from '../../src/storage/matchFavorites.storage';
import { CompetitorMatchesCache } from '../../src/storage/competitorMatches.cache';
import { useTranslation } from '../../src/i18n';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';
import { getLeagueDisplayName } from '../../utils/i18nHelpers';

const ANIMATE_TOGGLE = Platform.OS === 'ios';
const EMPTY_LIVE_BY_ID: Record<string, FavoriteLiveFields> = {};

type ListRow =
    | { type: 'section'; id: string; title: string }
    | { type: 'notified'; id: string; match: StoredFavoriteMatch }
    | { type: 'team'; id: string; team: StoredFollowedTeam }
    | { type: 'league'; id: string; league: StoredFollowedLeague }
    | { type: 'cta'; id: string };

export interface FavoritesTabProps {
    followedTeams: StoredFollowedTeam[];
    followedLeagues?: StoredFollowedLeague[];
    notifiedMatches: StoredFavoriteMatch[];
    /** Score and clock from the matches list, keyed by fixture id. */
    liveById?: Record<string, FavoriteLiveFields>;
    loading?: boolean;
    headerOffset: number;
    listHeader?: React.ReactElement | null;
    renderFixture: (fixture: FavoritesListFixture) => React.ReactNode;
    onOpenTeam?: (team: StoredFollowedTeam) => void;
    onOpenLeague?: (league: StoredFollowedLeague) => void;
    onChooseFavoriteTeam?: () => void;
    refreshControl?: React.ReactElement<import('react-native').RefreshControlProps>;
    /** Optional FlashList style — used by the matches horizontal pager for a bounded height. */
    listStyle?: StyleProp<ViewStyle>;
    onLoad?: (info: { elapsedTimeInMs: number }) => void;
    onCommitLayoutEffect?: () => void;
}

function ChooseFavoriteTeamCta({ onPress, label }: { onPress: () => void; label: string }) {
    const { colors } = useMatchesTheme();
    const styles = useMemo(() => createFavoritesStyles(colors), [colors]);
    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={styles.ctaOuter}
        >
            <LinearGradient
                colors={['#8B5CF6', '#6D28D9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
            >
                <View style={styles.ctaIconWrap}>
                    <Heart size={18} color={colors.textInverse} fill={colors.textInverse} />
                </View>
                <Text style={styles.ctaLabel} numberOfLines={2}>
                    {label}
                </Text>
                <Search size={18} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
        </TouchableOpacity>
    );
}


const LeagueMatchBlock = memo(function LeagueMatchBlock({
    leagueName,
    leagueLogo,
    fixtures,
    renderFixture,
    showChevron = false,
    expanded = true,
}: {
    leagueName: string;
    leagueLogo?: string;
    fixtures: FavoritesListFixture[];
    renderFixture: (fixture: FavoritesListFixture) => React.ReactNode;
    showChevron?: boolean;
    expanded?: boolean;
}) {
    const { colors } = useMatchesTheme();
    const styles = useMemo(() => createFavoritesStyles(colors), [colors]);
    const { language } = useTranslation();
    const title = getLeagueDisplayName(leagueName, language) || leagueName;

    return (
        <View style={styles.leagueSection}>
            <View style={styles.leagueHeader}>
                {leagueLogo ? (
                    <Image
                        source={{ uri: leagueLogo }}
                        style={styles.leagueLogo}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={0}
                    />
                ) : (
                    <View style={[styles.leagueLogo, styles.placeholderLogo]} />
                )}
                <Text style={styles.leagueName} numberOfLines={1}>
                    {title}
                </Text>
                <Text style={styles.matchCount}>{fixtures.length}</Text>
                {showChevron ? (
                    expanded ? (
                        <ChevronUp size={14} color={colors.iconMuted} />
                    ) : (
                        <ChevronDown size={14} color={colors.iconMuted} />
                    )
                ) : null}
            </View>
            {expanded ? (
                <View style={styles.matchesContainer}>
                    {fixtures.map((fixture) => (
                        <View key={fixture.id}>{renderFixture(fixture)}</View>
                    ))}
                </View>
            ) : null}
        </View>
    );
});

const TeamFavoriteRow = memo(function TeamFavoriteRow({
    team,
    renderFixture,
    onOpenTeam,
    liveById,
}: {
    team: StoredFollowedTeam;
    renderFixture: (fixture: FavoritesListFixture) => React.ReactNode;
    onOpenTeam?: (team: StoredFollowedTeam) => void;
    liveById: Record<string, FavoriteLiveFields>;
}) {
    const { colors } = useMatchesTheme();
    const styles = useMemo(() => createFavoritesStyles(colors), [colors]);
    const [expanded, setExpanded] = useState(false);
    const [diskFixtures, setDiskFixtures] = useState<FavoritesListFixture[]>([]);
    const prefetch = usePrefetchFavoriteCompetitorMatches();
    const matchesQ = useFavoriteCompetitorMatches(team.apiTeamId, expanded);

    useEffect(() => {
        let cancelled = false;
        void CompetitorMatchesCache.read(team.apiTeamId).then((cached) => {
            if (cancelled || !cached) return;
            setDiskFixtures(sliceTeamFavoriteMatches(cached).map(apiFixtureToListFixture));
        });
        return () => {
            cancelled = true;
        };
    }, [team.apiTeamId]);

    const baseFixtures = useMemo(() => {
        if (matchesQ.data) {
            return sliceTeamFavoriteMatches(matchesQ.data).map(apiFixtureToListFixture);
        }
        return diskFixtures;
    }, [matchesQ.data, diskFixtures]);

    const storeFixtures = useFavoritesLiveOverlay(baseFixtures);
    const fixtures = useMemo(
        () => overlayLiveListOnFavorites(storeFixtures, liveById),
        [storeFixtures, liveById],
    );

    const leagueGroups = useMemo(() => groupFixturesByLeague(fixtures), [fixtures]);

    const headlineCompetition = useMemo(() => {
        const first = fixtures.find((f) => f.status === 'LIVE') ?? fixtures[0];
        return first?.leagueName || team.country || null;
    }, [fixtures, team.country]);

    // Register interest for in-play / not-finished rows so liveFixtureStore stays warm.
    // Cap is enforced inside the store; accordion max ~10 fixtures.
    const interestIds = useMemo(
        () =>
            fixtures
                .filter((f) => f.status !== 'FT')
                .map((f) => Number(f.id))
                .filter((id) => Number.isFinite(id) && id > 0),
        [fixtures],
    );
    useRegisterLiveFixtures(expanded ? interestIds : []);

    const toggle = useCallback(() => {
        if (ANIMATE_TOGGLE) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        setExpanded((v) => !v);
    }, []);

    const onPressIn = useCallback(() => {
        prefetch(team.apiTeamId);
    }, [prefetch, team.apiTeamId]);

    const showSpinner = expanded && matchesQ.isLoading && fixtures.length === 0;
    const matchCount = fixtures.length;

    return (
        <View style={styles.teamContainer}>
            <TouchableOpacity
                style={styles.teamHeader}
                onPress={toggle}
                onPressIn={onPressIn}
                onLongPress={() => onOpenTeam?.(team)}
                delayLongPress={280}
                activeOpacity={0.7}
            >
                {team.teamLogo ? (
                    <Image
                        source={{ uri: team.teamLogo }}
                        style={styles.teamLogo}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={0}
                        priority="high"
                    />
                ) : (
                    <View style={[styles.teamLogo, styles.placeholderLogo]} />
                )}
                <View style={styles.teamTitleWrap}>
                    <Text style={styles.teamName} numberOfLines={1}>
                        {team.teamName}
                    </Text>
                    {headlineCompetition ? (
                        <Text style={styles.teamSub} numberOfLines={1}>
                            {headlineCompetition}
                        </Text>
                    ) : null}
                </View>
                {matchCount > 0 ? <Text style={styles.totalBadge}>{matchCount}</Text> : null}
                {expanded ? (
                    <ChevronUp size={16} color={colors.iconMuted} />
                ) : (
                    <ChevronDown size={16} color={colors.iconMuted} />
                )}
            </TouchableOpacity>

            {expanded ? (
                <View style={styles.leaguesWrapper}>
                    {showSpinner ? (
                        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                    ) : leagueGroups.length === 0 ? (
                        <Text style={styles.emptyMatches}>—</Text>
                    ) : (
                        leagueGroups.map((group) => (
                            <LeagueMatchBlock
                                key={group.key}
                                leagueName={group.leagueName}
                                leagueLogo={group.leagueLogo}
                                fixtures={group.fixtures}
                                renderFixture={renderFixture}
                            />
                        ))
                    )}
                </View>
            ) : null}
        </View>
    );
});

const LeagueFavoriteRow = memo(function LeagueFavoriteRow({
    league,
    onOpenLeague,
}: {
    league: StoredFollowedLeague;
    onOpenLeague?: (league: StoredFollowedLeague) => void;
}) {
    const { colors } = useMatchesTheme();
    const styles = useMemo(() => createFavoritesStyles(colors), [colors]);
    const { language } = useTranslation();
    return (
        <TouchableOpacity
            style={styles.teamHeader}
            onPress={() => onOpenLeague?.(league)}
            activeOpacity={0.7}
            accessibilityRole="button"
        >
            {league.logo ? (
                <Image
                    source={{ uri: league.logo }}
                    style={styles.teamLogo}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    priority="high"
                />
            ) : (
                <View style={[styles.teamLogo, styles.placeholderLogo]} />
            )}
            <View style={styles.teamTitleWrap}>
                <Text style={styles.teamName} numberOfLines={1}>
                    {getLeagueDisplayName(
                        league.name,
                        language,
                        league.competitionId,
                        league.country,
                    )}
                </Text>
                {league.country ? (
                    <Text style={styles.teamSub} numberOfLines={1}>
                        {league.country}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={16} color={colors.iconMuted} />
        </TouchableOpacity>
    );
});

const NotifiedFavoriteBlock = memo(function NotifiedFavoriteBlock({
    match,
    renderFixture,
    liveById,
}: {
    match: StoredFavoriteMatch;
    renderFixture: (fixture: FavoritesListFixture) => React.ReactNode;
    liveById: Record<string, FavoriteLiveFields>;
}) {
    const { colors } = useMatchesTheme();
    const styles = useMemo(() => createFavoritesStyles(colors), [colors]);
    const base = useMemo(() => [storedMatchToListFixture(match)], [match]);
    const storeFixtures = useFavoritesLiveOverlay(base);
    const fixtures = useMemo(
        () => overlayLiveListOnFavorites(storeFixtures, liveById),
        [storeFixtures, liveById],
    );
    const fixture = fixtures[0] ?? base[0];

    const interestIds = useMemo(() => {
        const id = Number(fixture.id);
        if (!Number.isFinite(id) || id <= 0) return [];
        if (fixture.status === 'FT') return [];
        return [id];
    }, [fixture.id, fixture.status]);
    useRegisterLiveFixtures(interestIds);

    return (
        <View style={styles.teamContainer}>
            <LeagueMatchBlock
                leagueName={fixture.leagueName || match.leagueName || 'Match'}
                leagueLogo={fixture.leagueLogo || match.leagueLogo}
                fixtures={[fixture]}
                renderFixture={renderFixture}
                showChevron
                expanded
            />
        </View>
    );
});

export default function FavoritesTab({
    followedTeams,
    followedLeagues = [],
    notifiedMatches,
    liveById = EMPTY_LIVE_BY_ID,
    loading,
    headerOffset,
    listHeader,
    renderFixture,
    onOpenTeam,
    onOpenLeague,
    onChooseFavoriteTeam,
    refreshControl,
    listStyle,
    onLoad,
    onCommitLayoutEffect,
}: FavoritesTabProps) {
  const { colors } = useMatchesTheme();
  const styles = useMemo(() => createFavoritesStyles(colors), [colors]);
    const { t } = useTranslation();
    const chooseLabel =
        t.matches.screen.favoritesChooseTeamCta ?? 'Choose your favorite team now';

    const rows = useMemo<ListRow[]>(() => {
        const out: ListRow[] = [];
        if (notifiedMatches.length > 0) {
            out.push({
                type: 'section',
                id: 'sec-notified',
                title: t.matches.screen.favoritesNotifiedSection,
            });
            for (const match of notifiedMatches) {
                out.push({ type: 'notified', id: `n-${match.id}`, match });
            }
        }
        if (followedLeagues.length > 0) {
            out.push({
                type: 'section',
                id: 'sec-leagues',
                title:
                    t.matches.screen.favoritesLeaguesSection ??
                    t.searchScreen.sectionCompetitions,
            });
            for (const league of followedLeagues) {
                out.push({
                    type: 'league',
                    id: `l-${league.competitionId}`,
                    league,
                });
            }
        }
        if (followedTeams.length > 0) {
            out.push({
                type: 'section',
                id: 'sec-teams',
                title: t.matches.screen.favoritesTeamsSection,
            });
            for (const team of followedTeams) {
                out.push({ type: 'team', id: `t-${team.apiTeamId}`, team });
            }
        } else if (
            !loading &&
            onChooseFavoriteTeam &&
            (notifiedMatches.length > 0 || followedLeagues.length > 0)
        ) {
            // Notified matches / leagues exist but no followed club yet — keep a pick-team CTA in-list.
            out.push({ type: 'section', id: 'sec-teams', title: t.matches.screen.favoritesTeamsSection });
            out.push({ type: 'cta', id: 'cta-choose-team' });
        }
        return out;
    }, [followedTeams, followedLeagues, notifiedMatches, loading, onChooseFavoriteTeam, t]);

    const renderItem = useCallback(
        ({ item }: { item: ListRow }) => {
            if (item.type === 'section') {
                return (
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                    </View>
                );
            }
            if (item.type === 'cta') {
                return onChooseFavoriteTeam ? (
                    <ChooseFavoriteTeamCta onPress={onChooseFavoriteTeam} label={chooseLabel} />
                ) : null;
            }
            if (item.type === 'notified') {
                return (
                    <NotifiedFavoriteBlock
                        match={item.match}
                        renderFixture={renderFixture}
                        liveById={liveById}
                    />
                );
            }
            if (item.type === 'league') {
                return (
                    <View style={styles.teamContainer}>
                        <LeagueFavoriteRow league={item.league} onOpenLeague={onOpenLeague} />
                    </View>
                );
            }
            return (
                <TeamFavoriteRow
                    team={item.team}
                    renderFixture={renderFixture}
                    onOpenTeam={onOpenTeam}
                    liveById={liveById}
                />
            );
        },
        [onOpenTeam, onOpenLeague, onChooseFavoriteTeam, chooseLabel, renderFixture, liveById],
    );

    const empty = !loading && rows.length === 0;

    return (
        <FlashList
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={renderItem}
            drawDistance={250}
            style={listStyle}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 120,
                paddingTop: headerOffset,
            }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={listHeader ?? null}
            refreshControl={refreshControl}
            onLoad={onLoad}
            onCommitLayoutEffect={onCommitLayoutEffect}
            ListEmptyComponent={
                empty ? (
                    <View style={styles.emptyWrap}>
                        <View style={styles.emptyIconRing}>
                            <Heart size={28} color={colors.primarySoft} />
                        </View>
                        <Text style={styles.emptyTitle}>{t.matches.screen.favoritesEmptyTitle}</Text>
                        <Text style={styles.emptySub}>{t.matches.screen.favoritesEmptyBody}</Text>
                        {onChooseFavoriteTeam ? (
                            <ChooseFavoriteTeamCta
                                onPress={onChooseFavoriteTeam}
                                label={chooseLabel}
                            />
                        ) : null}
                    </View>
                ) : loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                ) : null
            }
        />
    );
}

function createFavoritesStyles(c: MatchesThemeColors) {
  return StyleSheet.create({
    sectionHeader: { paddingTop: 8, paddingBottom: 4 },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    teamContainer: {
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: c.cardBg,
      borderWidth: 1.5,
      borderColor: c.cardBorder,
      shadowColor: '#24104E',
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    teamHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    teamLogo: { width: 28, height: 28, borderRadius: 8 },
    placeholderLogo: { backgroundColor: c.logoStubBg },
    teamTitleWrap: { flex: 1, minWidth: 0 },
    teamName: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: c.textPrimary },
    teamSub: { marginTop: 2, fontSize: 12, fontWeight: '500', color: c.textMuted },
    totalBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
      backgroundColor: c.chipBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    leaguesWrapper: { paddingHorizontal: 8, paddingBottom: 8 },
    leagueSection: {
      marginTop: 4,
      borderRadius: 10,
      backgroundColor: c.chipBg,
      overflow: 'hidden',
    },
    leagueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
    },
    leagueLogo: { width: 20, height: 20, borderRadius: 4 },
    leagueName: { flex: 1, fontSize: 13, fontWeight: '600', color: c.textPrimary },
    matchCount: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginEnd: 4 },
    matchesContainer: { paddingHorizontal: 4, paddingBottom: 6, gap: 4 },
    emptyMatches: { color: c.textMuted, textAlign: 'center', paddingVertical: 12, fontSize: 13 },
    emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
    emptyIconRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primaryMuted,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      marginBottom: 6,
    },
    emptyTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
    emptySub: {
      color: c.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 8,
    },
    ctaOuter: {
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      marginTop: 4,
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    ctaGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
      paddingHorizontal: 16,
      minHeight: 56,
    },
    ctaIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    ctaLabel: {
      flex: 1,
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  });
}
