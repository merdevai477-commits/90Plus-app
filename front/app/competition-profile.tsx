/**
 * Competition profile: 365 logo + name + standings table.
 */

import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useTranslation } from '../src/i18n';
import { getLeagueDisplayName, getTeamDisplayName } from '../utils/i18nHelpers';
import ApiFootballService, { type Standing365Row } from '../services/apiFootball';
import { useCompetitorStandings } from '../hooks/useTeamProfile';
import TeamBadge from '../components/common/TeamBadge';
import LeagueIcon from '../components/common/LeagueIcon';

export default function CompetitionProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t, language } = useTranslation();
    const params = useLocalSearchParams() as {
        id?: string;
        name?: string;
        logo?: string;
        country?: string;
    };
    const competitionId = parseInt(params.id ?? '0', 10);
    const cp = t.competitionProfile;

    const infoQ = useQuery({
        queryKey: ['365-competition-profile', competitionId, language],
        queryFn: () => ApiFootballService.getCompetition365Profile(competitionId),
        enabled: competitionId > 0,
        staleTime: 30 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const standingsQ = useCompetitorStandings(competitionId, competitionId > 0);
    const info = infoQ.data;
    const name = info?.name || params.name || '—';
    const logo = info?.logo || params.logo || null;
    const country = info?.country || params.country || null;
    const hasStandings = info?.hasStandings !== false;

    const groups = useMemo(() => {
        const list = standingsQ.data ?? [];
        const byGroup = new Map<number, { name: string | null; rows: Standing365Row[] }>();
        for (const row of list) {
            const g = byGroup.get(row.groupNum);
            if (g) g.rows.push(row);
            else byGroup.set(row.groupNum, { name: row.groupName, rows: [row] });
        }
        return [...byGroup.entries()].sort((a, b) => a[0] - b[0]);
    }, [standingsQ.data]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" />
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.topTitle} numberOfLines={1}>
                    {cp.title}
                </Text>
                <View style={styles.backBtn} />
            </View>

            {infoQ.isLoading && !info ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.purpleSoft} />
                    <Text style={styles.muted}>{cp.loading}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
                    <View style={styles.hero}>
                        <LeagueIcon name={name} logo={logo} size={56} />
                        <Text style={styles.name}>
                            {getLeagueDisplayName(name, language, competitionId, country)}
                        </Text>
                        {country ? <Text style={styles.meta}>{country}</Text> : null}
                    </View>

                    <Text style={styles.section}>{cp.table}</Text>
                    {!hasStandings ? (
                        <Text style={styles.mutedCenter}>{cp.noTable}</Text>
                    ) : standingsQ.isLoading ? (
                        <ActivityIndicator color={Colors.purpleSoft} style={{ marginTop: 24 }} />
                    ) : groups.length === 0 ? (
                        <Text style={styles.mutedCenter}>{cp.noTable}</Text>
                    ) : (
                        groups.map(([groupNum, group]) => (
                            <View key={groupNum} style={styles.tableCard}>
                                {group.name ? <Text style={styles.groupName}>{group.name}</Text> : null}
                                <View style={styles.headerRow}>
                                    <Text style={styles.cellPos}>#</Text>
                                    <Text style={[styles.teamName, { flex: 1 }]}>{' '}</Text>
                                    <Text style={styles.cell}>P</Text>
                                    <Text style={styles.cellPts}>Pts</Text>
                                </View>
                                {group.rows.map((row) => (
                                    <TouchableOpacity
                                        key={row.teamId}
                                        style={styles.row}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/team-profile' as any,
                                                params: {
                                                    id: String(row.teamId),
                                                    name: row.teamName,
                                                    logo: row.teamLogo,
                                                },
                                            } as any)
                                        }
                                    >
                                        <Text style={styles.cellPos}>{row.position}</Text>
                                        <View style={styles.teamCell}>
                                            <TeamBadge
                                                name={row.teamName}
                                                logo={row.teamLogo}
                                                size={22}
                                                color="transparent"
                                            />
                                            <Text style={styles.teamName} numberOfLines={1}>
                                                {getTeamDisplayName(row.teamName, language)}
                                            </Text>
                                        </View>
                                        <Text style={styles.cell}>{row.gamePlayed}</Text>
                                        <Text style={styles.cellPts}>{row.points}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgBase },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.base,
        paddingVertical: Spacing.sm,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.bold,
        flex: 1,
        textAlign: 'center',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    muted: { color: Colors.textMuted },
    mutedCenter: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
    hero: { alignItems: 'center', paddingVertical: Spacing['2xl'], gap: Spacing.sm },
    name: {
        color: Colors.textPrimary,
        fontSize: FontSize['3xl'],
        fontWeight: FontWeight.extrabold,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    meta: { color: Colors.textSecondary, fontSize: FontSize.lg },
    section: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.bold,
        paddingHorizontal: Spacing.base,
        marginBottom: Spacing.sm,
    },
    tableCard: {
        marginHorizontal: Spacing.base,
        marginBottom: Spacing.md,
        backgroundColor: Colors.surfaceGlass,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        paddingVertical: Spacing.sm,
    },
    groupName: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        paddingHorizontal: Spacing.base,
        marginBottom: Spacing.xs,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.base,
        paddingVertical: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.base,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.borderSubtle,
    },
    cellPos: { width: 28, color: Colors.textMuted, fontWeight: FontWeight.semibold },
    teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    teamName: { color: Colors.textPrimary, fontSize: FontSize.md, flex: 1 },
    cell: { width: 28, textAlign: 'right', color: Colors.textSecondary },
    cellPts: { width: 36, textAlign: 'right', color: Colors.textPrimary, fontWeight: FontWeight.bold },
});
