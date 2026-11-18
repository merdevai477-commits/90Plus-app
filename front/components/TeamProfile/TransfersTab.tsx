/**
 * Transfers tab (365Scores): a segmented Arrivals / Departures switch and the
 * transfer list (player, direction, other club, fee, date). Clubs only.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import CachedAthletePhoto from '../common/CachedAthletePhoto';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Competitor365Transfers, Competitor365Transfer } from '../../services/apiFootball';
import { Card, EmptyState } from './shared';
import { useProfileSurface } from './profileSurface';

type Direction = 'in' | 'out';

interface TransfersTabProps {
    transfers: Competitor365Transfers | undefined;
    t: TranslationKeys;
    onOpenPlayer?: (item: Competitor365Transfer) => void;
}

function formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function TransferRow({
    item,
    direction,
    onPress,
}: {
    item: Competitor365Transfer;
    direction: Direction;
    onPress?: () => void;
}) {
    const surface = useProfileSurface();
    const isIn = direction === 'in';
    return (
        <TouchableOpacity
            style={[styles.row, { borderBottomColor: surface.border }]}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
            disabled={!onPress}
        >
            <CachedAthletePhoto uri={item.athletePhoto} size={40} recyclingKey={item.athleteId} />
            <View style={styles.rowInfo}>
                <Text style={[styles.playerName, { color: surface.textStrong }]} numberOfLines={1}>
                    {item.athleteName}
                </Text>
                <View style={styles.clubLine}>
                    <Ionicons
                        name={isIn ? 'arrow-down' : 'arrow-up'}
                        size={12}
                        color={isIn ? Colors.success : Colors.error}
                    />
                    {item.clubLogo ? (
                        <Image
                            source={{ uri: item.clubLogo }}
                            style={styles.clubLogo}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                            recyclingKey={item.clubLogo}
                        />
                    ) : null}
                    <Text style={[styles.clubName, { color: surface.secondary }]} numberOfLines={1}>
                        {item.clubName ?? '—'}
                    </Text>
                </View>
            </View>
            <View style={styles.rowMeta}>
                {item.price ? <Text style={styles.price}>{item.price}</Text> : null}
                <Text style={[styles.date, { color: surface.muted }]}>{formatDate(item.date)}</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function TransfersTab({ transfers, t, onOpenPlayer }: TransfersTabProps) {
    const surface = useProfileSurface();
    const arrivals = transfers?.in ?? [];
    const departures = transfers?.out ?? [];
    const [direction, setDirection] = useState<Direction>('in');

    const list = direction === 'in' ? arrivals : departures;

    return (
        <View style={styles.container}>
            <View style={styles.segment}>
                <TouchableOpacity
                    style={[
                        styles.segmentBtn,
                        {
                            backgroundColor:
                                direction === 'in' ? surface.chipBgActive : surface.chipBg,
                            borderColor: direction === 'in' ? surface.chipBgActive : surface.border,
                        },
                    ]}
                    onPress={() => setDirection('in')}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="arrow-down"
                        size={14}
                        color={direction === 'in' ? surface.chipTextActive : surface.chipText}
                    />
                    <Text
                        style={[
                            styles.segmentText,
                            {
                                color:
                                    direction === 'in' ? surface.chipTextActive : surface.chipText,
                            },
                        ]}
                    >
                        {t.teamProfile.transfersIn}
                    </Text>
                    <Text
                        style={[
                            styles.segmentCount,
                            {
                                color: direction === 'in' ? surface.chipTextActive : surface.muted,
                            },
                        ]}
                    >
                        {arrivals.length}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.segmentBtn,
                        {
                            backgroundColor:
                                direction === 'out' ? surface.chipBgActive : surface.chipBg,
                            borderColor:
                                direction === 'out' ? surface.chipBgActive : surface.border,
                        },
                    ]}
                    onPress={() => setDirection('out')}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="arrow-up"
                        size={14}
                        color={direction === 'out' ? surface.chipTextActive : surface.chipText}
                    />
                    <Text
                        style={[
                            styles.segmentText,
                            {
                                color:
                                    direction === 'out' ? surface.chipTextActive : surface.chipText,
                            },
                        ]}
                    >
                        {t.teamProfile.transfersOut}
                    </Text>
                    <Text
                        style={[
                            styles.segmentCount,
                            {
                                color: direction === 'out' ? surface.chipTextActive : surface.muted,
                            },
                        ]}
                    >
                        {departures.length}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {list.length > 0 ? (
                    <Card>
                        {list.map((item, idx) => (
                            <TransferRow
                                key={`${item.athleteId}-${idx}`}
                                item={item}
                                direction={direction}
                                onPress={onOpenPlayer ? () => onOpenPlayer(item) : undefined}
                            />
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <EmptyState text={t.teamProfile.noTransfers} icon="swap-horizontal-outline" />
                    </Card>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.base,
        gap: Spacing.md,
    },
    segment: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    segmentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        borderRadius: Radius.chip,
        borderWidth: 1,
    },
    segmentText: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    segmentCount: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
    },
    list: {},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    rowInfo: {
        flex: 1,
        gap: 3,
    },
    playerName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    clubLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    clubLogo: {
        width: 14,
        height: 14,
    },
    clubName: {
        fontSize: FontSize.base,
        flexShrink: 1,
    },
    rowMeta: {
        alignItems: 'flex-end',
        gap: 2,
    },
    price: {
        color: Colors.success,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
    date: {
        fontSize: FontSize.sm,
    },
});
