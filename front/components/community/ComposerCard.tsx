import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useCommunityTheme } from '../../hooks/useCommunityTheme';
import { CommunityAvatar } from './CommunityAvatar';
import { CI, COMMUNITY_LIGHT_ELEVATION } from './theme';

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
  /** Avatar tap — usually opens the signed-in user's profile. */
  onAvatarPress?: () => void;
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
  onAvatarPress,
}: Props) {
  const { colors, isDark } = useCommunityTheme();
  const row = isAr ? ('row-reverse' as const) : ('row' as const);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.composer,
          borderColor: colors.composerBorder,
        },
        !isDark && COMMUNITY_LIGHT_ELEVATION.card,
      ]}
    >
      <View style={[styles.top, { flexDirection: row }]}>
        <CommunityAvatar uri={avatar} name={name} size={41} ring onPress={onAvatarPress} />
        <Pressable
          onPress={onWrite}
          style={[
            styles.input,
            {
              alignItems: isAr ? 'flex-end' : 'flex-start',
              backgroundColor: colors.input,
              borderColor: isDark ? 'transparent' : colors.inputBorder,
              borderWidth: isDark ? 0 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
        >
          <Text
            style={[styles.placeholder, { fontFamily: fonts.regular, color: colors.placeholder }]}
            numberOfLines={1}
          >
            {placeholder}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.hairline, { backgroundColor: colors.composerHairline }]} />

      <View style={[styles.bottom, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <Pressable
          onPress={onWrite}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={writeLabel}
          style={styles.plusHit}
        >
          <Image
            source={CI.composerPlus}
            style={styles.plus}
            contentFit="contain"
            transition={0}
            tintColor={colors.accent}
          />
        </Pressable>

        <View style={styles.shortcuts}>
          <Pressable
            onPress={onWrite}
            hitSlop={8}
            style={[styles.shortcut, { flexDirection: row }]}
            accessibilityRole="button"
            accessibilityLabel={writeLabel}
          >
            <Image
              source={CI.composerSmile}
              style={styles.icon24}
              contentFit="contain"
              transition={0}
              tintColor={colors.icon}
            />
            <Text style={[styles.label, { fontFamily: fonts.semibold, color: colors.textStrong }]}>
              {writeLabel}
            </Text>
          </Pressable>

          {onPoll && pollLabel ? (
            <>
              <View style={[styles.vDivider, { backgroundColor: colors.composerHairline }]} />
              <Pressable
                onPress={onPoll}
                hitSlop={8}
                style={[styles.shortcut, { flexDirection: row }]}
                accessibilityRole="button"
                accessibilityLabel={pollLabel}
              >
                <Image
                  source={CI.composerPoll}
                  style={styles.icon24}
                  contentFit="contain"
                  transition={0}
                  tintColor={colors.icon}
                />
                <Text style={[styles.label, { fontFamily: fonts.semibold, color: colors.textStrong }]}>
                  {pollLabel}
                </Text>
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
    borderRadius: 24,
    paddingHorizontal: 21,
    paddingVertical: 17,
    gap: 14,
    borderWidth: 1,
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
  },
  placeholder: {
    fontSize: 13,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 19,
  },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon24: { width: 24, height: 24 },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 19,
  },
});
