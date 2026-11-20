import React, { useEffect, useState } from 'react';
import { Animated, I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassRim, GlassSheen } from '../navigation/glass';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import DeveloperBadge from './DeveloperBadge';
import ProfileEliteMarks from './ProfileEliteMarks';
import VerifiedBadge from './VerifiedBadge';

const REVEAL_START = 100;
const REVEAL_END = 180;
const ISLAND_HEIGHT = 52;
const ISLAND_RADIUS = 22;
const ISLAND_FILL =
  Platform.OS === 'ios'
    ? (['rgba(255,255,255,0.94)', 'rgba(248,245,255,0.96)'] as const)
    : (['rgba(255,255,255,0.99)', 'rgba(248,245,255,0.99)'] as const);

function GlassIsland({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.island, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={48} tint="light" style={[StyleSheet.absoluteFill, styles.islandClip]} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.islandClip]}>
        <LinearGradient colors={ISLAND_FILL} style={StyleSheet.absoluteFill} />
      </View>
      <GlassSheen radius={ISLAND_RADIUS} />
      <GlassRim radius={ISLAND_RADIUS} tint="rgba(106,43,217,0.16)" />
      {children}
    </View>
  );
}

export function ProfileCollapsedBar({
  scrollY,
  name,
  avatarUri,
  userId,
  isVerified = false,
  isDeveloper = false,
  onBack,
}: {
  scrollY: Animated.Value;
  name: string;
  avatarUri?: string | null;
  userId?: string | null;
  isVerified?: boolean;
  isDeveloper?: boolean;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isRTL } = useTranslation();
  const nameFont = useAppFont(700);
  const [shown, setShown] = useState(false);
  const opacity = scrollY.interpolate({
    inputRange: [REVEAL_START, REVEAL_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const translateY = scrollY.interpolate({
    inputRange: [REVEAL_START, REVEAL_END],
    outputRange: [-10, 0],
    extrapolate: 'clamp',
  });
  const scale = scrollY.interpolate({
    inputRange: [REVEAL_START, REVEAL_END],
    outputRange: [0.96, 1],
    extrapolate: 'clamp',
  });
  const rowDirection = isRTL ? 'row-reverse' : 'row';

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const next = value > REVEAL_START + 16;
      setShown((prev) => (prev === next ? prev : next));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  const back = onBack ? (
    <Pressable
      onPress={onBack}
      hitSlop={4}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <GlassIsland style={styles.roundIsland}>
        <Ionicons name="chevron-back" size={22} color={ProfileTheme.colors.textPrimary} />
      </GlassIsland>
    </Pressable>
  ) : null;

  return (
    <Animated.View
      pointerEvents={shown ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, 12) + 4,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(249,246,254,0.98)',
          'rgba(249,246,254,0.88)',
          'rgba(249,246,254,0)',
        ]}
        locations={[0, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="box-none" style={[styles.row, { flexDirection: rowDirection }]}>
        {isRTL ? null : back}
        <GlassIsland style={styles.titleIsland}>
          <View style={styles.identity}>
            <View style={styles.avatarSlot}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.initial}>{(name || '?').slice(0, 1)}</Text>
                </View>
              )}
            </View>
            <View style={styles.nameCluster}>
              <Text style={[styles.name, { fontFamily: nameFont }]} numberOfLines={1}>
                {name}
              </Text>
              {isVerified ? <VerifiedBadge size={15} /> : null}
              {isDeveloper ? <DeveloperBadge size={15} /> : null}
              <ProfileEliteMarks userId={userId} />
            </View>
          </View>
        </GlassIsland>
        {isRTL ? back : null}
      </View>
    </Animated.View>
  );
}

export function bindProfileScroll(
  scrollY: Animated.Value,
  onOffset?: (y: number) => void,
) {
  return Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
        onOffset?.(event.nativeEvent.contentOffset.y);
      },
    },
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  row: {
    alignItems: 'center',
    gap: 10,
  },
  island: {
    height: ISLAND_HEIGHT,
    borderRadius: ISLAND_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(106,43,217,0.14)',
    shadowColor: '#1E0844',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
    alignItems: 'stretch',
  },
  identity: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSlot: {
    position: 'absolute',
    ...(I18nManager.isRTL ? { left: 10 } : { right: 10 }),
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  nameCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '64%',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ProfileTheme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: 'rgba(106,43,217,0.22)',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: ProfileTheme.colors.textPrimary, fontWeight: '700' },
  name: {
    flexShrink: 1,
    color: ProfileTheme.colors.textPrimary,
    fontSize: 16,
  },
});
