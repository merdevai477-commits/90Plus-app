import { useCallback, useEffect, useMemo } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import {
  TAB_BLOB_SPAWN_SPRING,
  TAB_BUBBLE_HEIGHT,
  TAB_BUBBLE_WIDTH,
  TAB_FLOAT_OFFSET,
  TAB_LONG_PRESS_MS,
  TAB_SPRING,
} from './liquidGlassTabBar.constants';
import type { TabBarLayoutMetrics } from './liquidGlassTabBar.types';

interface UseLiquidTabBarGestureOptions {
  layout: TabBarLayoutMetrics;
  activeIndex: number;
  onNavigate: (index: number) => void;
  onHighlightChange?: (index: number) => void;
  onTabPressIn?: (index: number) => void;
}

function tabWidthWorklet(
  navWidth: number,
  paddingHorizontal: number,
  tabCount: number,
): number {
  'worklet';
  return (navWidth - paddingHorizontal * 2) / tabCount;
}

function tabCenterForIndexWorklet(
  index: number,
  navWidth: number,
  paddingHorizontal: number,
  tabCount: number,
): number {
  'worklet';
  const tabWidth = tabWidthWorklet(navWidth, paddingHorizontal, tabCount);
  return paddingHorizontal + index * tabWidth + tabWidth / 2;
}

function clampCenterXWorklet(
  centerX: number,
  navWidth: number,
  paddingHorizontal: number,
  tabCount: number,
): number {
  'worklet';
  const min = tabCenterForIndexWorklet(0, navWidth, paddingHorizontal, tabCount);
  const max = tabCenterForIndexWorklet(
    tabCount - 1,
    navWidth,
    paddingHorizontal,
    tabCount,
  );
  return Math.min(Math.max(centerX, min), max);
}

function indexFromCenterXWorklet(
  centerX: number,
  navWidth: number,
  paddingHorizontal: number,
  tabCount: number,
): number {
  'worklet';
  const tabWidth = tabWidthWorklet(navWidth, paddingHorizontal, tabCount);
  const raw = (centerX - paddingHorizontal - tabWidth / 2) / tabWidth;
  return Math.min(tabCount - 1, Math.max(0, Math.round(raw)));
}

function layoutFromMetrics(layout: TabBarLayoutMetrics) {
  return {
    navWidth: layout.navWidth,
    paddingHorizontal: layout.paddingHorizontal,
    tabCount: layout.tabCount,
  };
}

export function useLiquidTabBarGesture({
  layout,
  activeIndex,
  onNavigate,
  onHighlightChange,
  onTabPressIn,
}: UseLiquidTabBarGestureOptions) {
  const { navWidth, paddingHorizontal, tabCount } = layoutFromMetrics(layout);

  const blobCenterX = useSharedValue(
    tabCenterForIndexWorklet(activeIndex, navWidth, paddingHorizontal, tabCount),
  );
  const blobWidth = useSharedValue(TAB_BUBBLE_WIDTH);
  const blobScale = useSharedValue(1);
  const blobLift = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragIndex = useSharedValue(activeIndex);
  const dragOriginCenterX = useSharedValue(0);

  const bubbleTop = (layout.navHeight - TAB_BUBBLE_HEIGHT) / 2;
  const bubbleRadius = TAB_BUBBLE_HEIGHT / 2;

  const collapseBubble = useCallback(() => {
    blobWidth.value = withSpring(TAB_BUBBLE_WIDTH, TAB_SPRING);
    labelOpacity.value = withTiming(0, { duration: 160 });
  }, [blobWidth, labelOpacity]);

  useEffect(() => {
    blobCenterX.value = withSpring(
      tabCenterForIndexWorklet(activeIndex, navWidth, paddingHorizontal, tabCount),
      TAB_SPRING,
    );
    dragIndex.value = activeIndex;
  }, [activeIndex, navWidth, paddingHorizontal, tabCount, blobCenterX, dragIndex]);

  const triggerSelectionHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const triggerImpactHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const notifyHighlight = useCallback(
    (index: number) => {
      onHighlightChange?.(index);
    },
    [onHighlightChange],
  );

  const finishDrag = useCallback(
    (index: number) => {
      onNavigate(index);
    },
    [onNavigate],
  );

  const prefetchTab = useCallback(
    (index: number) => {
      onTabPressIn?.(index);
    },
    [onTabPressIn],
  );

  useAnimatedReaction(
    () => (isDragging.value ? dragIndex.value : activeIndex),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(notifyHighlight)(current);
      }
    },
    [activeIndex],
  );

  const blobAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const width = blobWidth.value;
    return {
      left: blobCenterX.value - width / 2,
      top: bubbleTop + blobLift.value,
      width,
      height: TAB_BUBBLE_HEIGHT,
      borderRadius: bubbleRadius,
      transform: [{ scale: blobScale.value }],
    };
  });

  const labelAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const extraWidth = Math.max(0, blobWidth.value - TAB_BUBBLE_WIDTH);
    return {
      opacity: labelOpacity.value,
      width: extraWidth,
      marginLeft: labelOpacity.value > 0.05 ? 8 : 0,
      overflow: 'hidden',
    };
  });

  const createTabGesture = useCallback(
    (index: number) => {
      const panAfterLongPress = Gesture.Pan()
        .activateAfterLongPress(TAB_LONG_PRESS_MS)
        .onStart(() => {
          'worklet';
          isDragging.value = true;
          dragIndex.value = index;
          blobWidth.value = withSpring(TAB_BUBBLE_WIDTH, TAB_SPRING);
          labelOpacity.value = withTiming(0, { duration: 100 });
          const origin = tabCenterForIndexWorklet(
            index,
            navWidth,
            paddingHorizontal,
            tabCount,
          );
          dragOriginCenterX.value = origin;
          blobCenterX.value = origin;
          blobScale.value = 0.9;
          blobScale.value = withSpring(1, TAB_BLOB_SPAWN_SPRING);
          blobLift.value = withSpring(TAB_FLOAT_OFFSET, TAB_SPRING);
          runOnJS(triggerImpactHaptic)();
          runOnJS(notifyHighlight)(index);
        })
        .onUpdate((event) => {
          'worklet';
          const nextCenter = clampCenterXWorklet(
            dragOriginCenterX.value + event.translationX,
            navWidth,
            paddingHorizontal,
            tabCount,
          );
          blobCenterX.value = nextCenter;
          const nearest = indexFromCenterXWorklet(
            nextCenter,
            navWidth,
            paddingHorizontal,
            tabCount,
          );
          if (nearest !== dragIndex.value) {
            dragIndex.value = nearest;
            runOnJS(triggerSelectionHaptic)();
          }
        })
        .onEnd(() => {
          'worklet';
          const targetIndex = dragIndex.value;
          blobCenterX.value = withSpring(
            tabCenterForIndexWorklet(
              targetIndex,
              navWidth,
              paddingHorizontal,
              tabCount,
            ),
            TAB_SPRING,
          );
          blobLift.value = withSpring(0, TAB_SPRING);
          blobScale.value = withSpring(1, TAB_SPRING);
          isDragging.value = false;
          runOnJS(finishDrag)(targetIndex);
        })
        .onFinalize((_, success) => {
          'worklet';
          if (!success) {
            isDragging.value = false;
            blobLift.value = withTiming(0, { duration: 180 });
            blobScale.value = withSpring(1, TAB_SPRING);
            blobCenterX.value = withSpring(
              tabCenterForIndexWorklet(
                activeIndex,
                navWidth,
                paddingHorizontal,
                tabCount,
              ),
              TAB_SPRING,
            );
          }
        });

      const tap = Gesture.Tap()
        .maxDuration(TAB_LONG_PRESS_MS - 20)
        .onBegin(() => {
          'worklet';
          runOnJS(prefetchTab)(index);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(triggerSelectionHaptic)();
          runOnJS(finishDrag)(index);
          blobCenterX.value = withSpring(
            tabCenterForIndexWorklet(
              index,
              navWidth,
              paddingHorizontal,
              tabCount,
            ),
            TAB_SPRING,
          );
        });

      return Gesture.Exclusive(tap, panAfterLongPress);
    },
    [
      activeIndex,
      blobCenterX,
      blobLift,
      blobScale,
      blobWidth,
      dragIndex,
      dragOriginCenterX,
      finishDrag,
      isDragging,
      labelOpacity,
      navWidth,
      paddingHorizontal,
      tabCount,
      notifyHighlight,
      prefetchTab,
      triggerImpactHaptic,
      triggerSelectionHaptic,
    ],
  );

  return useMemo(
    () => ({
      blobAnimatedStyle,
      labelAnimatedStyle,
      blobWidth,
      labelOpacity,
      createTabGesture,
      isDragging,
      dragIndex,
      collapseBubble,
    }),
    [
      blobAnimatedStyle,
      labelAnimatedStyle,
      blobWidth,
      labelOpacity,
      createTabGesture,
      dragIndex,
      isDragging,
      collapseBubble,
    ],
  );
}
