/**
 * Initial loading skeleton for the Team/Club profile — mirrors the real layout
 * (header, quick stats, tabs, content rows) using the shared Skeleton primitive.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { Colors, Spacing, Radius } from '../../constants/theme';

export default function TeamProfileSkeleton() {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Skeleton width={40} height={40} borderRadius={Radius.full} />
                <View style={styles.identity}>
                    <View style={styles.identityLeft}>
                        <Skeleton width={72} height={72} borderRadius={Radius.full} />
                        <View style={styles.nameBlock}>
                            <Skeleton width={160} height={22} borderRadius={Radius.sm} />
                            <Skeleton width={100} height={14} borderRadius={Radius.sm} />
                        </View>
                    </View>
                    <Skeleton width={104} height={40} borderRadius={Radius.button} />
                </View>
                <View style={styles.metaRow}>
                    <Skeleton width={110} height={14} borderRadius={Radius.sm} />
                    <Skeleton width={130} height={14} borderRadius={Radius.sm} />
                </View>
            </View>

            {/* Quick stats */}
            <View style={styles.quickRow}>
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width={96} height={72} borderRadius={Radius.md} />
                ))}
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} width={72} height={18} borderRadius={Radius.sm} />
                ))}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Skeleton width={140} height={20} borderRadius={Radius.sm} />
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width="100%" height={72} borderRadius={Radius.md} style={styles.block} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgBase,
    },
    header: {
        paddingTop: Spacing['5xl'],
        paddingHorizontal: Spacing.base,
        gap: Spacing.base,
    },
    identity: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    identityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    nameBlock: {
        gap: Spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        gap: Spacing.base,
    },
    quickRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.base,
        marginTop: Spacing.lg,
    },
    tabsRow: {
        flexDirection: 'row',
        gap: Spacing.lg,
        paddingHorizontal: Spacing.base,
        marginTop: Spacing.xl,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
    },
    content: {
        paddingHorizontal: Spacing.base,
        marginTop: Spacing.lg,
        gap: Spacing.md,
    },
    block: {
        marginTop: Spacing.xs,
    },
});
