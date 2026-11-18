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
import { with365ImageSize } from '../../utils/scores365AthletePhoto';
import { useCompetitorStandings } from '../../hooks/useTeamProfile';
import TeamBadge from '../common/TeamBadge';
import { Card, EmptyState } from './shared';
import { useProfileSurface } from './profileSurface';

interface TableTabProps {
    competitorId: number;
    competitions: Competitor365Competition[];
    language: Language;
    t: TranslationKeys;
    onOpenTeam?: (teamId: number, name: string, logo: string | null) => void;
}

function StandingsRow({
    row,
    highlight,
    language,
    onPress,
}: {
    row: Standing365Row;
    highlight: boolean;
    language: Language;
    onPress?: () => void;
}) {
    const surface = useProfileSurface();
    const cellColor = highlight ? surface.textStrong : surface.secondary;
    const cellStyle = highlight
        ? { color: cellColor, fontWeight: FontWeight.bold }
        : { color: cellColor };
    return (
        <TouchableOpacity
            style={[
                styles.row,
                highlight && { backgroundColor: surface.accentSoft },
            ]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.75 : 1}
        >
            <Text style={[styles.cellPos, cellStyle]}>{row.position}</Text>
            <View style={styles.teamCell}>
                <TeamBadge name={row.teamName} logo={row.teamLogo} size={22} color="transparent" />
                <Text
                    style={[
                        styles.teamName,
                        { color: surface.textStrong },
                        highlight && { fontWeight: FontWeight.bold },
                    ]}
                    numberOfLines={1}
                >
                    {getTeamDisplayName(row.teamName, language)}
                </Text>
            </View>
            <Text style={[styles.cell, cellStyle]}>{row.gamePlayed}</Text>
            <Text style={[styles.cell, styles.cellHideSm, cellStyle]}>{row.gamesWon}</Text>
            <Text style={[styles.cell, styles.cellHideSm, cellStyle]}>{row.gamesEven}</Text>
            <Text style={[styles.cell, styles.cellHideSm, cellStyle]}>{row.gamesLost}</Text>
            <Text style={[styles.cell, cellStyle]}>{row.goalsFor - row.goalsAgainst}</Text>
            <Text style={[styles.cellPts, cellStyle]}>{row.points}</Text>
        </TouchableOpacity>
    );
}

export default function TableTab({ competitorId, competitions, language, t, onOpenTeam }: TableTabProps) {
    const surface = useProfileSurface();
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
                                style={[
                                    styles.compChip,
                                    {
                                        backgroundColor: active ? surface.accentSoft : surface.chipBg,
                                        borderColor: active ? surface.accent : surface.border,
                                    },
                                ]}
                                onPress={() => setSelected(c.id)}
                            >
                                {c.logo ? (
                                    <Image
                                        source={{ uri: with365ImageSize(c.logo, 48) ?? c.logo }}
                                        style={styles.compLogo}
                                        contentFit="contain"
                                        cachePolicy="memory-disk"
                                        recyclingKey={c.logo}
                                        transition={0}
                                    />
                                ) : null}
                                <Text
                                    style={[
                                        styles.compText,
                                        {
                                            color: active ? surface.accent : surface.chipText,
                                            fontWeight: active ? FontWeight.semibold : FontWeight.regular,
                                        },
                                    ]}
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
                    <ActivityIndicator color={surface.accent} />
                </View>
            ) : groups.length > 0 ? (
                groups.map((group) => (
                    <Card key={group.num} style={styles.tableCard}>
                        {group.name && groups.length > 1 ? (
                            <Text style={[styles.groupTitle, { color: surface.textStrong }]}>
                                {group.name}
                            </Text>
                        ) : null}
                        <View style={[styles.headerRow, { borderBottomColor: surface.border }]}>
                            <Text style={[styles.cellPos, { color: surface.secondary }]}>
                                {t.teamProfile.colPos}
                            </Text>
                            <Text style={[styles.teamHeader, { color: surface.secondary }]}>
                                {t.teamProfile.colTeam}
                            </Text>
                            <Text style={[styles.cell, { color: surface.secondary }]}>
                                {t.teamProfile.colPlayed}
                            </Text>
                            <Text style={[styles.cell, styles.cellHideSm, { color: surface.secondary }]}>
                                {t.teamProfile.colWon}
                            </Text>
                            <Text style={[styles.cell, styles.cellHideSm, { color: surface.secondary }]}>
                                {t.teamProfile.colDrawn}
                            </Text>
                            <Text style={[styles.cell, styles.cellHideSm, { color: surface.secondary }]}>
                                {t.teamProfile.colLost}
                            </Text>
                            <Text style={[styles.cell, { color: surface.secondary }]}>
                                {t.teamProfile.colGoalDiff}
                            </Text>
                            <Text style={[styles.cellPts, { color: surface.textStrong }]}>
                                {t.teamProfile.colPoints}
                            </Text>
                        </View>
                        {group.rows.map((row) => (
                            <StandingsRow
                                key={`${row.groupNum}-${row.teamId}-${row.position}`}
                                row={row}
                                highlight={row.teamId === competitorId}
                                language={language}
                                onPress={
                                    row.teamId > 0 && row.teamId !== competitorId
                                        ? () => onOpenTeam?.(row.teamId, row.teamName, row.teamLogo || null)
                                        : undefined
                                }
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
        borderWidth: 1,
    },
    compLogo: {
        width: 16,
        height: 16,
    },
    compText: {
        fontSize: FontSize.base,
        maxWidth: 160,
    },
    loading: {
        paddingVertical: Spacing['3xl'],
        alignItems: 'center',
    },
    tableCard: {
        padding: Spacing.sm,
    },
    groupTitle: {
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
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
        borderRadius: Radius.sm,
    },
    cellPos: {
        width: 24,
        textAlign: 'center',
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
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        paddingLeft: Spacing.xs,
    },
    teamName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        flexShrink: 1,
    },
    cell: {
        width: 28,
        textAlign: 'center',
        fontSize: FontSize.md,
    },
    cellHideSm: {
        // Kept visible; placeholder for potential compact mode.
    },
    cellPts: {
        width: 34,
        textAlign: 'center',
        fontSize: FontSize.md,
        fontWeight: FontWeight.extrabold,
    },
});
