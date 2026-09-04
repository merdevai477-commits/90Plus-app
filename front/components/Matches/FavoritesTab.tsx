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
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
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
import type { StoredFollowedTeam } from '../../src/storage/teamFavorites.storage';
import type { StoredFavoriteMatch } from '../../src/storage/matchFavorites.storage';
import { CompetitorMatchesCache } from '../../src/storage/competitorMatches.cache';
import { useTranslation } from '../../src/i18n';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';
import { getLeagueDisplayName } from '../../utils/i18nHelpers';

const ANIMATE_TOGGLE = Platform.OS === 'ios';

type ListRow =
    | { type: 'section'; id: string; title: string }
    | { type: 'notified'; id: string; match: StoredFavoriteMatch }
    | { type: 'team'; id: string; team: StoredFollowedTeam };

export interface FavoritesTabProps {
    followedTeams: StoredFollowedTeam[];
    notifiedMatches: StoredFavoriteMatch[];
    loading?: boolean;
    headerOffset: number;
    listHeader?: React.ReactElement | null;
    renderFixture: (fixture: FavoritesListFixture) => React.ReactNode;
    onOpenTeam?: (team: StoredFollowedTeam) => void;
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
                        <ChevronUp size={14} color="rgba(255,255,255,0.4)" />
                    ) : (
                        <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
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
}: {
    team: StoredFollowedTeam;
    renderFixture: (fixture: FavoritesListFixture) => React.ReactNode;
    onOpenTeam?: (team: StoredFollowedTeam) => void;
}) {
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

    const fixtures = useMemo(() => {
        if (matchesQ.data) {
            return sliceTeamFavoriteMatches(matchesQ.data).map(apiFixtureToListFixture);
        }
        return diskFixtures;
    }, [matchesQ.data, diskFixtures]);

    const leagueGroups = useMemo(() => groupFixturesByLeague(fixtures), [fixtures]);

    const headlineCompetition = useMemo(() => {
        const first = fixtures.find((f) => f.status === 'LIVE') ?? fixtures[0];
        return first?.leagueName || team.country || null;
    }, [fixtures, team.country]);

    const liveIds = useMemo(
        () =>
            fixtures
                .filter((f) => f.status === 'LIVE')
                .map((f) => Number(f.id))
                .filter((id) => Number.isFinite(id) && id > 0),
        [fixtures],
    );
    useRegisterLiveFixtures(expanded ? liveIds : []);

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
                    <ChevronUp size={16} color="rgba(255,255,255,0.5)" />
                ) : (
                    <ChevronDown size={16} color="rgba(255,255,255,0.5)" />
                )}
            </TouchableOpacity>

            {expanded ? (
                <View style={styles.leaguesWrapper}>
                    {showSpinner ? (
                        <ActivityIndicator color="#a855f7" style={{ marginVertical: 16 }} />
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

export default function FavoritesTab({
    followedTeams,
    notifiedMatches,
    loading,
    headerOffset,
    listHeader,
    renderFixture,
    onOpenTeam,
}: FavoritesTabProps) {
    const { t } = useTranslation();

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
        if (followedTeams.length > 0) {
            out.push({
                type: 'section',
                id: 'sec-teams',
                title: t.matches.screen.favoritesTeamsSection,
            });
            for (const team of followedTeams) {
                out.push({ type: 'team', id: `t-${team.apiTeamId}`, team });
            }
        }
        return out;
    }, [followedTeams, notifiedMatches, t]);

    const renderItem = useCallback(
        ({ item }: { item: ListRow }) => {
            if (item.type === 'section') {
                return (
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                    </View>
                );
            }
            if (item.type === 'notified') {
                const fixture = storedMatchToListFixture(item.match);
                return (
                    <View style={styles.teamContainer}>
                        <LeagueMatchBlock
                            leagueName={fixture.leagueName || item.match.leagueName || 'Match'}
                            leagueLogo={fixture.leagueLogo || item.match.leagueLogo}
                            fixtures={[fixture]}
                            renderFixture={renderFixture}
                            showChevron
                            expanded
                        />
                    </View>
                );
            }
            return (
                <TeamFavoriteRow
                    team={item.team}
                    renderFixture={renderFixture}
                    onOpenTeam={onOpenTeam}
                />
            );
        },
        [onOpenTeam, renderFixture, t],
    );

    const empty = !loading && rows.length === 0;

    return (
        <FlashList
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={renderItem}
            drawDistance={250}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 120,
                paddingTop: headerOffset,
            }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={listHeader ?? null}
            ListEmptyComponent={
                empty ? (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyTitle}>{t.matches.screen.favoritesEmptyTitle}</Text>
                        <Text style={styles.emptySub}>{t.matches.screen.favoritesEmptyBody}</Text>
                    </View>
                ) : loading ? (
                    <ActivityIndicator color="#a855f7" style={{ marginTop: 40 }} />
                ) : null
            }
        />
    );
}

const styles = StyleSheet.create({
    sectionHeader: {
        paddingTop: 8,
        paddingBottom: 4,
    },
    sectionTitle: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    teamContainer: {
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    teamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
    },
    teamLogo: {
        width: 28,
        height: 28,
        borderRadius: 8,
    },
    placeholderLogo: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    teamTitleWrap: {
        flex: 1,
        minWidth: 0,
    },
    teamName: {
        flexShrink: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    teamSub: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.45)',
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
    emptyMatches: {
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        paddingVertical: 12,
        fontSize: 13,
    },
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
        gap: 8,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        textAlign: 'center',
    },
    emptySub: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
});
