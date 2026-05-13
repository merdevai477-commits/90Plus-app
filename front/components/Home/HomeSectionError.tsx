/**
 * HomeSectionError — reusable per-section error card.
 *
 * Used by MatchList, PlayerList, VideoList, TeamPitch so one section's
 * failure never crashes the whole screen. Each section renders its own
 * error state with an independent "Try again" action.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import {
    PURPLE_SOFT,
    PURPLE_PRIMARY,
    TEXT_PRIMARY,
    TEXT_MUTED,
    SCREEN_PADDING_H,
} from '../../constants/tokens';

interface HomeSectionErrorProps {
    /** Arabic/English label of the failing section — e.g. "المباريات". */
    sectionName: string;
    /** Technical detail hidden in __DEV__ only. */
    detail?: string;
    onRetry: () => void;
    /** Shown when offline — swaps copy and disables retry. */
    isOffline?: boolean;
}

export function HomeSectionError({
    sectionName,
    detail,
    onRetry,
    isOffline = false,
}: HomeSectionErrorProps) {
    const title = isOffline
        ? `لا يوجد اتصال — ${sectionName}`
        : `تعذّر تحميل ${sectionName}`;
    const subtitle = isOffline
        ? 'هنعرض آخر بيانات محفوظة'
        : 'اضغط لإعادة المحاولة';

    return (
        <View style={styles.wrap}>
            <View style={styles.card}>
                <LinearGradient
                    colors={['rgba(239,68,68,0.08)', 'rgba(124,58,237,0.04)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.iconWrap}>
                    <AlertTriangle size={20} color={PURPLE_SOFT} strokeWidth={2} />
                </View>
                <View style={styles.textBlock}>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                </View>
                {!isOffline && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={onRetry}
                        hitSlop={10}
                        style={styles.retryBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`إعادة تحميل ${sectionName}`}
                    >
                        <RefreshCw size={13} color={PURPLE_PRIMARY} strokeWidth={2.5} />
                        <Text style={styles.retryTxt}>إعادة</Text>
                    </TouchableOpacity>
                )}
            </View>
            {__DEV__ && detail ? <Text style={styles.devDetail}>{detail}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginHorizontal: SCREEN_PADDING_H,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(12,10,22,0.92)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(239,68,68,0.22)',
        overflow: 'hidden',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(124,58,237,0.14)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.3)',
    },
    textBlock: { flex: 1, minWidth: 0 },
    title: {
        color: TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    subtitle: {
        color: TEXT_MUTED,
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: 'rgba(124,58,237,0.14)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.32)',
    },
    retryTxt: {
        color: PURPLE_SOFT,
        fontSize: 11,
        fontWeight: '700',
    },
    devDetail: {
        color: 'rgba(239,68,68,0.55)',
        fontSize: 10,
        marginTop: 4,
        fontFamily: 'monospace',
    },
});
