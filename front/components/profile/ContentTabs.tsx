import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS } from './profileV2Assets';
import GradientText from '../ShareWin/components/GradientText';

interface ContentTabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    videoCount: number;
    savedCount?: number;
    isOwnProfile?: boolean;
    showPublicAnalytics?: boolean;
}

const ACTIVE_LABEL = ['#8B5CF6', '#513690'] as const;
const INACTIVE_LABEL = ['#A6A6A6', '#585858'] as const;

const ContentTabs = memo(function ContentTabs({
    activeTab,
    onTabChange,
    isOwnProfile = true,
    showPublicAnalytics = false,
}: ContentTabsProps) {
    const { t } = useTranslation();
    const showPredictions = isOwnProfile || showPublicAnalytics;
    const tabs = [
        {
            id: 'achievements',
            label: t.profile.achievements,
            icon: PROFILE_ICONS.tabTrophy,
            iconActive: PROFILE_ICONS.tabTrophyActive,
        },
        ...(showPredictions
            ? [{
                id: 'predictions',
                label: t.profile.predictionsTab,
                icon: PROFILE_ICONS.tabBullseye,
                iconActive: PROFILE_ICONS.tabBullseyeActive,
            }]
            : []),
        {
            id: 'videos',
            label: t.profile.reels,
            icon: PROFILE_ICONS.tabVideo,
            iconActive: PROFILE_ICONS.tabVideoActive,
        },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.tabsWrapper}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, isActive && styles.activeTab]}
                            onPress={() => onTabChange(tab.id)}
                            activeOpacity={0.7}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                        >
                            <GradientText
                                colors={isActive ? ACTIVE_LABEL : INACTIVE_LABEL}
                                style={styles.tabLabel}
                            >
                                {tab.label}
                            </GradientText>
                            <Image
                                source={isActive ? tab.iconActive : tab.icon}
                                style={styles.tabIcon}
                                contentFit="contain"
                            />
                            {isActive ? <View style={styles.activeUnderline} /> : null}
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
        marginHorizontal: 20,
        marginTop: 22,
    },
    tabsWrapper: {
        flexDirection: 'row',
        direction: 'ltr',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        backgroundColor: ProfileTheme.colors.profileTabBar,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.profileTabBorder,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        height: 53,
    },
    tab: {
        width: 89,
        height: 35,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    activeTab: {
        width: 93,
        height: 53,
    },
    activeUnderline: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        backgroundColor: ProfileTheme.colors.profilePrimary,
    },
    tabLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    tabIcon: {
        width: 24,
        height: 24,
    },
});
