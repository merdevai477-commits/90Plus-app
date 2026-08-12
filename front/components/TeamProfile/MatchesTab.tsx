/**
 * Matches tab: status filter (All / Live / Upcoming / Finished), a dynamic
 * competition filter, and the fixture list. Live scores update in place via the
 * shared live-fixture store.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { Language } from '../../src/i18n/types';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Fixture } from '../../services/apiFootball';
import type { TeamMatches } from '../../hooks/useTeamProfile';
import { getLeagueDisplayName } from '../../utils/i18nHelpers';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';
import { Card, EmptyState, MatchRow } from './shared';
import { deriveCompetitions } from './utils';

type StatusFilter = 'all' | 'live' | 'upcoming' | 'finished';

interface MatchesTabProps {
    matches: TeamMatches | undefined;
    language: Language;
    t: TranslationKeys;
    onOpenMatch: (fixtureId: number) => void;
}

export default function MatchesTab({ matches, language, t, onOpenMatch }: MatchesTabProps) {
    const live = matches?.live ?? [];
    const upcoming = matches?.upcoming ?? [];
    const finished = matches?.finished ?? [];

    const [status, setStatus] = useState<StatusFilter>('all');
    const [league, setLeague] = useState<number | null>(null);

    const allFixtures = useMemo(() => [...live, ...upcoming, ...finished], [live, upcoming, finished]);
    const competitions = useMemo(() => deriveCompetitions(allFixtures), [allFixtures]);

    // Keep live scores fresh regardless of the active filter.
    const liveIds = useMemo(() => live.map((f) => f.fixture?.id).filter((n): n is number => !!n), [live]);
    useRegisterLiveFixtures(liveIds);

    const byStatus: Fixture[] = useMemo(() => {
        switch (status) {
            case 'live':
                return live;
            case 'upcoming':
                return upcoming;
            case 'finished':
                return finished;
            default:
                return allFixtures;
        }
    }, [status, live, upcoming, finished, allFixtures]);

    const visible = useMemo(
        () => (league == null ? byStatus : byStatus.filter((f) => f.league?.id === league)),
        [byStatus, league],
    );

    const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
        { key: 'all', label: t.teamProfile.filterAll, count: allFixtures.length },
        { key: 'live', label: t.teamProfile.filterLive, count: live.length },
        { key: 'upcoming', label: t.teamProfile.filterUpcoming, count: upcoming.length },
        { key: 'finished', label: t.teamProfile.filterFinished, count: finished.length },
    ];

    return (
        <View style={styles.container}>
            {/* Status filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statusRow}
            >
                {statusFilters.map((f) => {
                    const active = f.key === status;
                    const isLive = f.key === 'live' && f.count > 0;
                    return (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.statusChip, active && styles.statusChipActive]}
                            onPress={() => setStatus(f.key)}
                        >
                            {isLive ? <View style={styles.liveDot} /> : null}
                            <Text style={[styles.statusText, active && styles.statusTextActive]}>
                                {f.label}
                            </Text>
                            <Text style={[styles.statusCount, active && styles.statusCountActive]}>
                                {f.count}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Competition filter */}
            {competitions.length > 1 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compRow}
                >
                    <TouchableOpacity
                        style={[styles.compChip, league == null && styles.compChipActive]}
                        onPress={() => setLeague(null)}
                    >
                        <Text style={[styles.compText, league == null && styles.compTextActive]}>
                            {t.teamProfile.allCompetitions}
                        </Text>
                    </TouchableOpacity>
                    {competitions.map((c) => {
                        const active = c.id === league;
                        return (
                            <TouchableOpacity
                                key={c.id}
                                style={[styles.compChip, active && styles.compChipActive]}
                                onPress={() => setLeague(c.id)}
                            >
                                {c.logo ? (
                                    <Image source={{ uri: c.logo }} style={styles.compLogo} contentFit="contain" />
                                ) : null}
                                <Text style={[styles.compText, active && styles.compTextActive]} numberOfLines={1}>
                                    {getLeagueDisplayName(c.name, language, c.id, c.country)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : null}

            {/* Fixture list */}
            <View style={styles.list}>
                {visible.length > 0 ? (
                    visible.map((fx) => (
                        <MatchRow
                            key={fx.fixture?.id}
                            fixture={fx}
                            language={language}
                            showVenue
                            onPress={() => fx.fixture?.id && onOpenMatch(fx.fixture.id)}
                        />
                    ))
                ) : (
                    <Card>
                        <EmptyState text={t.teamProfile.noMatches} icon="football-outline" />
                    </Card>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: Spacing.base,
        gap: Spacing.md,
    },
    statusRow: {
        gap: Spacing.sm,
        paddingHorizontal: Spacing.base,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.base,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.chip,
        backgroundColor: Colors.white04,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
    },
    statusChipActive: {
        backgroundColor: Colors.purplePrimary,
        borderColor: Colors.purplePrimary,
    },
    statusText: {
        color: Colors.textSecondary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    statusTextActive: {
        color: Colors.white,
    },
    statusCount: {
        color: Colors.textMuted,
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
    },
    statusCountActive: {
        color: Colors.white80,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.live,
    },
    compRow: {
        gap: Spacing.sm,
        paddingHorizontal: Spacing.base,
    },
    compChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.chip,
        backgroundColor: Colors.white04,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
    },
    compChipActive: {
        backgroundColor: Colors.purpleMuted,
        borderColor: Colors.purpleSoft,
    },
    compLogo: {
        width: 16,
        height: 16,
    },
    compText: {
        color: Colors.textSecondary,
        fontSize: FontSize.base,
        maxWidth: 150,
    },
    compTextActive: {
        color: Colors.purpleSoft,
        fontWeight: FontWeight.semibold,
    },
    list: {
        paddingHorizontal: Spacing.base,
    },
});
