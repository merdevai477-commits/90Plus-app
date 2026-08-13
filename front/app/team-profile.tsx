/**
 * Club / National-team Profile (90Plus, Phantom Dark) — 365Scores powered.
 *
 * Fully dynamic profile driven by React Query hooks over ApiFootballService's
 * 365 competitor endpoints (cached in Redis + Postgres). Composes a modular
 * header + quick stats + tabbed content (Overview / Matches / Squad / Transfers / Table)
 * and wires the real Follow feature.
 *
 * Route params: { id?: string; name?: string; logo?: string }
 *   - `id`   → 365 competitorId (preferred).
 *   - `name` → resolved to a competitorId when `id` is missing (e.g. navigation
 *              from an API-Football context that only knows the team name).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Colors, Spacing } from '../constants/theme';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName, getCountryDisplayName } from '../utils/i18nHelpers';
import { useHaptic } from '../hooks/useHaptic';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import ApiFootballService from '../services/apiFootball';
import { pushPlayerCareer } from '../utils/openPlayerProfile';

import {
    useCompetitorInfo,
    useCompetitorMatches,
    useCompetitorTransfers,
    useCompetitorStats,
    useCompetitorSquad,
    useCompetitorCoach,
} from '../hooks/useTeamProfile';
import { useFavoriteTeam } from '../hooks/useFavoriteTeam';

import TeamHeader from '../components/TeamProfile/TeamHeader';
import TeamQuickStats, { type QuickStat } from '../components/TeamProfile/TeamQuickStats';
import TeamTabs, { TeamTabKey } from '../components/TeamProfile/TeamTabs';
import TeamProfileSkeleton from '../components/TeamProfile/TeamProfileSkeleton';
import OverviewTab from '../components/TeamProfile/OverviewTab';
import MatchesTab from '../components/TeamProfile/MatchesTab';
import TransfersTab from '../components/TeamProfile/TransfersTab';
import TableTab from '../components/TeamProfile/TableTab';
import SquadTab from '../components/TeamProfile/SquadTab';

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

    const rawId = parseInt(params.id ?? '0', 10);
    const hasDirectId = Number.isFinite(rawId) && rawId > 0;
    const nameParam = (params.name ?? '').trim();

    // Resolve competitorId from a team name when no numeric id was provided.
    const resolveQ = useQuery({
        queryKey: ['competitor365-resolve', nameParam.toLowerCase()],
        queryFn: () => ApiFootballService.resolveCompetitor365ByName(nameParam),
        enabled: !hasDirectId && nameParam.length >= 2,
        staleTime: 30 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const competitorId = hasDirectId ? rawId : resolveQ.data?.competitorId ?? 0;
    const validId = competitorId > 0;

    const [activeTab, setActiveTab] = useState<TeamTabKey>('overview');

    // ── Data (React Query dedupes; all cached server-side) ────────────────────
    const infoQ = useCompetitorInfo(competitorId, validId);
    const matchesQ = useCompetitorMatches(competitorId, validId);
    const info = infoQ.data ?? null;
    const isNationalTeam = info?.type === 2;

    const statsCompetitionId =
        info?.mainCompetitionId ??
        info?.competitions.find((c) => c.hasStats)?.id ??
        info?.competitions[0]?.id ??
        null;

    const standingsComps = useMemo(
        () => info?.competitions.filter((c) => c.hasStandings) ?? [],
        [info],
    );

    const showTransfers = !!info?.hasTransfers && !isNationalTeam;
    const showTable = standingsComps.length > 0;
    const showSquad = true;

    const tabs = useMemo<TeamTabKey[]>(() => {
        const list: TeamTabKey[] = ['overview', 'matches'];
        if (showSquad) list.push('squad');
        if (showTransfers) list.push('transfers');
        if (showTable) list.push('table');
        return list;
    }, [showSquad, showTransfers, showTable]);

    // Keep the active tab valid when the tab set changes (e.g. national teams).
    useEffect(() => {
        if (!tabs.includes(activeTab)) setActiveTab('overview');
    }, [tabs, activeTab]);

    const statsQ = useCompetitorStats(
        competitorId,
        statsCompetitionId,
        validId && !!statsCompetitionId,
    );
    const transfersQ = useCompetitorTransfers(competitorId, validId && showTransfers);
    const squadQ = useCompetitorSquad(competitorId, validId && showSquad && activeTab === 'squad');
    const coachQ = useCompetitorCoach(competitorId, validId);

    // ── Follow ─────────────────────────────────────────────────────────────────
    const { isFollowing, toggleFollow, pending: followPending } = useFavoriteTeam();

    const teamName = getTeamDisplayName(info?.name ?? nameParam, language, competitorId);
    const country = info?.country ?? null;

    const quickStats = useMemo<QuickStat[]>(() => {
        const chips: QuickStat[] = [];
        if (country) {
            chips.push({
                key: 'country',
                icon: 'flag',
                value: getCountryDisplayName(country, language),
                label: t.teamProfile.country,
            });
        }
        const playedCount = matchesQ.data?.finished.length ?? 0;
        if (playedCount > 0) {
            chips.push({
                key: 'played',
                icon: 'football',
                value: playedCount,
                label: t.teamProfile.played,
            });
        }
        if (info && info.competitions.length > 0) {
            chips.push({
                key: 'competitions',
                icon: 'trophy',
                value: info.competitions.length,
                label: t.teamProfile.competitions,
                tint: Colors.gold,
            });
        }
        return chips;
    }, [country, language, matchesQ.data, info, t]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleBack = () => {
        trigger('light');
        router.back();
    };

    const handleToggleFollow = () => {
        trigger('medium');
        toggleFollow({
            id: competitorId,
            name: info?.name ?? nameParam ?? null,
            logo: info?.logo ?? params.logo ?? null,
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

    const handleOpenPlayer = (athleteId: number, name: string, photo: string | null) => {
        if (!athleteId) return;
        trigger('light');
        pushPlayerCareer(router, {
            athleteId,
            name,
            photo,
            teamName: info?.name ?? nameParam,
            teamLogo: info?.logo ?? params.logo,
            teamId: competitorId,
        });
    };

    // ── States ───────────────────────────────────────────────────────────────
    const resolving = !hasDirectId && resolveQ.isLoading;

    if (!validId && !resolving) {
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

    if (resolving || infoQ.isLoading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <TeamProfileSkeleton />
            </View>
        );
    }

    if (infoQ.isError || !info) {
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
        transfers: t.teamProfile.tabs.transfers,
        table: t.teamProfile.tabs.table,
        squad: t.teamProfile.tabs.squad,
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <TeamHeader
                t={t}
                language={language}
                name={teamName}
                competitorId={competitorId}
                logo={info.logo}
                country={country}
                founded={null}
                stadium={null}
                isFollowing={isFollowing(competitorId)}
                followPending={followPending}
                onToggleFollow={handleToggleFollow}
                onBack={handleBack}
                topInset={insets.top}
                coachName={coachQ.data?.name ?? null}
            />

            {quickStats.length > 0 ? (
                <View style={styles.quickStats}>
                    <TeamQuickStats stats={quickStats} />
                </View>
            ) : null}

            <TeamTabs active={activeTab} onChange={setActiveTab} labels={tabLabels} tabs={tabs} />

            <ScrollView
                style={styles.content}
                contentContainerStyle={[
                    styles.contentInner,
                    { paddingBottom: insets.bottom + Spacing['4xl'] },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'overview' ? (
                    <OverviewTab
                        competitorId={competitorId}
                        matches={matchesQ.data}
                        stats={statsQ.data}
                        coach={coachQ.data}
                        language={language}
                        t={t}
                        onOpenMatches={() => setActiveTab('matches')}
                        onOpenMatch={handleOpenMatch}
                        onOpenPlayer={handleOpenPlayer}
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
                        loading={squadQ.isLoading}
                        error={squadQ.isError}
                        onRetry={() => squadQ.refetch()}
                        t={t}
                        onOpenPlayer={(player) =>
                            handleOpenPlayer(player.athleteId, player.name, player.photo)
                        }
                    />
                ) : null}

                {activeTab === 'transfers' ? (
                    <TransfersTab
                        transfers={transfersQ.data}
                        t={t}
                        onOpenPlayer={(item) =>
                            handleOpenPlayer(item.athleteId, item.athleteName, item.athletePhoto)
                        }
                    />
                ) : null}

                {activeTab === 'table' ? (
                    <TableTab
                        competitorId={competitorId}
                        competitions={standingsComps}
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
