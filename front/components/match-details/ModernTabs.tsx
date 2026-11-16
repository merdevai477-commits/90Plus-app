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
import { LinearGradient } from 'expo-linear-gradient';
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
  /** Horizontal offset of the content pager; drives the sliding active pill while swiping. */
  scrollX?: Animated.Value;
  pageWidth?: number;
  /** Rounded segmented pill that floats over scrolling content (Figma Match Tabs). */
  floating?: boolean;
}

type TabLayout = { x: number; width: number };

const INDICATOR_BASE_WIDTH = 100;
const ACTIVE_PILL_COLORS = ['#6A2BD9', '#4B1FA3'] as const;
const ACTIVE_PILL_COLORS_DARK = ['#8B5CF6', '#4B1FA3'] as const;
const FLOATING_TRACK_COLORS = ['#FFFFFF', '#FCF9FF'] as const;
const FLOATING_TRACK_COLORS_DARK = ['rgba(28,14,52,0.98)', 'rgba(20,9,38,0.98)'] as const;

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
  const fontSemiBold = useAppFont(600);
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
      outputRange: tabs.map((tab) => layouts[tab.key].width / INDICATOR_BASE_WIDTH),
      extrapolate: 'clamp',
    });
    indicatorStyle = { transform: [{ translateX }, { scaleX }] };
  }

  const activePillColors = isDark ? ACTIVE_PILL_COLORS_DARK : ACTIVE_PILL_COLORS;
  const idleTextColor = floating
    ? isDark
      ? '#C4B5FD'
      : '#6B7280'
    : colors.tabIdle;
  const activeTextColor = floating ? '#FFFFFF' : colors.tabActive;

  const renderTabLabel = (tab: Tab, isActive: boolean) => (
    <Text
      style={[
        floating ? styles.floatingTabText : styles.tabText,
        {
          fontFamily: floating
            ? fontSemiBold
            : isActive
              ? fontBold
              : fontRegular,
          color: isActive ? activeTextColor : idleTextColor,
          ...(!floating &&
            isActive &&
            isDark && {
              textShadowColor: 'rgba(95,39,149,0.45)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            }),
        },
      ]}
      numberOfLines={1}
    >
      {tab.label}
    </Text>
  );

  const tabsRow = (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={floating ? styles.floatingScrollContent : styles.scrollContent}
      decelerationRate="fast"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {floating && indicatorStyle ? (
        <Animated.View pointerEvents="none" style={[styles.slidingPill, indicatorStyle]}>
          <LinearGradient
            colors={[...activePillColors]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.slidingPillFill}
          />
        </Animated.View>
      ) : null}

      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const showStaticPill = floating && isActive && !useSlidingIndicator;

        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              floating ? styles.floatingTab : styles.tab,
              !floating && undefined,
            ]}
            onPress={() => onTabChange(tab.key)}
            onLayout={(e) => onTabLayout(tab.key, e)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {showStaticPill ? (
              <LinearGradient
                colors={[...activePillColors]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.floatingActivePill}
              >
                {renderTabLabel(tab, true)}
              </LinearGradient>
            ) : (
              <View style={floating ? styles.floatingTabInner : undefined}>
                {renderTabLabel(tab, isActive)}
                {!floating &&
                  (isActive && !useSlidingIndicator ? (
                    <View
                      style={[
                        styles.underline,
                        { backgroundColor: colors.tabIndicator, shadowColor: colors.tabIndicator },
                      ]}
                    />
                  ) : (
                    <View style={styles.underlineSpacer} />
                  ))}
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {!floating && indicatorStyle ? (
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
  );

  if (floating) {
    return (
      <LinearGradient
        colors={[...(isDark ? FLOATING_TRACK_COLORS_DARK : FLOATING_TRACK_COLORS)]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[
          styles.floatingContainer,
          {
            shadowOpacity: isDark ? 0.4 : 0.09,
            elevation: isDark ? 10 : 4,
            borderColor: isDark ? 'rgba(129,10,242,0.28)' : 'transparent',
            borderWidth: isDark ? 1 : 0,
          },
        ]}
      >
        {tabsRow}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.tabBarBg,
          borderBottomColor: isDark ? '#53198a' : colors.divider,
        },
      ]}
    >
      {tabsRow}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  floatingContainer: {
    borderRadius: 69,
    overflow: 'hidden',
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 21,
  },
  floatingScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    alignItems: 'center',
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  floatingTab: {
    minWidth: 56,
  },
  floatingTabInner: {
    height: 39,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  floatingActivePill: {
    height: 39,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 51,
  },
  floatingTabText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  slidingPill: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: INDICATOR_BASE_WIDTH,
    height: 39,
  },
  slidingPillFill: {
    flex: 1,
    borderRadius: 51,
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
