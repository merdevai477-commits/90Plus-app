/**
 * Quick club/national-team info — a compact horizontal strip of headline chips.
 * The parent supplies the chips so it can adapt to what 365 actually returns
 * (country, competitions, matches played, etc.). Empty input renders nothing.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

export interface QuickStat {
    key: string;
    icon: any;
    value: string | number;
    label: string;
    tint?: string;
    onPress?: () => void;
}

interface TeamQuickStatsProps {
    stats: QuickStat[];
}

function StatChip({ stat }: { stat: QuickStat }) {
    const inner = (
        <>
            <Ionicons name={stat.icon} size={18} color={stat.tint ?? Colors.purpleSoft} />
            <Text style={styles.value} numberOfLines={1}>
                {stat.value}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
                {stat.label}
            </Text>
        </>
    );
    if (stat.onPress) {
        return (
            <TouchableOpacity style={styles.chip} onPress={stat.onPress} activeOpacity={0.8}>
                {inner}
            </TouchableOpacity>
        );
    }
    return <View style={styles.chip}>{inner}</View>;
}

export default function TeamQuickStats({ stats }: TeamQuickStatsProps) {
    if (!stats || stats.length === 0) return null;

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
