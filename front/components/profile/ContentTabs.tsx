import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

interface ContentTabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    videoCount: number;
    savedCount?: number;
    isOwnProfile?: boolean;
    showPublicAnalytics?: boolean;
}

const ContentTabs = memo(function ContentTabs({
    activeTab,
    onTabChange,
    videoCount,
    savedCount = 0,
    isOwnProfile = true,
    showPublicAnalytics = false,
}: ContentTabsProps) {
    const { t } = useTranslation();
    const tabs = [
        { id: 'videos', label: t.profile.videos, icon: 'grid-outline', count: videoCount },
        ...(isOwnProfile ? [{ id: 'saved', label: t.profile.saved, icon: 'bookmark-outline', count: savedCount }] : []),
        ...(isOwnProfile || showPublicAnalytics
            ? [{
                id: 'analytics',
                label: isOwnProfile ? t.profile.analytics : t.publicProfile.predictionAnalytics,
                icon: 'analytics-outline' as const,
            }]
            : []),
    ];

    const GlassWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
    const glassProps = isLiquidGlassSupported
      ? { effect: 'clear' as const, interactive: false }
      : { intensity: 20, tint: 'dark' as const };

    return (
        <View style={styles.container}>
            <View style={styles.tabsWrapper}>
                <GlassWrapper {...(glassProps as any)} style={StyleSheet.absoluteFill} />
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, isActive && styles.activeTab]}
                            onPress={() => onTabChange(tab.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.tabContent}>
                                <Ionicons
                                    name={tab.icon as any}
                                    size={20}
                                    color={isActive ? ProfileTheme.colors.neonBlue : ProfileTheme.colors.textSecondary}
                                />
                                <Text 
                                    style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {tab.label}
                                </Text>
                                {(tab.id === 'videos' || tab.id === 'saved') && (tab as any).count !== undefined && (
                                    <View style={[styles.badge, isActive && styles.activeBadge]}>
                                        <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                                            {(tab as any).count}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {isActive && (
                                <LinearGradient
                                    colors={[ProfileTheme.colors.neonBlue, 'transparent']}
                                    style={styles.indicator}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 0, y: 1 }}
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
});

export default ContentTabs;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    tabsWrapper: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(0,0,0,0.6)',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    tabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        zIndex: 2,
        flexShrink: 1,
        minWidth: 0, // Allow text to shrink below content size
    },
    tabLabel: {
        color: ProfileTheme.colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
        flexShrink: 1,
        minWidth: 0, // Allow text to shrink below content size
    },
    activeTabLabel: {
        color: ProfileTheme.colors.neonBlue,
        fontWeight: 'bold',
        textShadowColor: ProfileTheme.colors.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    activeBadge: {
        backgroundColor: ProfileTheme.colors.neonBlue,
    },
    badgeText: {
        color: ProfileTheme.colors.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    activeBadgeText: {
        color: '#000',
    },
    indicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        opacity: 0.8,
    },
});
