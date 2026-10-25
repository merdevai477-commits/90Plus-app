import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { CommunityAvatar } from './CommunityAvatar';
import { Tap } from './Tap';
import { C, CI } from './theme';

interface Props {
  isAr: boolean;
  avatar: string | null;
  name: string;
  placeholder: string;
  writeLabel: string;
  photoLabel: string;
  fonts: { regular: string; semibold: string };
  onWrite: () => void;
  onPhoto: () => void;
}

/** Feed-top "what's on your mind" card — Figma node 1474:3943. */
export const ComposerCard = memo(function ComposerCard({
  isAr,
  avatar,
  name,
  placeholder,
  writeLabel,
  photoLabel,
  fonts,
  onWrite,
  onPhoto,
}: Props) {
  const row = isAr ? 'row-reverse' : 'row';
  return (
    <View style={styles.card}>
      <View style={[styles.top, { flexDirection: row }]}>
        <CommunityAvatar uri={avatar} name={name} size={41} ring={false} />
        <Tap
          onPress={onWrite}
          style={[styles.input, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}
          pressedStyle={styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
        >
          <Text style={[styles.placeholder, { fontFamily: fonts.regular }]} numberOfLines={1}>
            {placeholder}
          </Text>
        </Tap>
      </View>
      <View style={[styles.bottom, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <Pressable onPress={onWrite} hitSlop={8} accessibilityRole="button" accessibilityLabel={writeLabel}>
          <Image source={CI.plus} style={styles.plus} contentFit="contain" />
        </Pressable>
        <View style={[styles.shortcuts, { flexDirection: row }]}>
          <Pressable onPress={onPhoto} hitSlop={8} style={[styles.shortcut, { flexDirection: row }]} accessibilityRole="button">
            <Image source={CI.image} style={styles.icon24} contentFit="contain" />
            <Text style={[styles.label, { fontFamily: fonts.semibold }]}>{photoLabel}</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={onWrite} hitSlop={8} style={[styles.shortcut, { flexDirection: row }]} accessibilityRole="button">
            <Image source={CI.smile} style={styles.icon24} contentFit="contain" />
            <Text style={[styles.label, { fontFamily: fonts.semibold }]}>{writeLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.composer,
    borderRadius: 16,
    paddingHorizontal: 21,
    paddingVertical: 17,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.18)',
    shadowColor: C.accent,
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  top: {
    alignItems: 'center',
    gap: 10,
    minHeight: 53,
  },
  input: {
    flex: 1,
    height: 41,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderRadius: 15,
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  pressed: {
    opacity: 0.75,
  },
  placeholder: {
    color: C.placeholder,
    fontSize: 13,
  },
  bottom: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plus: {
    width: 51,
    height: 36,
  },
  shortcuts: {
    alignItems: 'center',
    gap: 19,
  },
  shortcut: {
    alignItems: 'center',
    gap: 12,
  },
  icon24: { width: 24, height: 24 },
  label: {
    color: C.textStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 0.5,
    height: 19,
    backgroundColor: C.divider,
  },
});
