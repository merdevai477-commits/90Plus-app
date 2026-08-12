/**
 * Quick club information — a compact strip of the most useful headline stats
 * (major trophies, squad size, coach, country). Anything unavailable is hidden.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { TranslationKeys } from '../../src/i18n/utils';

interface QuickStat {
    key: string;
    icon: any;
    value: string | number;
    label: string;
    tint?: string;
}

interface TeamQuickStatsProps {
    t: TranslationKeys;
    trophies?: number | null;
    squadSize?: number | null;
    coachName?: string | null;
    country?: string | null;
}

function StatChip({ stat }: { stat: QuickStat }) {
    return (
        <View style={styles.chip}>
            <Ionicons name={stat.icon} size={18} color={stat.tint ?? Colors.purpleSoft} />
            <Text style={styles.value} numberOfLines={1}>
                {stat.value}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
                {stat.label}
            </Text>
        </View>
    );
}

export default function TeamQuickStats({
    t,
    trophies,
    squadSize,
    coachName,
    country,
}: TeamQuickStatsProps) {
    const stats: QuickStat[] = [];

    if (typeof trophies === 'number' && trophies > 0) {
        stats.push({ key: 'trophies', icon: 'trophy', value: trophies, label: t.teamProfile.trophies, tint: Colors.gold });
    }
    if (typeof squadSize === 'number' && squadSize > 0) {
        stats.push({ key: 'squad', icon: 'people', value: squadSize, label: t.teamProfile.squadSize });
    }
    if (coachName) {
        stats.push({ key: 'coach', icon: 'person', value: coachName, label: t.teamProfile.coach });
    }
    if (country) {
        stats.push({ key: 'country', icon: 'flag', value: country, label: t.teamProfile.country });
    }

    if (stats.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {stats.map((s) => (
                <StatChip key={s.key} stat={s} />
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.sm,
        paddingHorizontal: Spacing.base,
    },
    chip: {
        minWidth: 96,
        backgroundColor: Colors.surfaceGlass,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.base,
        alignItems: 'center',
        gap: 3,
    },
    value: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.extrabold,
        maxWidth: 120,
    },
    label: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        maxWidth: 120,
    },
});
