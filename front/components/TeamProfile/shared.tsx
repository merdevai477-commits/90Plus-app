/**
 * Shared presentational atoms for the Team/Club profile — all token-driven
 * (Phantom Dark). Kept dependency-light and reused across every tab.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import {
    Colors,
    Spacing,
    Radius,
    FontSize,
    FontWeight,
} from '../../constants/theme';
import type { Language } from '../../src/i18n/types';
import type { Fixture } from '../../services/apiFootball';
import TeamBadge from '../common/TeamBadge';
import LeagueIcon from '../common/LeagueIcon';
import { getTeamDisplayName, getLeagueDisplayName, getLocalizedMatchStatus } from '../../utils/i18nHelpers';
import { useLiveFixtureStore } from '../../src/store/liveFixtureStore';
import { getMatchPhase, MatchPhase } from './utils';

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Section title ─────────────────────────────────────────────────────────────

export function SectionTitle({
    title,
    actionLabel,
    onAction,
}: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {actionLabel && onAction ? (
                <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.sectionAction}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ text, icon = 'ellipse-outline' }: { text: string; icon?: any }) {
    return (
        <View style={styles.empty}>
            <Ionicons name={icon} size={22} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{text}</Text>
        </View>
    );
}

// ─── Info row (label / value) ──────────────────────────────────────────────────

export function InfoRow({ label, value }: { label: string; value: string | number }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
                {value}
            </Text>
        </View>
    );
}

// ─── Stat box ──────────────────────────────────────────────────────────────────

export function StatBox({
    value,
    label,
    tint = Colors.textPrimary,
}: {
    value: string | number;
    label: string;
    tint?: string;
}) {
    return (
        <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ─── Form badges (W / D / L) ────────────────────────────────────────────────────

const FORM_COLORS: Record<string, string> = {
    W: Colors.success,
    D: Colors.warning,
    L: Colors.error,
};

export function FormBadges({ form }: { form: string[] }) {
    if (!form || form.length === 0) return null;
    return (
        <View style={styles.formRow}>
            {form.map((r, i) => (
                <View
                    key={`${r}-${i}`}
                    style={[styles.formBadge, { backgroundColor: FORM_COLORS[r.toUpperCase()] ?? Colors.textMuted }]}
                >
                    <Text style={styles.formBadgeText}>{r.toUpperCase()}</Text>
                </View>
            ))}
        </View>
    );
}

// ─── Win-rate ring ──────────────────────────────────────────────────────────────

export function WinRateRing({ percent, size = 92 }: { percent: number; size?: number }) {
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, percent));
    const dash = (clamped / 100) * circumference;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={Colors.white10}
                    strokeWidth={stroke}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={Colors.purplePrimary}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${dash} ${circumference}`}
                    rotation={-90}
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>
            <View style={styles.ringCenter}>
                <Text style={styles.ringValue}>{clamped}%</Text>
            </View>
        </View>
    );
}

// ─── Status pill ────────────────────────────────────────────────────────────────

export function StatusPill({
    phase,
    label,
}: {
    phase: MatchPhase;
    label: string;
}) {
    const color =
        phase === 'live' ? Colors.live : phase === 'finished' ? Colors.textSecondary : Colors.purpleSoft;
    const bg =
        phase === 'live'
            ? 'rgba(239,68,68,0.15)'
            : phase === 'finished'
              ? Colors.white08
              : Colors.purpleMuted;
    return (
        <View style={[styles.pill, { backgroundColor: bg }]}>
            {phase === 'live' ? <View style={styles.liveDot} /> : null}
            <Text style={[styles.pillText, { color }]}>{label}</Text>
        </View>
    );
}

// ─── Live merge helper ──────────────────────────────────────────────────────────

export interface MergedFixture {
    phase: MatchPhase;
    statusShort: string;
    elapsed: number | null;
    homeGoals: number | null;
    awayGoals: number | null;
}

/**
 * Merge a base fixture with a live snapshot from the store (when the match is
 * live). Registration/polling is owned by the parent via useRegisterLiveFixtures,
 * so this only subscribes to updates — it never triggers new polling.
 */
export function useMergedFixture(fixture: Fixture): MergedFixture {
    const baseStatus = fixture.fixture?.status?.short ?? 'NS';
    const basePhase = getMatchPhase(baseStatus);
    const fixtureId = fixture.fixture?.id;
    const snapshot = useLiveFixtureStore((s) =>
        basePhase === 'live' && fixtureId ? s.snapshots[fixtureId] : undefined,
    );

    if (snapshot?.fixture) {
        const sf = snapshot.fixture;
        return {
            phase: getMatchPhase(sf.fixture?.status?.short),
            statusShort: sf.fixture?.status?.short ?? baseStatus,
            elapsed: sf.fixture?.status?.elapsed ?? null,
            homeGoals: sf.goals?.home ?? null,
            awayGoals: sf.goals?.away ?? null,
        };
    }

    return {
        phase: basePhase,
        statusShort: baseStatus,
        elapsed: fixture.fixture?.status?.elapsed ?? null,
        homeGoals: fixture.goals?.home ?? null,
        awayGoals: fixture.goals?.away ?? null,
    };
}

// ─── Match row ──────────────────────────────────────────────────────────────────

export function MatchRow({
    fixture,
    language,
    onPress,
    showCompetition = true,
    showVenue = false,
}: {
    fixture: Fixture;
    language: Language;
    onPress: () => void;
    showCompetition?: boolean;
    showVenue?: boolean;
}) {
    const merged = useMergedFixture(fixture);
    const home = fixture.teams?.home;
    const away = fixture.teams?.away;
    const league = fixture.league;
    const kickoff = fixture.fixture?.date ? new Date(fixture.fixture.date) : null;

    const statusLabel =
        merged.phase === 'live'
            ? merged.elapsed != null
                ? `${merged.elapsed}'`
                : getLocalizedMatchStatus(merged.statusShort, language)
            : merged.phase === 'upcoming'
              ? formatTime(kickoff)
              : getLocalizedMatchStatus(merged.statusShort, language);

    const showScore = merged.phase !== 'upcoming';

    return (
        <TouchableOpacity style={styles.matchRow} onPress={onPress} activeOpacity={0.8}>
            {showCompetition && league ? (
                <View style={styles.matchLeague}>
                    <LeagueIcon name={league.name} logo={league.logo} leagueId={league.id} size={18} />
                    <Text style={styles.matchLeagueName} numberOfLines={1}>
                        {getLeagueDisplayName(league.name, language, league.id, league.country)}
                    </Text>
                    <Text style={styles.matchDate}>{formatShortDate(kickoff)}</Text>
                </View>
            ) : null}

            <View style={styles.matchBody}>
                <View style={styles.matchTeam}>
                    <TeamBadge name={home?.name ?? ''} logo={home?.logo} size={34} color="transparent" />
                    <Text style={styles.matchTeamName} numberOfLines={1}>
                        {getTeamDisplayName(home?.name, language)}
                    </Text>
                </View>

                <View style={styles.matchCenter}>
                    {showScore ? (
                        <Text style={[styles.matchScore, merged.phase === 'live' && styles.matchScoreLive]}>
                            {merged.homeGoals ?? 0} - {merged.awayGoals ?? 0}
                        </Text>
                    ) : (
                        <Text style={styles.matchVs}>{formatTime(kickoff)}</Text>
                    )}
                    <View style={styles.matchStatusWrap}>
                        <StatusPill phase={merged.phase} label={statusLabel} />
                    </View>
                </View>

                <View style={styles.matchTeam}>
                    <TeamBadge name={away?.name ?? ''} logo={away?.logo} size={34} color="transparent" />
                    <Text style={styles.matchTeamName} numberOfLines={1}>
                        {getTeamDisplayName(away?.name, language)}
                    </Text>
                </View>
            </View>

            {showVenue && fixture.fixture?.venue?.name ? (
                <View style={styles.matchVenue}>
                    <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.matchVenueText} numberOfLines={1}>
                        {fixture.fixture.venue.name}
                        {fixture.fixture.venue.city ? ` • ${fixture.fixture.venue.city}` : ''}
                    </Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

// ─── Small logo (expo-image) ────────────────────────────────────────────────────

export function RemoteLogo({ uri, size = 24 }: { uri?: string | null; size?: number }) {
    if (!uri) return null;
    return (
        <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
        />
    );
}

// ─── Date helpers ────────────────────────────────────────────────────────────────

export function formatTime(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatShortDate(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.surfaceGlass,
        borderRadius: Radius.card,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        padding: Spacing.base,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.bold,
    },
    sectionAction: {
        color: Colors.purpleSoft,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.sm,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.lg,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
        gap: Spacing.base,
    },
    infoLabel: {
        color: Colors.textSecondary,
        fontSize: FontSize.lg,
        flexShrink: 0,
    },
    infoValue: {
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
        flex: 1,
        textAlign: 'right',
    },
    statBox: {
        minWidth: '30%',
        flexGrow: 1,
        backgroundColor: Colors.white04,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm,
        alignItems: 'center',
        gap: 2,
    },
    statValue: {
        fontSize: FontSize['4xl'],
        fontWeight: FontWeight.extrabold,
    },
    statLabel: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        textAlign: 'center',
    },
    formRow: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    formBadge: {
        width: 26,
        height: 26,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    formBadgeText: {
        color: Colors.white,
        fontSize: FontSize.base,
        fontWeight: FontWeight.bold,
    },
    ringCenter: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringValue: {
        color: Colors.textPrimary,
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.extrabold,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.badge,
    },
    pillText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        letterSpacing: 0.3,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.live,
    },
    matchRow: {
        backgroundColor: Colors.white04,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    matchLeague: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    matchLeagueName: {
        color: Colors.textSecondary,
        fontSize: FontSize.base,
        flex: 1,
    },
    matchDate: {
        color: Colors.textMuted,
        fontSize: FontSize.sm,
    },
    matchBody: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    matchTeam: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    matchTeamName: {
        color: Colors.textPrimary,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        flexShrink: 1,
    },
    matchCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
        minWidth: 64,
    },
    matchScore: {
        color: Colors.textPrimary,
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.extrabold,
    },
    matchScoreLive: {
        color: Colors.live,
    },
    matchVs: {
        color: Colors.textPrimary,
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
    },
    matchStatusWrap: {
        marginTop: 4,
    },
    matchVenue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: Spacing.sm,
        justifyContent: 'center',
    },
    matchVenueText: {
        color: Colors.textMuted,
        fontSize: FontSize.sm,
    },
});
