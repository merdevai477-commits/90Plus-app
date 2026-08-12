/**
 * Club / Team Profile (90Plus, Phantom Dark)
 *
 * Fully dynamic profile driven by React Query hooks over ApiFootballService.
 * Composes a modular header + quick stats + tabbed content (Overview / Matches /
 * Squad / Details) and wires the real Follow feature (dedicated backend).
 *
 * Works for both clubs and national teams (same /teams id). Route params:
 *   { id: string; name?: string; logo?: string }
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '../constants/theme';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName, getCountryDisplayName } from '../utils/i18nHelpers';
import { getFootballSeasonYear, playerPhotoUrl } from '../utils/playerStatsAggregate';
import { useHaptic } from '../hooks/useHaptic';
import { ErrorDisplay } from '../components/common/ErrorDisplay';

import {
    useTeamInfo,
    useTeamMatches,
    useTeamSquad,
    useTeamTrophies,
    useTeamInjuries,
    useTeamCoaches,
    SquadPlayer,
} from '../hooks/useTeamProfile';
import { useFavoriteTeam } from '../hooks/useFavoriteTeam';

import TeamHeader from '../components/TeamProfile/TeamHeader';
import TeamQuickStats from '../components/TeamProfile/TeamQuickStats';
import TeamTabs, { TeamTabKey } from '../components/TeamProfile/TeamTabs';
import TeamProfileSkeleton from '../components/TeamProfile/TeamProfileSkeleton';
import OverviewTab from '../components/TeamProfile/OverviewTab';
import MatchesTab from '../components/TeamProfile/MatchesTab';
import SquadTab from '../components/TeamProfile/SquadTab';
import DetailsTab from '../components/TeamProfile/DetailsTab';
import { aggregateTrophies } from '../components/TeamProfile/utils';

interface TeamParams {
    id?: string;
    name?: string;
    logo?: string;
}

export default function TeamProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams() as unknown as TeamParams;
    const insets = useSafeAreaInsets();
    const { t, language } = useTranslation();
    const { trigger } = useHaptic();

    const teamId = parseInt(params.id ?? '0', 10);
    const validId = Number.isFinite(teamId) && teamId > 0;

    const [activeTab, setActiveTab] = useState<TeamTabKey>('overview');

    // ── Data (React Query dedupes; all cached server-side) ────────────────────
    const infoQ = useTeamInfo(teamId, validId);
    const matchesQ = useTeamMatches(teamId, 30, validId);
    const squadQ = useTeamSquad(teamId, validId);
    const trophiesQ = useTeamTrophies(teamId, validId);
    const injuriesQ = useTeamInjuries(teamId, validId);
    const coachesQ = useTeamCoaches(teamId, validId);

    // ── Follow ─────────────────────────────────────────────────────────────────
    const { isFollowing, toggleFollow, pending: followPending } = useFavoriteTeam();

    const teamInfo = infoQ.data ?? null;
    const teamName = getTeamDisplayName(teamInfo?.team?.name ?? params.name, language);
    const country = teamInfo?.team?.country ?? null;

    const quickStats = useMemo(() => {
        const trophyTitles = aggregateTrophies(trophiesQ.data).reduce((sum, tr) => sum + tr.titles, 0);
        return {
            trophies: trophyTitles,
            squadSize: squadQ.data?.length ?? 0,
            coachName: coachesQ.data && coachesQ.data.length > 0 ? coachesQ.data[0].name : null,
            country: country ? getCountryDisplayName(country, language) : null,
        };
    }, [trophiesQ.data, squadQ.data, coachesQ.data, country, language]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleBack = () => {
        trigger('light');
        router.back();
    };

    const handleToggleFollow = () => {
        trigger('medium');
        toggleFollow({
            id: teamId,
            name: teamInfo?.team?.name ?? params.name ?? null,
            logo: teamInfo?.team?.logo ?? params.logo ?? null,
            country,
        });
    };

    const handleOpenMatch = (fixtureId: number) => {
        trigger('light');
        router.push({
            pathname: '/(tabs)/match-details',
            params: { fixtureId: String(fixtureId) },
        } as any);
    };

    const handleOpenPlayer = (player: SquadPlayer) => {
        trigger('light');
        router.push({
            pathname: '/player-profile',
            params: {
                id: String(player.id),
                name: player.name,
                photo: playerPhotoUrl(player.id, player.photo),
                teamName: teamInfo?.team?.name ?? '',
                teamLogo: teamInfo?.team?.logo ?? '',
                teamId: teamInfo?.team?.id ? String(teamInfo.team.id) : String(teamId),
                season: String(getFootballSeasonYear()),
            },
        } as any);
    };

    // ── States ───────────────────────────────────────────────────────────────
    if (!validId) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <ErrorDisplay
                    type="generic"
                    title={t.teamProfile.invalidTeamId}
                    message={t.teamProfile.loadFailed}
                    showRetry
                    retryText={t.teamProfile.retry}
                    onRetry={handleBack}
                />
            </View>
        );
    }

    if (infoQ.isLoading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <TeamProfileSkeleton />
            </View>
        );
    }

    if (infoQ.isError || !teamInfo?.team) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <ErrorDisplay
                    type="server"
                    title={t.teamProfile.loadFailed}
                    message={t.teamProfile.loadFailed}
                    showRetry
                    retryText={t.teamProfile.retry}
                    onRetry={() => infoQ.refetch()}
                />
            </View>
        );
    }

    const tabLabels: Record<TeamTabKey, string> = {
        overview: t.teamProfile.tabs.overview,
        matches: t.teamProfile.tabs.matches,
        squad: t.teamProfile.tabs.squad,
        details: t.teamProfile.tabs.details,
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <TeamHeader
                t={t}
                language={language}
                name={teamName}
                logo={teamInfo.team.logo}
                country={country}
                founded={teamInfo.team.founded}
                stadium={teamInfo.venue?.name}
                isFollowing={isFollowing(teamId)}
                followPending={followPending}
                onToggleFollow={handleToggleFollow}
                onBack={handleBack}
                topInset={insets.top}
            />

            <View style={styles.quickStats}>
                <TeamQuickStats
                    t={t}
                    trophies={quickStats.trophies}
                    squadSize={quickStats.squadSize}
                    coachName={quickStats.coachName}
                    country={quickStats.country}
                />
            </View>

            <TeamTabs active={activeTab} onChange={setActiveTab} labels={tabLabels} />

            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + Spacing['4xl'] }]}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'overview' ? (
                    <OverviewTab
                        teamId={teamId}
                        teamInfo={teamInfo}
                        matches={matchesQ.data}
                        trophies={trophiesQ.data}
                        injuries={injuriesQ.data}
                        language={language}
                        t={t}
                        onOpenMatches={() => setActiveTab('matches')}
                        onOpenDetails={() => setActiveTab('details')}
                        onOpenMatch={handleOpenMatch}
                    />
                ) : null}

                {activeTab === 'matches' ? (
                    <MatchesTab
                        matches={matchesQ.data}
                        language={language}
                        t={t}
                        onOpenMatch={handleOpenMatch}
                    />
                ) : null}

                {activeTab === 'squad' ? (
                    <SquadTab
                        squad={squadQ.data}
                        injuries={injuriesQ.data}
                        t={t}
                        onOpenPlayer={handleOpenPlayer}
                    />
                ) : null}

                {activeTab === 'details' ? (
                    <DetailsTab
                        teamId={teamId}
                        teamInfo={teamInfo}
                        coaches={coachesQ.data}
                        trophies={trophiesQ.data}
                        injuries={injuriesQ.data}
                        language={language}
                        t={t}
                    />
                ) : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgBase,
    },
    quickStats: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
    content: {
        flex: 1,
    },
    contentInner: {
        paddingTop: Spacing.xs,
    },
});
