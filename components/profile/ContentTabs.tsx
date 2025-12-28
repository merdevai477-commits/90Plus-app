import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface ContentTabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    videoCount: number;
}

export default function ContentTabs({ activeTab, onTabChange, videoCount }: ContentTabsProps) {
    const tabs = [
        { id: 'videos', label: 'الفيديوهات', icon: 'grid-outline' },
        { id: 'likes', label: 'الإعجابات', icon: 'heart-outline' },
    ];

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[ProfileTheme.colors.glassBlack, 'rgba(20,20,20,0.95)']}
                style={styles.tabsWrapper}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
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
                                <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                                    {tab.label}
                                </Text>
                                {tab.id === 'videos' && (
                                    <View style={[styles.badge, isActive && styles.activeBadge]}>
                                        <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                                            {videoCount}
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
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    tabsWrapper: {
        flexDirection: 'row-reverse',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        zIndex: 2,
    },
    tabLabel: {
        color: ProfileTheme.colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
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
