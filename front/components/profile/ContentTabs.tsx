import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { useProfileTheme } from '../../hooks/useProfileTheme';
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
}: ContentTabsProps) {
  const { t, language } = useTranslation();
  const { colors: C } = useProfileTheme();
  const tabs = [
    {
      id: 'posts',
      label: t.profile.postsTab,
      icon: PROFILE_ICONS.tabBullseye,
      iconActive: PROFILE_ICONS.tabBullseyeActive,
    },
    {
      id: 'videos',
      label: t.profile.reels,
      icon: PROFILE_ICONS.tabVideo,
      iconActive: PROFILE_ICONS.tabVideoActive,
    },
    {
      id: 'achievements',
      label: t.profile.achievements,
      icon: PROFILE_ICONS.tabTrophy,
      iconActive: PROFILE_ICONS.tabTrophyActive,
    },
  ];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.tabsWrapper,
          language === 'ar' ? RTL_ROW : LTR_ROW,
          {
            backgroundColor: C.profileTabBar,
            borderColor: C.embossBorder,
            shadowColor: C.embossShadow,
          },
        ]}
      >
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
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? C.profilePrimary : C.profileMuted },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <Image
                source={isActive ? tab.iconActive : tab.icon}
                style={[styles.tabIcon, !isActive && styles.tabIconIdle]}
                contentFit="contain"
              />
              {isActive ? (
                <View style={[styles.activeUnderline, { backgroundColor: C.profilePrimary }]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export default ContentTabs;

const LTR_ROW = { direction: 'ltr' } as const;
const RTL_ROW = { direction: 'rtl' } as const;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 18,
  },
  tabsWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderRadius: 19,
    height: 51,
    overflow: 'hidden',
    paddingHorizontal: 10,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
  activeUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    borderRadius: 4,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
  },
  tabIconIdle: {
    opacity: 0.72,
  },
});
