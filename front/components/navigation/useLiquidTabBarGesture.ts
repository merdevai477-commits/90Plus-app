import { useCallback, useEffect, useMemo } from 'react';
import {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import {
  TAB_BLOB_SPAWN_SPRING,
  TAB_BUBBLE_HEIGHT,
  TAB_BUBBLE_VERTICAL_OFFSET,
  TAB_FLOAT_OFFSET,
  TAB_LIQUID_STRETCH,
  TAB_LONG_PRESS_MS,
  TAB_MORPH_SETTLE_SPRING,
  TAB_MORPH_SPRING,
  TAB_SPRING,
} from './liquidGlassTabBar.constants';
import type { TabBarLayoutMetrics } from './liquidGlassTabBar.types';

interface UseLiquidTabBarGestureOptions {
  layout: TabBarLayoutMetrics;
  activeIndex: number;
  /** Per-tab pill width when active — index-aligned with tab slots. */
  bubbleWidths: number[];
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

function bubbleWidthForIndexWorklet(index: number, bubbleWidths: number[]): number {
  'worklet';
  return bubbleWidths[index] ?? TAB_BUBBLE_HEIGHT + 20;
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

function applyLiquidMorphWorklet(
  direction: number,
  blobScaleX: { value: number },
  blobScaleY: { value: number },
  blobSpecularShift: { value: number },
  blobGlow: { value: number },
) {
  'worklet';
  const stretch = 1 + TAB_LIQUID_STRETCH;
  const squash = 1 - TAB_LIQUID_STRETCH * 0.48;
  blobSpecularShift.value = withSpring(direction * 9, TAB_MORPH_SPRING);
  blobGlow.value = withSequence(
    withTiming(1, { duration: 90 }),
    withSpring(0.55, TAB_MORPH_SETTLE_SPRING),
  );
  blobScaleX.value = withSequence(
    withSpring(stretch, TAB_MORPH_SPRING),
    withSpring(1, TAB_MORPH_SETTLE_SPRING),
  );
  blobScaleY.value = withSequence(
    withSpring(squash, TAB_MORPH_SPRING),
    withSpring(1, TAB_MORPH_SETTLE_SPRING),
  );
}

function springToTab(
  index: number,
  fromIndex: number,
  navWidth: number,
  paddingHorizontal: number,
  tabCount: number,
  bubbleWidths: number[],
  blobCenterX: { value: number },
  blobWidth: { value: number },
  blobScaleX: { value: number },
  blobScaleY: { value: number },
  blobSpecularShift: { value: number },
  blobGlow: { value: number },
) {
  'worklet';
  if (index !== fromIndex) {
    const direction = index > fromIndex ? 1 : -1;
    applyLiquidMorphWorklet(
      direction,
      blobScaleX,
      blobScaleY,
      blobSpecularShift,
      blobGlow,
    );
  }
  blobCenterX.value = withSpring(
    tabCenterForIndexWorklet(index, navWidth, paddingHorizontal, tabCount),
    TAB_MORPH_SPRING,
  );
  blobWidth.value = withSpring(bubbleWidthForIndexWorklet(index, bubbleWidths), TAB_MORPH_SPRING);
}

export function useLiquidTabBarGesture({
  layout,
  activeIndex,
  bubbleWidths,
  onNavigate,
  onHighlightChange,
  onTabPressIn,
}: UseLiquidTabBarGestureOptions) {
  const { navWidth, paddingHorizontal, tabCount } = layoutFromMetrics(layout);

  const blobCenterX = useSharedValue(
    tabCenterForIndexWorklet(activeIndex, navWidth, paddingHorizontal, tabCount),
  );
  const blobWidth = useSharedValue(bubbleWidthForIndexWorklet(activeIndex, bubbleWidths));
  const blobScale = useSharedValue(1);
  const blobScaleX = useSharedValue(1);
  const blobScaleY = useSharedValue(1);
  const blobSpecularShift = useSharedValue(0);
  const blobGlow = useSharedValue(0.55);
  const blobLift = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragIndex = useSharedValue(activeIndex);
  const dragOriginCenterX = useSharedValue(0);
  const pendingTabIndex = useSharedValue(-1);
  const prevCenterX = useSharedValue(
    tabCenterForIndexWorklet(activeIndex, navWidth, paddingHorizontal, tabCount),
  );

  const bubbleTop =
    (layout.navHeight - TAB_BUBBLE_HEIGHT) / 2 + TAB_BUBBLE_VERTICAL_OFFSET;
  const bubbleRadius = TAB_BUBBLE_HEIGHT / 2;

  useEffect(() => {
    if (pendingTabIndex.value >= 0 && pendingTabIndex.value !== activeIndex) {
      return;
    }
    pendingTabIndex.value = -1;
    springToTab(
      activeIndex,
      activeIndex,
      navWidth,
      paddingHorizontal,
      tabCount,
      bubbleWidths,
      blobCenterX,
      blobWidth,
      blobScaleX,
      blobScaleY,
      blobSpecularShift,
      blobGlow,
    );
    dragIndex.value = activeIndex;
  }, [
    activeIndex,
    navWidth,
    paddingHorizontal,
    tabCount,
    bubbleWidths,
    blobCenterX,
    blobWidth,
    blobScaleX,
    blobScaleY,
    blobSpecularShift,
    blobGlow,
    dragIndex,
    pendingTabIndex,
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

  /** Velocity-driven stretch while the droplet travels (tap spring + drag). */
  useAnimatedReaction(
    () => blobCenterX.value,
    (current, previous) => {
      if (previous === null) {
        prevCenterX.value = current;
        return;
      }
      const delta = current - previous;
      prevCenterX.value = current;
      if (Math.abs(delta) < 0.08) {
        if (!isDragging.value) {
          blobScaleX.value = withSpring(1, TAB_MORPH_SETTLE_SPRING);
          blobScaleY.value = withSpring(1, TAB_MORPH_SETTLE_SPRING);
          blobSpecularShift.value = withSpring(0, TAB_MORPH_SETTLE_SPRING);
        }
        return;
      }
      const velocity = Math.min(Math.abs(delta), 22);
      const stretch = 1 + velocity * 0.014;
      const squash = 1 / Math.sqrt(stretch);
      blobScaleX.value = withSpring(stretch, { damping: 16, stiffness: 520, mass: 0.35 });
      blobScaleY.value = withSpring(squash, { damping: 16, stiffness: 520, mass: 0.35 });
      blobSpecularShift.value = withSpring(Math.sign(delta) * velocity * 0.55, {
        damping: 18,
        stiffness: 400,
        mass: 0.4,
      });
      blobGlow.value = withSpring(
        interpolate(velocity, [0, 22], [0.5, 1]),
        { damping: 20, stiffness: 380 },
      );
    },
  );

  // NOTE: Reanimated's transform typing is stricter than RN's ViewStyle in TS,
  // especially for scale/scaleX/scaleY combos. Cast to keep runtime behavior.
  const blobAnimatedStyle = useAnimatedStyle<any>(() => {
    'worklet';
    const morphRadius = bubbleRadius / Math.max(blobScaleX.value, 0.85);
    return {
      left: blobCenterX.value - blobWidth.value / 2,
      top: bubbleTop + blobLift.value,
      width: blobWidth.value,
      height: TAB_BUBBLE_HEIGHT,
      borderRadius: morphRadius,
      transform: [
        { scale: blobScale.value },
        { scaleX: blobScaleX.value },
        { scaleY: blobScaleY.value },
      ],
      opacity: interpolate(blobGlow.value, [0.4, 1], [0.94, 1]),
    } as any;
  });

  const blobSpecularStyle = useAnimatedStyle<any>(() => {
    'worklet';
    return {
      transform: [{ translateX: blobSpecularShift.value }],
      opacity: interpolate(blobGlow.value, [0.4, 1], [0.55, 1]),
    } as any;
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
          blobWidth.value = bubbleWidthForIndexWorklet(index, bubbleWidths);
          blobScale.value = 0.94;
          blobScale.value = withSpring(1, TAB_BLOB_SPAWN_SPRING);
          blobLift.value = withSpring(TAB_FLOAT_OFFSET, TAB_SPRING);
          blobGlow.value = withSpring(0.85, TAB_MORPH_SPRING);
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
            blobWidth.value = withSpring(bubbleWidthForIndexWorklet(nearest, bubbleWidths), TAB_MORPH_SPRING);
            runOnJS(triggerSelectionHaptic)();
          }
        })
        .onEnd(() => {
          'worklet';
          const targetIndex = dragIndex.value;
          const fromIndex = activeIndex;
          isDragging.value = false;
          pendingTabIndex.value = targetIndex;
          runOnJS(finishDrag)(targetIndex);
          springToTab(
            targetIndex,
            fromIndex,
            navWidth,
            paddingHorizontal,
            tabCount,
            bubbleWidths,
            blobCenterX,
            blobWidth,
            blobScaleX,
            blobScaleY,
            blobSpecularShift,
            blobGlow,
          );
          blobLift.value = withSpring(0, TAB_SPRING);
          blobScale.value = withSpring(1, TAB_SPRING);
        })
        .onFinalize((_, success) => {
          'worklet';
          if (!success) {
            isDragging.value = false;
            blobLift.value = withTiming(0, { duration: 180 });
            blobScale.value = withSpring(1, TAB_SPRING);
            blobScaleX.value = withSpring(1, TAB_MORPH_SETTLE_SPRING);
            blobScaleY.value = withSpring(1, TAB_MORPH_SETTLE_SPRING);
            springToTab(
              activeIndex,
              activeIndex,
              navWidth,
              paddingHorizontal,
              tabCount,
              bubbleWidths,
              blobCenterX,
              blobWidth,
              blobScaleX,
              blobScaleY,
              blobSpecularShift,
              blobGlow,
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
          pendingTabIndex.value = index;
          runOnJS(finishDrag)(index);
          runOnJS(notifyHighlight)(index);
          runOnJS(triggerSelectionHaptic)();
          springToTab(
            index,
            activeIndex,
            navWidth,
            paddingHorizontal,
            tabCount,
            bubbleWidths,
            blobCenterX,
            blobWidth,
            blobScaleX,
            blobScaleY,
            blobSpecularShift,
            blobGlow,
          );
        });

      return Gesture.Exclusive(tap, panAfterLongPress);
    },
    [
      activeIndex,
      blobCenterX,
      blobWidth,
      blobLift,
      blobScale,
      blobScaleX,
      blobScaleY,
      blobSpecularShift,
      blobGlow,
      bubbleWidths,
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
      pendingTabIndex,
    ],
  );

  return useMemo(
    () => ({
      blobAnimatedStyle,
      blobSpecularStyle,
      createTabGesture,
      isDragging,
      dragIndex,
    }),
    [blobAnimatedStyle, blobSpecularStyle, createTabGesture, dragIndex, isDragging],
  );
}
