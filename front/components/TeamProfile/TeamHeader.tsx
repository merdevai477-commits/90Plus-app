/**
 * Team/Club profile header: back button, logo + name, country + flag, founded
 * year, stadium, and a Follow button placed opposite the logo/name block.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Colors,
    Gradients,
    Spacing,
    Radius,
    FontSize,
    FontWeight,
    Shadows,
} from '../../constants/theme';
import type { Language } from '../../src/i18n/types';
import type { TranslationKeys } from '../../src/i18n/utils';
import TeamBadge from '../common/TeamBadge';
import { getTeamDisplayName, getCountryDisplayName } from '../../utils/i18nHelpers';
import { getCountryFlagEmoji, getCountryFlagUri } from '../../utils/countryFlagUri';

interface TeamHeaderProps {
    t: TranslationKeys;
    language: Language;
    name: string;
    competitorId?: number | null;
    logo?: string | null;
    country?: string | null;
    founded?: number | null;
    stadium?: string | null;
    isFollowing: boolean;
    followPending: boolean;
    onToggleFollow: () => void;
    onBack: () => void;
    topInset?: number;
}

function MetaItem({ icon, text }: { icon: any; text: string }) {
    return (
        <View style={styles.metaItem}>
            <Ionicons name={icon} size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
                {text}
            </Text>
        </View>
    );
}

export default function TeamHeader({
    t,
    language,
    name,
    competitorId,
    logo,
    country,
    founded,
    stadium,
    isFollowing,
    followPending,
    onToggleFollow,
    onBack,
    topInset,
}: TeamHeaderProps) {
    const displayName = getTeamDisplayName(name, language, competitorId);
    const countryLabel = country ? getCountryDisplayName(country, language) : '';
    const flagUri = country ? getCountryFlagUri(country, null, 40) : null;
    const flagEmoji = country ? getCountryFlagEmoji(country) : '';

    return (
        <LinearGradient
            colors={[Colors.purpleDeep, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.wrapper, topInset != null ? { paddingTop: topInset + Spacing.sm } : null]}
        >
            {/* Top bar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Identity + Follow */}
            <View style={styles.identityRow}>
                <View style={styles.identityLeft}>
                    <View style={styles.logoGlow}>
                        <TeamBadge name={name} logo={logo ?? undefined} size={64} color="transparent" />
                    </View>
                    <View style={styles.nameBlock}>
                        <Text style={styles.name} numberOfLines={2}>
                            {displayName}
                        </Text>
                        {countryLabel ? (
                            <View style={styles.countryRow}>
                                {flagUri ? (
                                    <Image source={{ uri: flagUri }} style={styles.flagImg} contentFit="cover" transition={150} />
                                ) : (
                                    <Text style={styles.flagEmoji}>{flagEmoji}</Text>
                                )}
                                <Text style={styles.countryText} numberOfLines={1}>
                                    {countryLabel}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.followingBtn]}
                    onPress={onToggleFollow}
                    disabled={followPending}
                    activeOpacity={0.85}
                >
                    {followPending ? (
                        <ActivityIndicator size="small" color={isFollowing ? Colors.purpleSoft : Colors.white} />
                    ) : (
                        <>
                            <Ionicons
                                name={isFollowing ? 'checkmark' : 'add'}
                                size={16}
                                color={isFollowing ? Colors.purpleSoft : Colors.white}
                            />
                            <Text style={[styles.followText, isFollowing && styles.followingText]}>
                                {isFollowing ? t.teamProfile.following : t.teamProfile.follow}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Meta */}
            <View style={styles.metaRow}>
                {founded ? <MetaItem icon="calendar-outline" text={`${t.teamProfile.founded} ${founded}`} /> : null}
                {stadium ? <MetaItem icon="business-outline" text={stadium} /> : null}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingTop: Spacing['5xl'],
        paddingHorizontal: Spacing.base,
        paddingBottom: Spacing.lg,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    identityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
    },
    logoGlow: {
        width: 76,
        height: 76,
        borderRadius: Radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.purpleGlow,
        borderWidth: 1,
        borderColor: Colors.purpleMuted,
    },
    nameBlock: {
        flex: 1,
        gap: 4,
    },
    name: {
        color: Colors.textPrimary,
        fontSize: FontSize['5xl'],
        fontWeight: FontWeight.extrabold,
    },
    countryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    flagImg: {
        width: 18,
        height: 12,
        borderRadius: 2,
    },
    flagEmoji: {
        fontSize: FontSize.lg,
    },
    countryText: {
        color: Colors.textSecondary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.medium,
    },
    followBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 104,
        height: 40,
        paddingHorizontal: Spacing.base,
        borderRadius: Radius.button,
        backgroundColor: Colors.purplePrimary,
        ...Shadows.button,
    },
    followingBtn: {
        backgroundColor: Colors.purpleMuted,
        borderWidth: 1,
        borderColor: Colors.purpleSoft,
        shadowOpacity: 0,
        elevation: 0,
    },
    followText: {
        color: Colors.white,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
    },
    followingText: {
        color: Colors.purpleSoft,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: Spacing.base,
        marginTop: Spacing.base,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
    },
});
