/**
 * Squad tab: players grouped by position (Goalkeepers / Defenders /
 * Midfielders / Forwards). Each card shows photo, shirt number, position, age,
 * and an injury badge (cross-referenced from the injuries endpoint). Tapping a
 * player opens the existing Player Profile screen.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Injury } from '../../services/apiFootball';
import type { SquadPlayer } from '../../hooks/useTeamProfile';
import { playerPhotoUrl } from '../../utils/playerStatsAggregate';
import { EmptyState } from './shared';
import { groupSquadByPosition, POSITION_GROUP_ORDER, PositionGroupKey } from './utils';

interface SquadTabProps {
    squad: SquadPlayer[] | undefined;
    injuries: Injury[] | undefined;
    t: TranslationKeys;
    onOpenPlayer: (player: SquadPlayer) => void;
}

const GROUP_LABEL_KEY: Record<PositionGroupKey, keyof TranslationKeys['teamProfile']> = {
    Goalkeeper: 'goalkeepers',
    Defender: 'defenders',
    Midfielder: 'midfielders',
    Attacker: 'forwards',
};

function PlayerCard({
    player,
    injured,
    ageLabel,
    onPress,
}: {
    player: SquadPlayer;
    injured: boolean;
    ageLabel: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.playerCard} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{player.number ?? '-'}</Text>
            </View>
            <Image
                source={{ uri: playerPhotoUrl(player.id, player.photo) }}
                style={styles.photo}
                contentFit="cover"
                transition={150}
            />
            <View style={styles.playerInfo}>
                <Text style={styles.playerName} numberOfLines={1}>
                    {player.name}
                </Text>
                <View style={styles.metaRow}>
                    {player.position ? <Text style={styles.metaText}>{player.position}</Text> : null}
                    {player.age != null ? (
                        <>
                            {player.position ? <Text style={styles.metaDot}>•</Text> : null}
                            <Text style={styles.metaText}>{ageLabel}</Text>
                        </>
                    ) : null}
                </View>
            </View>
            {injured ? (
                <View style={styles.injuryBadge}>
                    <Ionicons name="medkit" size={13} color={Colors.error} />
                </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
    );
}

export default function SquadTab({ squad, injuries, t, onOpenPlayer }: SquadTabProps) {
    const groups = useMemo(() => groupSquadByPosition(squad), [squad]);
    const injuredIds = useMemo(() => {
        const set = new Set<number>();
        for (const inj of injuries ?? []) {
            if (inj.player?.id) set.add(inj.player.id);
        }
        return set;
    }, [injuries]);

    const hasAny = POSITION_GROUP_ORDER.some((k) => groups[k].length > 0);

    if (!hasAny) {
        return (
            <View style={styles.container}>
                <EmptyState text={t.teamProfile.noSquadData} icon="people-outline" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {POSITION_GROUP_ORDER.map((key) => {
                const players = groups[key];
                if (players.length === 0) return null;
                return (
                    <View key={key} style={styles.group}>
                        <View style={styles.groupHeader}>
                            <Text style={styles.groupTitle}>{t.teamProfile[GROUP_LABEL_KEY[key]] as string}</Text>
                            <View style={styles.groupCount}>
                                <Text style={styles.groupCountText}>{players.length}</Text>
                            </View>
                        </View>
                        {players.map((p) => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                injured={injuredIds.has(p.id)}
                                ageLabel={`${p.age} ${t.teamProfile.age}`}
                                onPress={() => onOpenPlayer(p)}
                            />
                        ))}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.base,
        gap: Spacing.lg,
    },
    group: {
        gap: Spacing.sm,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    groupTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.bold,
    },
    groupCount: {
        minWidth: 24,
        height: 22,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.badge,
        backgroundColor: Colors.purpleMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupCountText: {
        color: Colors.purpleSoft,
        fontSize: FontSize.base,
        fontWeight: FontWeight.bold,
    },
    playerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.white04,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        padding: Spacing.sm,
        paddingRight: Spacing.md,
    },
    numberBadge: {
        width: 32,
        height: 32,
        borderRadius: Radius.sm,
        backgroundColor: Colors.purpleMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    numberText: {
        color: Colors.purpleSoft,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
    },
    photo: {
        width: 44,
        height: 44,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
    },
    playerInfo: {
        flex: 1,
    },
    playerName: {
        color: Colors.textPrimary,
        fontSize: FontSize.xl,
        fontWeight: FontWeight.semibold,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: 2,
    },
    metaText: {
        color: Colors.textSecondary,
        fontSize: FontSize.base,
    },
    metaDot: {
        color: Colors.textMuted,
        fontSize: FontSize.base,
    },
    injuryBadge: {
        width: 28,
        height: 28,
        borderRadius: Radius.full,
        backgroundColor: Colors.errorBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
