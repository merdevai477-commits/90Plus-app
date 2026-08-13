/**
 * Table tab (365Scores): league standings for the competitor's competitions
 * that expose a table. Highlights the current competitor's row and supports a
 * competition selector plus grouped tables (e.g. cup group stages).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { Language } from '../../src/i18n/types';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Competitor365Competition, Standing365Row } from '../../services/apiFootball';
import { getTeamDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';
import { useCompetitorStandings } from '../../hooks/useTeamProfile';
import TeamBadge from '../common/TeamBadge';
import { Card, EmptyState } from './shared';

interface TableTabProps {
    competitorId: number;
    competitions: Competitor365Competition[];
    language: Language;
    t: TranslationKeys;
}

function StandingsRow({
    row,
    highlight,
    language,
}: {
    row: Standing365Row;
    highlight: boolean;
    language: Language;
}) {
    return (
        <View style={[styles.row, highlight && styles.rowHighlight]}>
            <Text style={[styles.cellPos, highlight && styles.cellHighlight]}>{row.position}</Text>
            <View style={styles.teamCell}>
                <TeamBadge name={row.teamName} logo={row.teamLogo} size={22} color="transparent" />
                <Text
                    style={[styles.teamName, highlight && styles.cellHighlight]}
                    numberOfLines={1}
                >
                    {getTeamDisplayName(row.teamName, language)}
                </Text>
            </View>
            <Text style={[styles.cell, highlight && styles.cellHighlight]}>{row.gamePlayed}</Text>
            <Text style={[styles.cell, styles.cellHideSm, highlight && styles.cellHighlight]}>
                {row.gamesWon}
            </Text>
            <Text style={[styles.cell, styles.cellHideSm, highlight && styles.cellHighlight]}>
                {row.gamesEven}
            </Text>
            <Text style={[styles.cell, styles.cellHideSm, highlight && styles.cellHighlight]}>
                {row.gamesLost}
            </Text>
            <Text style={[styles.cell, highlight && styles.cellHighlight]}>
                {row.goalsFor - row.goalsAgainst}
            </Text>
            <Text style={[styles.cellPts, highlight && styles.cellHighlight]}>{row.points}</Text>
        </View>
    );
}

export default function TableTab({ competitorId, competitions, language, t }: TableTabProps) {
    const [selected, setSelected] = useState<number | null>(competitions[0]?.id ?? null);
    const competitionId = selected ?? competitions[0]?.id ?? null;

    const { data: rows, isLoading } = useCompetitorStandings(competitionId, !!competitionId);

    const groups = useMemo(() => {
        const list = rows ?? [];
        const byGroup = new Map<number, { name: string | null; rows: Standing365Row[] }>();
        for (const row of list) {
            const g = byGroup.get(row.groupNum);
            if (g) g.rows.push(row);
            else byGroup.set(row.groupNum, { name: row.groupName, rows: [row] });
        }
        return [...byGroup.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([num, g]) => ({ num, name: g.name, rows: g.rows }));
    }, [rows]);

    if (competitions.length === 0) {
        return (
            <View style={styles.container}>
                <Card>
                    <EmptyState text={t.teamProfile.noStandings} icon="list-outline" />
                </Card>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {competitions.length > 1 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compRow}
                >
                    {competitions.map((c) => {
                        const active = c.id === competitionId;
                        return (
                            <TouchableOpacity
                                key={c.id}
                                style={[styles.compChip, active && styles.compChipActive]}
                                onPress={() => setSelected(c.id)}
                            >
                                {c.logo ? (
                                    <Image source={{ uri: c.logo }} style={styles.compLogo} contentFit="contain" />
                                ) : null}
                                <Text
                                    style={[styles.compText, active && styles.compTextActive]}
                                    numberOfLines={1}
                                >
                                    {getLeagueDisplayName(c.name, language, c.id, c.country)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : null}

            {isLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={Colors.purpleSoft} />
                </View>
            ) : groups.length > 0 ? (
                groups.map((group) => (
                    <Card key={group.num} style={styles.tableCard}>
                        {group.name && groups.length > 1 ? (
                            <Text style={styles.groupTitle}>{group.name}</Text>
                        ) : null}
                        <View style={styles.headerRow}>
                            <Text style={styles.cellPos}>{t.teamProfile.colPos}</Text>
                            <Text style={[styles.teamHeader]}>{t.teamProfile.colTeam}</Text>
                            <Text style={styles.cell}>{t.teamProfile.colPlayed}</Text>
                            <Text style={[styles.cell, styles.cellHideSm]}>{t.teamProfile.colWon}</Text>
                            <Text style={[styles.cell, styles.cellHideSm]}>{t.teamProfile.colDrawn}</Text>
                            <Text style={[styles.cell, styles.cellHideSm]}>{t.teamProfile.colLost}</Text>
                            <Text style={styles.cell}>{t.teamProfile.colGoalDiff}</Text>
                            <Text style={styles.cellPts}>{t.teamProfile.colPoints}</Text>
                        </View>
                        {group.rows.map((row) => (
                            <StandingsRow
                                key={`${row.groupNum}-${row.teamId}-${row.position}`}
                                row={row}
                                highlight={row.teamId === competitorId}
                                language={language}
                            />
                        ))}
                    </Card>
                ))
            ) : (
                <Card>
                    <EmptyState text={t.teamProfile.noStandings} icon="list-outline" />
                </Card>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.base,
        gap: Spacing.md,
    },
    compRow: {
        gap: Spacing.sm,
        paddingBottom: Spacing.xs,
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
        maxWidth: 160,
    },
    compTextActive: {
        color: Colors.purpleSoft,
        fontWeight: FontWeight.semibold,
    },
    loading: {
        paddingVertical: Spacing['3xl'],
        alignItems: 'center',
    },
    tableCard: {
        padding: Spacing.sm,
    },
    groupTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
        borderRadius: Radius.sm,
    },
    rowHighlight: {
        backgroundColor: Colors.purpleGlow,
    },
    cellPos: {
        width: 24,
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
    },
    teamCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingRight: Spacing.sm,
    },
    teamHeader: {
        flex: 1,
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        paddingLeft: Spacing.xs,
    },
    teamName: {
        color: Colors.textPrimary,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        flexShrink: 1,
    },
    cell: {
        width: 28,
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: FontSize.md,
    },
    cellHideSm: {
        // Kept visible; placeholder for potential compact mode.
    },
    cellPts: {
        width: 34,
        textAlign: 'center',
        color: Colors.textPrimary,
        fontSize: FontSize.md,
        fontWeight: FontWeight.extrabold,
    },
    cellHighlight: {
        color: Colors.textPrimary,
        fontWeight: FontWeight.bold,
    },
});
