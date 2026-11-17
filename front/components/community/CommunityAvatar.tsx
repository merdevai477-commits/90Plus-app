import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useCommunityTheme } from '../../hooks/useCommunityTheme';

interface Props {
  uri: string | null | undefined;
  name: string;
  size: number;
  onPress?: () => void;
  ring?: boolean;
}

/** Round avatar with the Figma violet ring and an initial fallback. */
export const CommunityAvatar = memo(function CommunityAvatar({ uri, name, size, onPress, ring = true }: Props) {
  const { colors } = useCommunityTheme();
  const inner = ring ? size - 4 : size;
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const content = (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 1.5 : 0,
          borderColor: colors.accent,
        },
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
        <View
          style={[
            styles.fallback,
            { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.accentDeep },
          ]}
        >
          <Text style={[styles.initial, { fontSize: inner * 0.4, color: colors.textStrong }]}>{initial}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
  },
});
