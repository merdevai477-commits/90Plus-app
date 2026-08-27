import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS } from './profileV2Assets';

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
    {
      id: 'achievements',
      label: t.profile.achievements,
      icon: PROFILE_ICONS.tabTrophy,
      iconActive: PROFILE_ICONS.tabTrophyActive,
    },
    ...(showPredictions
      ? [
          {
            id: 'predictions',
            label: t.profile.predictionsTab,
            icon: PROFILE_ICONS.tabBullseye,
            iconActive: PROFILE_ICONS.tabBullseyeActive,
          },
        ]
      : []),
    {
      id: 'videos',
      label: isOwnProfile ? t.profile.reels : t.profile.videos,
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
              style={styles.tab}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.78}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              {isActive ? (
                <LinearGradient
                  colors={['rgba(139,92,246,0.2)', 'rgba(81,54,144,0.08)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.activePill}
                />
              ) : null}
              <Text
                style={[styles.tabLabel, isActive ? styles.tabLabelActive : styles.tabLabelIdle]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
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
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: ProfileTheme.colors.profileTabBar,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileTabBorder,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: 52,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
    position: 'relative',
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    marginHorizontal: 2,
    marginVertical: 6,
    borderRadius: 10,
  },
  activeUnderline: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 2.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: ProfileTheme.colors.profilePrimary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  tabLabelActive: {
    color: ProfileTheme.colors.avatarRing,
  },
  tabLabelIdle: {
    color: '#7A7A7A',
  },
  tabIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
  },
});
