/**
 * Match Tabs Component
 * Enhanced with animations, haptic feedback, and unified colors
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';
import { useTranslation } from '../../src/i18n/useTranslation';

export type MatchTabType = 'all' | 'live' | 'upcoming' | 'finished' | 'favorites' | 'predictions';

interface MatchTabsProps {
  activeTab: MatchTabType;
  onTabChange: (tab: MatchTabType) => void;
}

const MatchTabs: React.FC<MatchTabsProps> = React.memo(({ activeTab, onTabChange }) => {
  const { t } = useTranslation();
  const tabPositions = useRef<Map<MatchTabType, number>>(new Map());
  const indicatorPosition = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const tabsOpacity = useSharedValue(0);

  const tabs = useMemo<Array<{ id: MatchTabType; label: string; icon?: string }>>(() => [
    { id: 'all', label: t.matches.tabs.all },
    { id: 'live', label: t.matches.tabs.live, icon: '🔴' },
    { id: 'upcoming', label: t.matches.tabs.upcoming },
    { id: 'finished', label: t.matches.tabs.finished },
    { id: 'favorites', label: t.matches.tabs.favorites, icon: '⭐' },
    { id: 'predictions', label: t.matches.tabs.predictions || 'التوقعات', icon: '🎯' },
  ], [t]);

  useEffect(() => {
    tabsOpacity.value = withTiming(1, { duration: ANIMATION_CONFIG.fadeInDuration });
  }, []);

  useEffect(() => {
    // Animate indicator when tab changes
    const position = tabPositions.current.get(activeTab) || 0;
    indicatorPosition.value = withSpring(position, ANIMATION_CONFIG.spring);
  }, [activeTab]);

  const handleTabPress = (tabId: MatchTabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabChange(tabId);
  };

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
    width: indicatorWidth.value,
    opacity: tabsOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                tabPositions.current.set(tab.id, x);
                if (isActive) {
                  indicatorPosition.value = x;
                  indicatorWidth.value = width;
                }
              }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.icon && <Text>{tab.icon} </Text>}
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.activeTab === nextProps.activeTab;
});

MatchTabs.displayName = 'MatchTabs';

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: MATCH_DETAILS_COLORS.border,
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: `rgba(34, 197, 94, 0.15)`,
    borderWidth: 1,
    borderColor: `rgba(34, 197, 94, 0.3)`,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  tabTextActive: {
    color: MATCH_DETAILS_COLORS.accent,
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: MATCH_DETAILS_COLORS.accent,
    borderRadius: 1,
  },
});

export default MatchTabs;
