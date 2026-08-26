import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';

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
    isOwnProfile = true,
    showPublicAnalytics = false,
}: ContentTabsProps) {
    const { t } = useTranslation();
    const showPredictions = isOwnProfile || showPublicAnalytics;
    const tabs = [
        { id: 'achievements', label: t.profile.achievements, icon: 'trophy-outline' as const },
        ...(showPredictions
            ? [{ id: 'predictions', label: t.profile.predictionsTab, icon: 'disc-outline' as const }]
            : []),
        { id: 'videos', label: t.profile.videos, icon: 'videocam' as const },
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
                        >
                            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                                {tab.label}
                            </Text>
                            <Ionicons
                                name={tab.icon}
                                size={20}
                                color={isActive ? ProfileTheme.colors.profilePrimary : '#8A8A8A'}
                            />
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
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: ProfileTheme.colors.profileTabBar,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.profileTabBorder,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        height: 53,
        paddingHorizontal: 8,
    },
    tab: {
        flex: 1,
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: ProfileTheme.colors.profilePrimary,
    },
    tabLabel: {
        color: '#8A8A8A',
        fontSize: 13,
        fontWeight: '500',
    },
    activeTabLabel: {
        color: ProfileTheme.colors.profilePrimary,
        fontWeight: '600',
    },
});
