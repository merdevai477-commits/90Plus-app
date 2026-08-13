/**
 * Overview tab (365Scores): featured/next match, recent results, a season-form
 * summary derived from finished fixtures, and a Top Scorers leaderboard.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
import type { Fixture, Competitor365Stats, Stat365LeaderRow } from '../../services/apiFootball';
import type { TeamMatches } from '../../hooks/useTeamProfile';
import { getTeamDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import { useRegisterLiveFixtures } from '../../hooks/useLiveFixture';
import TeamBadge from '../common/TeamBadge';
import LeagueIcon from '../common/LeagueIcon';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
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
import { computeStatsFromFixtures, getMatchPhase } from './utils';

interface OverviewTabProps {
    competitorId: number;
    matches: TeamMatches | undefined;
    stats: Competitor365Stats | null | undefined;
    language: Language;
    t: TranslationKeys;
    onOpenMatches: () => void;
    onOpenMatch: (fixtureId: number) => void;
    onOpenPlayer: (athleteId: number, name: string, photo: string | null) => void;
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

// ─── Season form summary (derived from finished fixtures) ───────────────────────

function SeasonForm({
    competitorId,
    finished,
    t,
}: {
    competitorId: number;
    finished: Fixture[];
    t: TranslationKeys;
}) {
    const stats = useMemo(
        () => computeStatsFromFixtures(finished, competitorId),
        [finished, competitorId],
    );

    if (!stats) {
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
            <View style={styles.statsHeader}>
                <WinRateRing percent={stats.winRate} />
                <View style={styles.statsHeaderRight}>
                    <Text style={styles.winRateLabel}>{t.teamProfile.winRate}</Text>
                    <View style={styles.wdlRow}>
                        <Text style={[styles.wdl, { color: Colors.success }]}>
                            {stats.wins}
                            {t.teamProfile.wins.charAt(0)}
                        </Text>
                        <Text style={[styles.wdl, { color: Colors.warning }]}>
                            {stats.draws}
                            {t.teamProfile.draws.charAt(0)}
                        </Text>
                        <Text style={[styles.wdl, { color: Colors.error }]}>
                            {stats.losses}
                            {t.teamProfile.losses.charAt(0)}
                        </Text>
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
                <StatBox
                    value={stats.goalDiff > 0 ? `+${stats.goalDiff}` : stats.goalDiff}
                    label={t.teamProfile.goalDiff}
                />
                <StatBox value={stats.avgGoalsFor} label={t.teamProfile.avgGoals} />
                {stats.cleanSheets != null ? (
                    <StatBox value={stats.cleanSheets} label={t.teamProfile.cleanSheets} tint={Colors.purpleSoft} />
                ) : null}
            </View>
        </Card>
    );
}

// ─── Top scorers (from 365 competition leaderboards) ────────────────────────────

function TopScorers({
    stats,
    competitorId,
    t,
    onOpenPlayer,
}: {
    stats: Competitor365Stats | null | undefined;
    competitorId: number;
    t: TranslationKeys;
    onOpenPlayer: (athleteId: number, name: string, photo: string | null) => void;
}) {
    // Prefer the goals board; fall back to the first available leaderboard.
    const board = useMemo(() => {
        const boards = stats?.leaderboards ?? [];
        if (boards.length === 0) return null;
        const goals = boards.find((b) => b.key === 1);
        return goals ?? boards[0];
    }, [stats]);

    // Current club players first, then recently-left ones (dimmed).
    const rows: Stat365LeaderRow[] = useMemo(() => {
        if (!board) return [];
        const own = board.rows.filter((r) => !r.leftClub || r.competitorId === competitorId);
        return (own.length > 0 ? own : board.rows).slice(0, 5);
    }, [board, competitorId]);

    if (!board || rows.length === 0) {
        return (
            <Card>
                <SectionTitle title={t.teamProfile.topScorers} />
                <EmptyState text={t.teamProfile.noScorers} icon="podium-outline" />
            </Card>
        );
    }

    return (
        <Card>
            <SectionTitle title={board.name || t.teamProfile.topScorers} />
            {rows.map((row, idx) => (
                <TouchableOpacity
                    key={`${row.athleteId}-${idx}`}
                    style={styles.scorerRow}
                    activeOpacity={0.8}
                    onPress={() => onOpenPlayer(row.athleteId, row.name, row.photo)}
                >
                    <Text style={styles.scorerRank}>{idx + 1}</Text>
                    <CachedAthletePhoto uri={row.photo} size={36} recyclingKey={row.athleteId} />
                    <View style={styles.scorerInfo}>
                        <Text style={styles.scorerName} numberOfLines={1}>
                            {row.name}
                        </Text>
                        {row.leftClub && row.competitorId !== competitorId ? (
                            <Text style={styles.scorerLeft} numberOfLines={1}>
                                {t.teamProfile.leftClub}
                            </Text>
                        ) : null}
                    </View>
                    <Text style={styles.scorerValue}>{row.value}</Text>
                </TouchableOpacity>
            ))}
        </Card>
    );
}

// ─── Overview tab ────────────────────────────────────────────────────────────────

export default function OverviewTab({
    competitorId,
    matches,
    stats,
    language,
    t,
    onOpenMatches,
    onOpenMatch,
    onOpenPlayer,
}: OverviewTabProps) {
    const live = matches?.live ?? [];
    const upcoming = matches?.upcoming ?? [];
    const finished = matches?.finished ?? [];

    const featured = live[0] ?? upcoming[0] ?? null;
    const recent = finished.slice(0, 5);

    // Keep the featured live match's score fresh.
    const liveIds = useMemo(
        () => (matches?.live ?? []).map((f) => f.fixture?.id).filter((n): n is number => !!n),
        [matches?.live],
    );
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

            {/* Season form */}
            <View style={styles.section}>
                <SeasonForm competitorId={competitorId} finished={finished} t={t} />
            </View>

            {/* Top scorers */}
            <View style={styles.section}>
                <TopScorers
                    stats={stats}
                    competitorId={competitorId}
                    t={t}
                    onOpenPlayer={onOpenPlayer}
                />
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
    // Top scorers
    scorerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
    },
    scorerRank: {
        color: Colors.textMuted,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        width: 20,
        textAlign: 'center',
    },
    scorerPhoto: {
        width: 38,
        height: 38,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
    },
    scorerInfo: {
        flex: 1,
    },
    scorerName: {
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    scorerLeft: {
        color: Colors.textMuted,
        fontSize: FontSize.sm,
        marginTop: 2,
    },
    scorerValue: {
        color: Colors.purpleSoft,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.extrabold,
        minWidth: 28,
        textAlign: 'center',
    },
});
