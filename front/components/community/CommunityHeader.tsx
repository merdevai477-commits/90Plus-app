import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, CI } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  fontFamily: string;
  onBack?: () => void;
  onBell?: () => void;
  onTitlePress?: () => void;
  right?: React.ReactNode;
}

/** Figma node 1474:4127 — back arrow, centered title, gradient bell. */
export const CommunityHeader = memo(function CommunityHeader({
  title,
  subtitle,
  fontFamily,
  onBack,
  onBell,
  onTitlePress,
  right,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <Image source={CI.back} style={styles.back} contentFit="contain" />
            </Pressable>
          )}
        </View>
        <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={styles.titleBox}>
          <Text style={[styles.title, { fontFamily }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { fontFamily }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </Pressable>
        <View style={[styles.side, styles.sideRight]}>
          {right ??
            (onBell && (
              <Pressable onPress={onBell} hitSlop={10} accessibilityRole="button" accessibilityLabel="Notifications">
                <Image source={CI.notification} style={styles.bell} contentFit="contain" />
              </Pressable>
            ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.header,
  },
  bar: {
    height: 66,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 44,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  back: { width: 38, height: 38 },
  bell: { width: 32, height: 32 },
  titleBox: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: C.textStrong,
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    color: C.muted,
    fontSize: 12,
    marginTop: 1,
  },
});
