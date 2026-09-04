/**
 * FavoritesTab — followed teams (league-style accordion) + active bell matches.
 *
 * Team match payloads load only when a row is expanded (lazy). Each team shows
 * live-first, then ≤5 upcoming and ≤5 finished, hard-capped at 10.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
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
import { ChevronDown, ChevronUp, Bell } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import { useCompetitorMatches } from '../../hooks/useTeamProfile';
import {
    apiFixtureToListFixture,
    sliceTeamFavoriteMatches,
    storedMatchToListFixture,
    type FavoritesListFixture,
} from '../../hooks/useFavoritesFeed';
import type { StoredFollowedTeam } from '../../src/storage/teamFavorites.storage';
import type { StoredFavoriteMatch } from '../../src/storage/matchFavorites.storage';
import { useTranslation } from '../../src/i18n';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';

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
    const matchesQ = useCompetitorMatches(team.apiTeamId, expanded);
    const fixtures = useMemo(() => {
        if (!matchesQ.data) return [] as FavoritesListFixture[];
        return sliceTeamFavoriteMatches(matchesQ.data).map(apiFixtureToListFixture);
    }, [matchesQ.data]);

    const liveIds = useMemo(
        () =>
            fixtures
                .filter((f) => f.status === 'LIVE')
                .map((f) => Number(f.id))
                .filter((id) => Number.isFinite(id) && id > 0),
        [fixtures],
    );
    useRegisterLiveFixtures(liveIds);

    const toggle = useCallback(() => {
        if (ANIMATE_TOGGLE) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        setExpanded((v) => !v);
    }, []);

    return (
        <View style={styles.teamCard}>
            <TouchableOpacity
                style={styles.teamHeader}
                onPress={toggle}
                onLongPress={() => onOpenTeam?.(team)}
                delayLongPress={280}
                activeOpacity={0.75}
            >
                {team.teamLogo ? (
                    <Image
                        source={{ uri: team.teamLogo }}
                        style={styles.teamLogo}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={0}
                    />
                ) : (
                    <View style={[styles.teamLogo, styles.logoPlaceholder]} />
                )}
                <View style={styles.teamTitleWrap}>
                    <Text style={styles.teamName} numberOfLines={1}>
                        {team.teamName}
                    </Text>
                    {team.country ? (
                        <Text style={styles.teamCountry} numberOfLines={1}>
                            {team.country}
                        </Text>
                    ) : null}
                </View>
                {expanded ? (
                    <ChevronUp size={16} color="rgba(255,255,255,0.45)" />
                ) : (
                    <ChevronDown size={16} color="rgba(255,255,255,0.45)" />
                )}
            </TouchableOpacity>

            {expanded ? (
                <View style={styles.matchesWrap}>
                    {matchesQ.isLoading ? (
                        <ActivityIndicator color="#a855f7" style={{ marginVertical: 16 }} />
                    ) : fixtures.length === 0 ? (
                        <Text style={styles.emptyMatches}>—</Text>
                    ) : (
                        fixtures.map((fixture) => (
                            <View key={fixture.id} style={styles.matchSlot}>
                                {renderFixture(fixture)}
                            </View>
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
                    <View style={styles.notifiedCard}>
                        <View style={styles.notifiedBadge}>
                            <Bell size={12} color="#e9d5ff" fill="#a855f7" />
                            <Text style={styles.notifiedBadgeTxt}>
                                {t.matches.screen.favoritesNotifiedBadge}
                            </Text>
                        </View>
                        {renderFixture(fixture)}
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
    teamCard: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(12,10,20,0.85)',
        overflow: 'hidden',
    },
    teamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    teamLogo: {
        width: 28,
        height: 28,
        borderRadius: 6,
    },
    logoPlaceholder: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    teamTitleWrap: {
        flex: 1,
        minWidth: 0,
    },
    teamName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    teamCountry: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        marginTop: 1,
    },
    matchesWrap: {
        paddingHorizontal: 8,
        paddingBottom: 10,
        gap: 6,
    },
    matchSlot: {
        marginBottom: 2,
    },
    emptyMatches: {
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        paddingVertical: 12,
        fontSize: 13,
    },
    notifiedCard: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.28)',
        backgroundColor: 'rgba(20,10,35,0.9)',
        paddingTop: 8,
        paddingBottom: 6,
        paddingHorizontal: 8,
    },
    notifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        marginBottom: 6,
        marginLeft: 4,
        backgroundColor: 'rgba(168,85,247,0.18)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    notifiedBadgeTxt: {
        color: '#e9d5ff',
        fontSize: 11,
        fontWeight: '700',
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
