/**
 * Overview tab: featured/next match, recent results, season statistics
 * (win-rate ring + W/D/L form + competition selector), top trophies, injuries.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
    Colors,
    Spacing,
    Radius,
    FontSize,
    FontWeight,
} from '../../constants/theme';
import type { Language } from '../../src/i18n/types';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Injury, Trophy, Fixture } from '../../services/apiFootball';
import type { TeamInfo, TeamMatches } from '../../hooks/useTeamProfile';
import { useTeamStatistics } from '../../hooks/useTeamProfile';
import { getFootballSeasonYear, playerPhotoUrl } from '../../utils/playerStatsAggregate';
import {
    getTeamDisplayName,
    getLeagueDisplayName,
} from '../../utils/i18nHelpers';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';
import TeamBadge from '../common/TeamBadge';
import LeagueIcon from '../common/LeagueIcon';
import {
    Card,
    SectionTitle,
    EmptyState,
    StatBox,
    FormBadges,
    WinRateRing,
    MatchRow,
    StatusPill,
    useMergedFixture,
    formatTime,
    formatShortDate,
} from './shared';
import {
    aggregateTrophies,
    deriveCompetitions,
    mostFrequentLeagueId,
    normalizeApiStatistics,
    computeStatsFromFixtures,
    getMatchPhase,
} from './utils';

interface OverviewTabProps {
    teamId: number;
    teamInfo: TeamInfo | null;
    matches: TeamMatches | undefined;
    trophies: Trophy[] | undefined;
    injuries: Injury[] | undefined;
    language: Language;
    t: TranslationKeys;
    onOpenMatches: () => void;
    onOpenDetails: () => void;
    onOpenMatch: (fixtureId: number) => void;
}

// ─── Featured (live or next) match card ─────────────────────────────────────────

function FeaturedMatchCard({
    fixture,
    language,
    t,
    onPress,
}: {
    fixture: Fixture;
    language: Language;
    t: TranslationKeys;
    onPress: () => void;
}) {
    const merged = useMergedFixture(fixture);
    const home = fixture.teams?.home;
    const away = fixture.teams?.away;
    const league = fixture.league;
    const kickoff = fixture.fixture?.date ? new Date(fixture.fixture.date) : null;
    const isUpcoming = merged.phase === 'upcoming';

    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
            <Card>
                <View style={styles.featuredTop}>
                    <View style={styles.featuredLeague}>
                        {league ? (
                            <>
                                <LeagueIcon name={league.name} logo={league.logo} leagueId={league.id} size={20} />
                                <Text style={styles.featuredLeagueText} numberOfLines={1}>
                                    {getLeagueDisplayName(league.name, language, league.id, league.country)}
                                </Text>
                            </>
                        ) : null}
                    </View>
                    <StatusPill
                        phase={merged.phase}
                        label={
                            merged.phase === 'live'
                                ? merged.elapsed != null
                                    ? `${merged.elapsed}'`
                                    : t.matches.status.live
                                : merged.phase === 'finished'
                                  ? t.matches.status.finished
                                  : t.matchDetails.statusUpcoming
                        }
                    />
                </View>

                <View style={styles.featuredBody}>
                    <View style={styles.featuredTeam}>
                        <TeamBadge name={home?.name ?? ''} logo={home?.logo} size={52} color="transparent" />
                        <Text style={styles.featuredTeamName} numberOfLines={2}>
                            {getTeamDisplayName(home?.name, language)}
                        </Text>
                    </View>

                    <View style={styles.featuredCenter}>
                        {isUpcoming ? (
                            <>
                                <Text style={styles.featuredTime}>{formatTime(kickoff)}</Text>
                                <Text style={styles.featuredDate}>{formatShortDate(kickoff)}</Text>
                            </>
                        ) : (
                            <Text style={[styles.featuredScore, merged.phase === 'live' && styles.featuredScoreLive]}>
                                {merged.homeGoals ?? 0} - {merged.awayGoals ?? 0}
                            </Text>
                        )}
                    </View>

                    <View style={styles.featuredTeam}>
                        <TeamBadge name={away?.name ?? ''} logo={away?.logo} size={52} color="transparent" />
                        <Text style={styles.featuredTeamName} numberOfLines={2}>
                            {getTeamDisplayName(away?.name, language)}
                        </Text>
                    </View>
                </View>

                {fixture.fixture?.venue?.name ? (
                    <View style={styles.featuredVenue}>
                        <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                        <Text style={styles.featuredVenueText} numberOfLines={1}>
                            {fixture.fixture.venue.name}
                            {fixture.fixture.venue.city ? ` • ${fixture.fixture.venue.city}` : ''}
                        </Text>
                    </View>
                ) : null}
            </Card>
        </TouchableOpacity>
    );
}

// ─── Season statistics ──────────────────────────────────────────────────────────

function SeasonStatistics({
    teamId,
    allFixtures,
    finished,
    language,
    t,
}: {
    teamId: number;
    allFixtures: Fixture[];
    finished: Fixture[];
    language: Language;
    t: TranslationKeys;
}) {
    const competitions = useMemo(() => deriveCompetitions(allFixtures), [allFixtures]);
    const defaultLeague = useMemo(() => mostFrequentLeagueId(allFixtures), [allFixtures]);
    const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
    const effectiveLeague = selectedLeague ?? defaultLeague;
    const season = getFootballSeasonYear();

    const { data: statsData, isLoading } = useTeamStatistics(teamId, effectiveLeague, season, true);

    const stats = useMemo(
        () => normalizeApiStatistics(statsData) ?? computeStatsFromFixtures(finished, teamId),
        [statsData, finished, teamId],
    );

    if (!stats && !isLoading) {
        return (
            <Card>
                <SectionTitle title={t.teamProfile.seasonStats} />
                <EmptyState text={t.teamProfile.noStats} icon="stats-chart-outline" />
            </Card>
        );
    }

    return (
        <Card>
            <SectionTitle title={t.teamProfile.seasonStats} />

            {competitions.length > 1 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compScroll}
                >
                    {competitions.map((c) => {
                        const active = c.id === effectiveLeague;
                        return (
                            <TouchableOpacity
                                key={c.id}
                                style={[styles.compChip, active && styles.compChipActive]}
                                onPress={() => setSelectedLeague(c.id)}
                            >
                                {c.logo ? (
                                    <Image source={{ uri: c.logo }} style={styles.compLogo} contentFit="contain" />
                                ) : null}
                                <Text style={[styles.compChipText, active && styles.compChipTextActive]} numberOfLines={1}>
                                    {getLeagueDisplayName(c.name, language, c.id, c.country)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : null}

            {stats ? (
                <>
                    <View style={styles.statsHeader}>
                        <WinRateRing percent={stats.winRate} />
                        <View style={styles.statsHeaderRight}>
                            <Text style={styles.winRateLabel}>{t.teamProfile.winRate}</Text>
                            <View style={styles.wdlRow}>
                                <Text style={[styles.wdl, { color: Colors.success }]}>{stats.wins}{t.teamProfile.wins.charAt(0)}</Text>
                                <Text style={[styles.wdl, { color: Colors.warning }]}>{stats.draws}{t.teamProfile.draws.charAt(0)}</Text>
                                <Text style={[styles.wdl, { color: Colors.error }]}>{stats.losses}{t.teamProfile.losses.charAt(0)}</Text>
                            </View>
                            {stats.form.length > 0 ? (
                                <View style={styles.formWrap}>
                                    <Text style={styles.formLabel}>{t.teamProfile.form}</Text>
                                    <FormBadges form={stats.form} />
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <StatBox value={stats.played} label={t.teamProfile.played} />
                        <StatBox value={stats.goalsFor} label={t.teamProfile.goalsFor} tint={Colors.success} />
                        <StatBox value={stats.goalsAgainst} label={t.teamProfile.goalsAgainst} tint={Colors.error} />
                        <StatBox value={stats.goalDiff > 0 ? `+${stats.goalDiff}` : stats.goalDiff} label={t.teamProfile.goalDiff} />
                        <StatBox value={stats.avgGoalsFor} label={t.teamProfile.avgGoals} />
                        {stats.cleanSheets != null ? (
                            <StatBox value={stats.cleanSheets} label={t.teamProfile.cleanSheets} tint={Colors.purpleSoft} />
                        ) : null}
                    </View>
                </>
            ) : null}
        </Card>
    );
}

// ─── Top trophies ────────────────────────────────────────────────────────────────

function TopTrophies({
    trophies,
    language,
    t,
}: {
    trophies: Trophy[] | undefined;
    language: Language;
    t: TranslationKeys;
}) {
    const aggregated = useMemo(() => aggregateTrophies(trophies).slice(0, 5), [trophies]);

    return (
        <Card>
            <SectionTitle title={t.teamProfile.topTrophies} />
            {aggregated.length > 0 ? (
                aggregated.map((tr) => (
                    <View key={`${tr.leagueId}-${tr.name}`} style={styles.trophyRow}>
                        <LeagueIcon name={tr.name} logo={tr.logo ?? undefined} leagueId={tr.leagueId} size={30} />
                        <Text style={styles.trophyName} numberOfLines={1}>
                            {getLeagueDisplayName(tr.name, language, tr.leagueId, tr.country)}
                        </Text>
                        <View style={styles.trophyCount}>
                            <Ionicons name="trophy" size={13} color={Colors.gold} />
                            <Text style={styles.trophyCountText}>{tr.titles}</Text>
                        </View>
                    </View>
                ))
            ) : (
                <EmptyState text={t.teamProfile.noTrophies} icon="trophy-outline" />
            )}
        </Card>
    );
}

// ─── Injuries preview ────────────────────────────────────────────────────────────

function InjuriesPreview({
    injuries,
    onViewAll,
    t,
}: {
    injuries: Injury[] | undefined;
    onViewAll: () => void;
    t: TranslationKeys;
}) {
    const list = (injuries ?? []).slice(0, 4);

    return (
        <Card>
            <SectionTitle
                title={t.teamProfile.injuries}
                actionLabel={injuries && injuries.length > 4 ? t.teamProfile.viewAll : undefined}
                onAction={injuries && injuries.length > 4 ? onViewAll : undefined}
            />
            {list.length > 0 ? (
                list.map((inj, idx) => (
                    <View key={`${inj.player?.id}-${idx}`} style={styles.injuryRow}>
                        <Image
                            source={{ uri: playerPhotoUrl(inj.player?.id ?? 0, inj.player?.photo) }}
                            style={styles.injuryPhoto}
                            contentFit="cover"
                            transition={150}
                        />
                        <View style={styles.injuryInfo}>
                            <Text style={styles.injuryName} numberOfLines={1}>
                                {inj.player?.name}
                            </Text>
                            <Text style={styles.injuryType} numberOfLines={1}>
                                {inj.reason || inj.type}
                            </Text>
                        </View>
                        <View style={styles.injuryBadge}>
                            <Ionicons name="medkit-outline" size={13} color={Colors.error} />
                        </View>
                    </View>
                ))
            ) : (
                <EmptyState text={t.teamProfile.noInjuries} icon="medkit-outline" />
            )}
        </Card>
    );
}

// ─── Overview tab ────────────────────────────────────────────────────────────────

export default function OverviewTab({
    teamId,
    matches,
    trophies,
    injuries,
    language,
    t,
    onOpenMatches,
    onOpenDetails,
    onOpenMatch,
}: OverviewTabProps) {
    const live = matches?.live ?? [];
    const upcoming = matches?.upcoming ?? [];
    const finished = matches?.finished ?? [];
    const allFixtures = useMemo(() => [...live, ...upcoming, ...finished], [live, upcoming, finished]);

    const featured = live[0] ?? upcoming[0] ?? null;
    const recent = finished.slice(0, 5);

    // Keep the featured live match's score fresh.
    const liveIds = useMemo(() => live.map((f) => f.fixture?.id).filter((n): n is number => !!n), [live]);
    useRegisterLiveFixtures(liveIds);

    return (
        <View style={styles.container}>
            {/* Featured / Next match */}
            <View style={styles.section}>
                <Text style={styles.blockTitle}>
                    {featured && getMatchPhase(featured.fixture?.status?.short) === 'live'
                        ? t.matches.tabs.live
                        : t.teamProfile.nextMatch}
                </Text>
                {featured ? (
                    <FeaturedMatchCard
                        fixture={featured}
                        language={language}
                        t={t}
                        onPress={() => featured.fixture?.id && onOpenMatch(featured.fixture.id)}
                    />
                ) : (
                    <Card>
                        <EmptyState text={t.teamProfile.noUpcoming} icon="football-outline" />
                    </Card>
                )}
            </View>

            {/* Recent matches */}
            <View style={styles.section}>
                <SectionTitle
                    title={t.teamProfile.recentMatches}
                    actionLabel={finished.length > 5 ? t.teamProfile.viewAll : undefined}
                    onAction={finished.length > 5 ? onOpenMatches : undefined}
                />
                {recent.length > 0 ? (
                    recent.map((fx) => (
                        <MatchRow
                            key={fx.fixture?.id}
                            fixture={fx}
                            language={language}
                            onPress={() => fx.fixture?.id && onOpenMatch(fx.fixture.id)}
                        />
                    ))
                ) : (
                    <Card>
                        <EmptyState text={t.teamProfile.noRecent} icon="time-outline" />
                    </Card>
                )}
            </View>

            {/* Season statistics */}
            <View style={styles.section}>
                <SeasonStatistics
                    teamId={teamId}
                    allFixtures={allFixtures}
                    finished={finished}
                    language={language}
                    t={t}
                />
            </View>

            {/* Top trophies */}
            <View style={styles.section}>
                <TopTrophies trophies={trophies} language={language} t={t} />
            </View>

            {/* Injuries */}
            <View style={styles.section}>
                <InjuriesPreview injuries={injuries} onViewAll={onOpenDetails} t={t} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.base,
        gap: Spacing.lg,
    },
    section: {
        gap: Spacing.sm,
    },
    blockTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.bold,
        marginBottom: Spacing.xs,
    },
    // Featured card
    featuredTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.base,
    },
    featuredLeague: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
        marginRight: Spacing.sm,
    },
    featuredLeagueText: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        flex: 1,
    },
    featuredBody: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featuredTeam: {
        flex: 1,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    featuredTeamName: {
        color: Colors.textPrimary,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        textAlign: 'center',
    },
    featuredCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.base,
        minWidth: 72,
    },
    featuredScore: {
        color: Colors.textPrimary,
        fontSize: FontSize['7xl'],
        fontWeight: FontWeight.extrabold,
    },
    featuredScoreLive: {
        color: Colors.live,
    },
    featuredTime: {
        color: Colors.textPrimary,
        fontSize: FontSize['4xl'],
        fontWeight: FontWeight.bold,
    },
    featuredDate: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        marginTop: 2,
    },
    featuredVenue: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: Spacing.base,
    },
    featuredVenueText: {
        color: Colors.textMuted,
        fontSize: FontSize.md,
    },
    // Season stats
    compScroll: {
        gap: Spacing.sm,
        paddingBottom: Spacing.md,
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
    compChipText: {
        color: Colors.textSecondary,
        fontSize: FontSize.base,
        maxWidth: 140,
    },
    compChipTextActive: {
        color: Colors.purpleSoft,
        fontWeight: FontWeight.semibold,
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
        marginBottom: Spacing.base,
    },
    statsHeaderRight: {
        flex: 1,
        gap: Spacing.sm,
    },
    winRateLabel: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
    },
    wdlRow: {
        flexDirection: 'row',
        gap: Spacing.base,
    },
    wdl: {
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.extrabold,
    },
    formWrap: {
        gap: Spacing.xs,
    },
    formLabel: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    // Trophies
    trophyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
    },
    trophyName: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.medium,
    },
    trophyCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: Radius.badge,
        backgroundColor: Colors.white06,
    },
    trophyCountText: {
        color: Colors.gold,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
    // Injuries
    injuryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    injuryPhoto: {
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
    },
    injuryInfo: {
        flex: 1,
    },
    injuryName: {
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    injuryType: {
        color: Colors.error,
        fontSize: FontSize.base,
        marginTop: 2,
    },
    injuryBadge: {
        width: 30,
        height: 30,
        borderRadius: Radius.full,
        backgroundColor: Colors.errorBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
