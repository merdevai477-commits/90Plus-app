import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REVEAL_START = 120;
const REVEAL_END = 200;

export function ProfileCollapsedBar({
  scrollY,
  name,
  avatarUri,
  onBack,
}: {
  scrollY: Animated.Value;
  name: string;
  avatarUri?: string | null;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(false);
  const opacity = scrollY.interpolate({
    inputRange: [REVEAL_START, REVEAL_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const translateY = scrollY.interpolate({
    inputRange: [REVEAL_START, REVEAL_END],
    outputRange: [-8, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const next = value > REVEAL_START + 20;
      setShown((prev) => (prev === next ? prev : next));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  return (
    <Animated.View
      pointerEvents={shown ? 'box-none' : 'none'}
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 8), opacity, transform: [{ translateY }] }]}
    >
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.back} accessibilityRole="button">
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initial}>{(name || '?').slice(0, 1)}</Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
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
    paddingBottom: 8,
    backgroundColor: 'rgba(8, 5, 16, 0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 10,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2438',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#fff', fontWeight: '700' },
  name: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
});
