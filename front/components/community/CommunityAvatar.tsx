import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { C } from './theme';

interface Props {
  uri: string | null | undefined;
  name: string;
  size: number;
  onPress?: () => void;
  ring?: boolean;
}

/** Round avatar with the Figma violet ring and an initial fallback. */
export const CommunityAvatar = memo(function CommunityAvatar({ uri, name, size, onPress, ring = true }: Props) {
  const inner = ring ? size - 4 : size;
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const content = (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 1.5 : 0 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : (
        <View style={[styles.fallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={[styles.initial, { fontSize: inner * 0.4 }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={name}>
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  ring: {
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: C.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: C.textStrong,
    fontWeight: '700',
  },
});
