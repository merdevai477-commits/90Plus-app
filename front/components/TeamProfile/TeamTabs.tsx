/**
 * Horizontal, scrollable tab bar with the 90Plus purple underline active state.
 * The visible tabs are supplied by the parent so clubs and national teams can
 * show a different set (e.g. national teams hide Transfers).
 */

import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Text, View } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';

export type TeamTabKey = 'overview' | 'matches' | 'transfers' | 'table' | 'squad';

interface TeamTabsProps {
    active: TeamTabKey;
    onChange: (key: TeamTabKey) => void;
    labels: Record<TeamTabKey, string>;
    tabs: TeamTabKey[];
}

export default function TeamTabs({ active, onChange, labels, tabs }: TeamTabsProps) {
    return (
        <View style={styles.wrapper}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {tabs.map((key) => {
                    const isActive = key === active;
                    return (
                        <TouchableOpacity
                            key={key}
                            style={styles.tab}
                            onPress={() => onChange(key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                {labels[key]}
                            </Text>
                            <View style={[styles.underline, isActive && styles.underlineActive]} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
        backgroundColor: Colors.bgBase,
    },
    scroll: {
        paddingHorizontal: Spacing.base,
        gap: Spacing.lg,
    },
    tab: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    tabText: {
        color: Colors.textSecondary,
        fontSize: FontSize.xl,
        fontWeight: FontWeight.semibold,
        paddingBottom: Spacing.sm,
    },
    tabTextActive: {
        color: Colors.textPrimary,
        fontWeight: FontWeight.bold,
    },
    underline: {
        height: 3,
        width: '100%',
        borderRadius: 2,
        backgroundColor: 'transparent',
    },
    underlineActive: {
        backgroundColor: Colors.purplePrimary,
    },
});
