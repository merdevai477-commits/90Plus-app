import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  I18nManager,
  Animated,
  type LayoutChangeEvent,
} from 'react-native';
import { Text } from './MatchText';
import { useAppFont } from '../../utils/fontSetup';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

interface Tab {
  key: string;
  label: string;
  icon?: any;
}

interface ModernTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Horizontal offset of the content pager; drives the sliding underline while swiping. */
  scrollX?: Animated.Value;
  pageWidth?: number;
  /** Rounded glass capsule that floats over scrolling content. */
  floating?: boolean;
}

type TabLayout = { x: number; width: number };

const INDICATOR_BASE_WIDTH = 100;
const INDICATOR_WIDTH_RATIO = 0.88;

export const ModernTabs: React.FC<ModernTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  scrollX,
  pageWidth,
  floating = false,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const fontRegular = useAppFont(400);
  const fontBold = useAppFont(700);
  const { colors, isDark } = useMatchDetailsTheme();

  const onTabLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[key];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  }, []);

  useEffect(() => {
    const l = layouts[activeTab];
    if (!l || containerWidth <= 0) return;
    scrollViewRef.current?.scrollTo({
      x: Math.max(0, l.x + l.width / 2 - containerWidth / 2),
      animated: true,
    });
  }, [activeTab, layouts, containerWidth]);

  const allMeasured = tabs.length > 1 && tabs.every((tab) => layouts[tab.key]);
  const useSlidingIndicator = Boolean(scrollX && pageWidth && pageWidth > 0 && allMeasured);

  let indicatorStyle: any = null;
  if (useSlidingIndicator && scrollX && pageWidth) {
    const inputRange = tabs.map((_, i) => i * pageWidth);
    const translateX = scrollX.interpolate({
      inputRange,
      outputRange: tabs.map((tab) => {
        const l = layouts[tab.key];
        return l.x + l.width / 2 - INDICATOR_BASE_WIDTH / 2;
      }),
      extrapolate: 'clamp',
    });
    const scaleX = scrollX.interpolate({
      inputRange,
      outputRange: tabs.map(
        (tab) => (layouts[tab.key].width * INDICATOR_WIDTH_RATIO) / INDICATOR_BASE_WIDTH,
      ),
      extrapolate: 'clamp',
    });
    indicatorStyle = { transform: [{ translateX }, { scaleX }] };
  }

  return (
    <View
      style={[
        floating ? styles.floatingContainer : styles.container,
        floating
          ? {
              backgroundColor: isDark ? 'rgba(20,9,38,0.96)' : colors.tabBarBg,
              borderColor: isDark ? 'rgba(129,10,242,0.38)' : colors.primaryBorder,
              shadowOpacity: isDark ? 0.45 : 0.12,
              elevation: isDark ? 10 : 4,
            }
          : {
              backgroundColor: colors.tabBarBg,
              borderBottomColor: isDark ? '#53198a' : colors.divider,
            },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, floating && styles.floatingTab]}
              onPress={() => onTabChange(tab.key)}
              onLayout={(e) => onTabLayout(tab.key, e)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.tabText,
                  floating && styles.floatingTabText,
                  { fontFamily: isActive ? fontBold : fontRegular, color: colors.tabIdle },
                  isActive && {
                    color: colors.tabActive,
                    textShadowColor: isDark ? 'rgba(95,39,149,0.45)' : 'transparent',
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isActive && !useSlidingIndicator ? (
                <View style={[styles.underline, { backgroundColor: colors.tabIndicator, shadowColor: colors.tabIndicator }]} />
              ) : (
                <View style={styles.underlineSpacer} />
              )}
            </TouchableOpacity>
          );
        })}
        {indicatorStyle ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slidingUnderline,
              { backgroundColor: colors.tabIndicator, shadowColor: colors.tabIndicator },
              indicatorStyle,
            ]}
          />
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  floatingContainer: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  floatingTab: {
    paddingTop: 10,
    minWidth: 60,
  },
  floatingTabText: {
    fontSize: 15,
    paddingBottom: 9,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 22,
    alignItems: 'flex-end',
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  tab: {
    paddingTop: 6,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabText: {
    fontSize: 17,
    paddingBottom: 10,
  },
  underline: {
    width: '88%',
    height: 2,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 3,
  },
  slidingUnderline: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: INDICATOR_BASE_WIDTH,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 3,
  },
  underlineSpacer: {
    height: 2,
  },
});
