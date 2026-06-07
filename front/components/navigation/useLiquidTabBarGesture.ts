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
  TAB_BUBBLE_VERTICAL_OFFSET,
  TAB_BUBBLE_WIDTH_BY_INDEX,
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

function bubbleWidthForIndexWorklet(index: number): number {
  'worklet';
  return TAB_BUBBLE_WIDTH_BY_INDEX[index] ?? TAB_BUBBLE_HEIGHT + 20;
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

function springToTab(
  index: number,
  navWidth: number,
  paddingHorizontal: number,
  tabCount: number,
  blobCenterX: { value: number },
  blobWidth: { value: number },
) {
  'worklet';
  blobCenterX.value = withSpring(
    tabCenterForIndexWorklet(index, navWidth, paddingHorizontal, tabCount),
    TAB_SPRING,
  );
  blobWidth.value = withSpring(bubbleWidthForIndexWorklet(index), TAB_SPRING);
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
  const blobWidth = useSharedValue(bubbleWidthForIndexWorklet(activeIndex));
  const blobScale = useSharedValue(1);
  const blobLift = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragIndex = useSharedValue(activeIndex);
  const dragOriginCenterX = useSharedValue(0);

  const bubbleTop =
    (layout.navHeight - TAB_BUBBLE_HEIGHT) / 2 + TAB_BUBBLE_VERTICAL_OFFSET;
  const bubbleRadius = TAB_BUBBLE_HEIGHT / 2;

  useEffect(() => {
    springToTab(
      activeIndex,
      navWidth,
      paddingHorizontal,
      tabCount,
      blobCenterX,
      blobWidth,
    );
    dragIndex.value = activeIndex;
  }, [
    activeIndex,
    navWidth,
    paddingHorizontal,
    tabCount,
    blobCenterX,
    blobWidth,
    dragIndex,
  ]);

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
    return {
      left: blobCenterX.value - blobWidth.value / 2,
      top: bubbleTop + blobLift.value,
      width: blobWidth.value,
      height: TAB_BUBBLE_HEIGHT,
      borderRadius: bubbleRadius,
      transform: [{ scale: blobScale.value }],
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
          const origin = tabCenterForIndexWorklet(
            index,
            navWidth,
            paddingHorizontal,
            tabCount,
          );
          dragOriginCenterX.value = origin;
          blobCenterX.value = origin;
          blobWidth.value = bubbleWidthForIndexWorklet(index);
          blobScale.value = 0.94;
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
            blobWidth.value = withSpring(bubbleWidthForIndexWorklet(nearest), TAB_SPRING);
            runOnJS(triggerSelectionHaptic)();
          }
        })
        .onEnd(() => {
          'worklet';
          const targetIndex = dragIndex.value;
          springToTab(
            targetIndex,
            navWidth,
            paddingHorizontal,
            tabCount,
            blobCenterX,
            blobWidth,
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
            springToTab(
              activeIndex,
              navWidth,
              paddingHorizontal,
              tabCount,
              blobCenterX,
              blobWidth,
            );
          }
        });

      const tap = Gesture.Tap()
        .maxDuration(TAB_LONG_PRESS_MS - 20)
        .onBegin(() => {
          'worklet';
          if (index !== activeIndex) {
            runOnJS(prefetchTab)(index);
          }
        })
        .onEnd(() => {
          'worklet';
          if (index === activeIndex) {
            return;
          }
          runOnJS(notifyHighlight)(index);
          runOnJS(triggerSelectionHaptic)();
          springToTab(
            index,
            navWidth,
            paddingHorizontal,
            tabCount,
            blobCenterX,
            blobWidth,
          );
          runOnJS(finishDrag)(index);
        });

      return Gesture.Exclusive(tap, panAfterLongPress);
    },
    [
      activeIndex,
      blobCenterX,
      blobWidth,
      blobLift,
      blobScale,
      dragIndex,
      dragOriginCenterX,
      finishDrag,
      isDragging,
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
      createTabGesture,
      isDragging,
      dragIndex,
    }),
    [blobAnimatedStyle, createTabGesture, dragIndex, isDragging],
  );
}
