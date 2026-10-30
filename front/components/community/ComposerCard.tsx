import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { CommunityAvatar } from './CommunityAvatar';
import { C, CI } from './theme';

interface Props {
  isAr: boolean;
  avatar: string | null;
  name: string;
  placeholder: string;
  writeLabel: string;
  photoLabel: string;
  pollLabel?: string;
  fonts: { regular: string; semibold: string };
  onWrite: () => void;
  onPhoto: () => void;
  onPoll?: () => void;
}

/**
 * Feed-top composer — Figma node 1542:3618.
 * Avatar + pill prompt, then + / write / poll shortcuts.
 */
export const ComposerCard = memo(function ComposerCard({
  isAr,
  avatar,
  name,
  placeholder,
  writeLabel,
  photoLabel: _photoLabel,
  pollLabel,
  fonts,
  onWrite,
  onPhoto: _onPhoto,
  onPoll,
}: Props) {
  const row = isAr ? ('row-reverse' as const) : ('row' as const);

  return (
    <View style={styles.card}>
      <View style={[styles.top, { flexDirection: row }]}>
        <CommunityAvatar uri={avatar} name={name} size={41} ring />
        <Pressable
          onPress={onWrite}
          style={[styles.input, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
        >
          <Text style={[styles.placeholder, { fontFamily: fonts.regular }]} numberOfLines={1}>
            {placeholder}
          </Text>
        </Pressable>
      </View>

      <View style={styles.hairline} />

      <View style={[styles.bottom, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <Pressable
          onPress={onWrite}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={writeLabel}
          style={styles.plusHit}
        >
          <Image source={CI.composerPlus} style={styles.plus} contentFit="contain" transition={0} />
        </Pressable>

        {/* Physical LTR order matches Figma: write · poll (poll sits closer to the trailing edge). */}
        <View style={styles.shortcuts}>
          <Pressable
            onPress={onWrite}
            hitSlop={8}
            style={[styles.shortcut, { flexDirection: row }]}
            accessibilityRole="button"
            accessibilityLabel={writeLabel}
          >
            <Image source={CI.composerSmile} style={styles.icon24} contentFit="contain" transition={0} />
            <Text style={[styles.label, { fontFamily: fonts.semibold }]}>{writeLabel}</Text>
          </Pressable>

          {onPoll && pollLabel ? (
            <>
              <View style={styles.vDivider} />
              <Pressable
                onPress={onPoll}
                hitSlop={8}
                style={[styles.shortcut, { flexDirection: row }]}
                accessibilityRole="button"
                accessibilityLabel={pollLabel}
              >
                <Image source={CI.composerPoll} style={styles.icon24} contentFit="contain" transition={0} />
                <Text style={[styles.label, { fontFamily: fonts.semibold }]}>{pollLabel}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0C0620',
    borderRadius: 24,
    paddingHorizontal: 21,
    paddingVertical: 17,
    gap: 14,
    borderWidth: 1,
    borderColor: '#1F065A',
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
    borderRadius: 100,
    backgroundColor: '#130A34',
  },
  placeholder: {
    color: '#A49BAD',
    fontSize: 13,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: '#39246B',
  },
  bottom: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  plusHit: {
    width: 51,
    height: 36,
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
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 19,
    backgroundColor: '#39246B',
  },
});
