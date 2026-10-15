import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './MatchText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassBubbleFill, GlassRim, GlassSheen } from '../navigation/glass';
import { useAppFont } from '../../utils/fontSetup';

const ISLAND_HEIGHT = 56;
const ISLAND_RADIUS = ISLAND_HEIGHT / 2;
const ISLAND_GAP = 10;
const BAR_PAD_TOP = 6;
const BAR_PAD_BOTTOM = 8;
/** iOS blurs what scrolls behind the islands; Android has no blur, so the tint carries it. */
const ISLAND_FILL =
  Platform.OS === 'ios'
    ? (['rgba(70,36,128,0.62)', 'rgba(26,14,48,0.62)'] as const)
    : (['rgba(64,32,118,0.96)', 'rgba(24,13,46,0.96)'] as const);

/** Height of the bar below the status bar inset — screens floating content under it pad by this. */
export const MATCH_TOP_BAR_HEIGHT = BAR_PAD_TOP + ISLAND_HEIGHT + BAR_PAD_BOTTOM;

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
  /** Strip pinned to the title island's bottom edge, faded in with `collapseProgress`. */
  compactFooter?: React.ReactNode;
  collapseProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
  /** Overlay the screen so content scrolls behind the glass (pad content by `useMatchTopBarHeight`). */
  floating?: boolean;
};

/** One free-standing piece of liquid glass. */
function GlassIsland({
  style,
  lit,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  lit?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.island, style]}>
      {lit ? (
        <GlassBubbleFill radius={ISLAND_RADIUS} height={ISLAND_HEIGHT} />
      ) : (
        <>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, styles.islandClip]} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, styles.islandClip]}>
            <LinearGradient colors={ISLAND_FILL} style={StyleSheet.absoluteFill} />
          </View>
          <GlassSheen radius={ISLAND_RADIUS} />
          <GlassRim radius={ISLAND_RADIUS} tint="rgba(190,160,255,0.38)" />
        </>
      )}
      {children}
    </View>
  );
}

function GlassIslandButton({
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <GlassIsland lit={lit} style={styles.roundIsland}>
        {children}
      </GlassIsland>
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
  const titleFont = useAppFont(800);
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
  const bellLit = isSubscribed && !notificationsDisabled;
  const bellColor = bellLit ? '#fff' : notificationsDisabled ? 'rgba(199,155,255,0.4)' : '#d8c2ff';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, floating && styles.barFloating, { paddingTop: Math.max(insets.top, 12) + BAR_PAD_TOP }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['#0c051a', '#0c051a', 'rgba(12,5,26,0.88)', 'rgba(12,5,26,0)']}
        locations={[0, 0.88, 0.96, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="box-none" style={styles.row}>
        <GlassIslandButton onPress={onBack} accessibilityLabel={backLabel}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </GlassIslandButton>

        <GlassIsland style={styles.titleIsland}>
          <Animated.View
            style={[styles.centerLayer, { opacity: titleOpacity, transform: [{ translateY: titleShift }] }]}
          >
            <Text style={[styles.title, { fontFamily: titleFont }]} numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
          {compactContent && collapseProgress ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.centerLayer, styles.compactLayer, { opacity: collapseProgress }]}
            >
              {compactContent}
            </Animated.View>
          ) : null}
          {compactFooter && collapseProgress ? (
            <Animated.View pointerEvents="none" style={[styles.footer, { opacity: collapseProgress }]}>
              {compactFooter}
            </Animated.View>
          ) : null}
        </GlassIsland>

        <GlassIslandButton
          onPress={onNotifications}
          disabled={notificationsDisabled || notificationsLoading}
          lit={bellLit}
          accessibilityLabel={notificationsLabel}
          accessibilityState={{ selected: isSubscribed, disabled: notificationsDisabled }}
        >
          {notificationsLoading ? (
            <ActivityIndicator size="small" color="#c79bff" />
          ) : (
            <Ionicons name={isSubscribed ? 'notifications' : 'notifications-outline'} size={24} color={bellColor} />
          )}
        </GlassIslandButton>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ISLAND_GAP,
  },
  island: {
    height: ISLAND_HEIGHT,
    borderRadius: ISLAND_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C4DFF',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  islandClip: {
    borderRadius: ISLAND_RADIUS,
    overflow: 'hidden',
  },
  roundIsland: {
    width: ISLAND_HEIGHT,
  },
  titleIsland: {
    flex: 1,
    paddingHorizontal: 14,
  },
  pressed: {
    transform: [{ scale: 0.92 }],
  },
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLayer: {
    left: 12,
    right: 12,
  },
  footer: {
    position: 'absolute',
    left: ISLAND_RADIUS,
    right: ISLAND_RADIUS,
    bottom: 4,
    borderRadius: 1,
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    // Weight comes from Cairo_800ExtraBold / Inter_800ExtraBold via fontFamily —
    // synthetic fontWeight blurs Arabic glyphs on Android.
    textAlign: 'center',
    textShadowColor: 'rgba(164,123,255,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
