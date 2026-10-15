import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './MatchText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassBubbleFill, GlassRim, GlassSheen } from '../navigation/glass';

const CAPSULE_HEIGHT = 60;
const CAPSULE_RADIUS = CAPSULE_HEIGHT / 2;
const BUTTON_SIZE = 46;
const BAR_PAD_TOP = 6;
const BAR_PAD_BOTTOM = 8;
/** iOS blurs what scrolls behind the capsule; Android has no blur, so the tint carries it. */
const CAPSULE_FILL =
  Platform.OS === 'ios'
    ? (['rgba(70,36,128,0.62)', 'rgba(26,14,48,0.62)'] as const)
    : (['rgba(64,32,118,0.96)', 'rgba(24,13,46,0.96)'] as const);
const BUTTON_FILL = ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.06)'] as const;

/** Height of the bar below the status bar inset — screens floating content under it pad by this. */
export const MATCH_TOP_BAR_HEIGHT = BAR_PAD_TOP + CAPSULE_HEIGHT + BAR_PAD_BOTTOM;

export function useMatchTopBarHeight(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 12) + MATCH_TOP_BAR_HEIGHT;
}

type MatchDetailsTopBarProps = {
  title: string;
  backLabel: string;
  notificationsLabel: string;
  onBack: () => void;
  onNotifications: () => void;
  /** When true, show filled bell (subscribed to this match's push). */
  isSubscribed?: boolean;
  /** Disable toggle while request in flight or match finished. */
  notificationsDisabled?: boolean;
  notificationsLoading?: boolean;
  /** Shown in place of the title as `collapseProgress` goes 0 → 1 (e.g. compact score). */
  compactContent?: React.ReactNode;
  /** Strip pinned to the capsule's bottom edge, faded in with `collapseProgress`. */
  compactFooter?: React.ReactNode;
  collapseProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  /** Overlay the screen so content scrolls behind the glass (pad content by `useMatchTopBarHeight`). */
  floating?: boolean;
};

function GlassIconButton({
  onPress,
  disabled,
  lit,
  accessibilityLabel,
  accessibilityState,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  lit?: boolean;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  children: React.ReactNode;
}) {
  const radius = BUTTON_SIZE / 2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
    >
      {lit ? (
        <GlassBubbleFill radius={radius} height={BUTTON_SIZE} />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, styles.iconButtonClip]}>
            <LinearGradient colors={BUTTON_FILL} style={StyleSheet.absoluteFill} />
          </View>
          <GlassSheen radius={radius} />
          <GlassRim radius={radius} tint="rgba(210,190,255,0.32)" />
        </>
      )}
      {children}
    </Pressable>
  );
}

export function MatchDetailsTopBar({
  title,
  backLabel,
  notificationsLabel,
  onBack,
  onNotifications,
  isSubscribed = false,
  notificationsDisabled = false,
  notificationsLoading = false,
  compactContent,
  compactFooter,
  collapseProgress,
  floating = false,
}: MatchDetailsTopBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const titleFade = useRef(new Animated.Value(1)).current;
  const titleShift = useRef(new Animated.Value(0)).current;
  const firstTitle = useRef(true);
  useEffect(() => {
    if (firstTitle.current) {
      firstTitle.current = false;
      return;
    }
    titleFade.setValue(0);
    titleShift.setValue(6);
    Animated.parallel([
      Animated.timing(titleFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(titleShift, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [title, titleFade, titleShift]);

  const titleOpacity = collapseProgress && compactContent
    ? Animated.multiply(titleFade, Animated.subtract(1, collapseProgress))
    : titleFade;
  const bellColor = isSubscribed ? '#fff' : notificationsDisabled ? 'rgba(199,155,255,0.4)' : '#c79bff';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, floating && styles.barFloating, { paddingTop: Math.max(insets.top, 12) + BAR_PAD_TOP }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['#0c051a', '#0c051a', 'rgba(12,5,26,0.88)', 'rgba(12,5,26,0)']}
        locations={[0, 0.5, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.capsule}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, styles.capsuleClip]} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.capsuleClip]}>
          <LinearGradient colors={CAPSULE_FILL} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(164,123,255,0.28)', 'rgba(164,123,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <GlassSheen radius={CAPSULE_RADIUS} />
        <GlassRim radius={CAPSULE_RADIUS} tint="rgba(190,160,255,0.38)" />

        <GlassIconButton onPress={onBack} accessibilityLabel={backLabel}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </GlassIconButton>

        <View style={styles.center}>
          <Animated.View
            style={[styles.centerLayer, { opacity: titleOpacity, transform: [{ translateY: titleShift }] }]}
          >
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
          {compactContent && collapseProgress ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.centerLayer, StyleSheet.absoluteFill, { opacity: collapseProgress }]}
            >
              {compactContent}
            </Animated.View>
          ) : null}
        </View>

        <GlassIconButton
          onPress={onNotifications}
          disabled={notificationsDisabled || notificationsLoading}
          lit={isSubscribed && !notificationsDisabled}
          accessibilityLabel={notificationsLabel}
          accessibilityState={{ selected: isSubscribed, disabled: notificationsDisabled }}
        >
          {notificationsLoading ? (
            <ActivityIndicator size="small" color="#c79bff" />
          ) : (
            <Ionicons name={isSubscribed ? 'notifications' : 'notifications-outline'} size={24} color={bellColor} />
          )}
        </GlassIconButton>

        {compactFooter && collapseProgress ? (
          <Animated.View pointerEvents="none" style={[styles.footer, { opacity: collapseProgress }]}>
            {compactFooter}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 12,
    paddingBottom: BAR_PAD_BOTTOM,
    zIndex: 5,
  },
  barFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  capsule: {
    height: CAPSULE_HEIGHT,
    borderRadius: CAPSULE_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    gap: 8,
    shadowColor: '#7C4DFF',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  capsuleClip: {
    borderRadius: CAPSULE_RADIUS,
    overflow: 'hidden',
  },
  iconButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    transform: [{ scale: 0.92 }],
  },
  iconButtonClip: {
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    height: CAPSULE_HEIGHT - 8,
  },
  centerLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: CAPSULE_RADIUS + 8,
    right: CAPSULE_RADIUS + 8,
    bottom: 3,
    borderRadius: 1,
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(164,123,255,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
