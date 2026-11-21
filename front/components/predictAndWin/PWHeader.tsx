/**
 * Predict & Win header — dark: floating glass + brand pill (Matches-style).
 * Light: white bar, ink title, circular purple back, pale bottom border.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView, type BlurTint } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassProps } from '../../constants/ui';
import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { IconBell } from './icons';
import { PW_HEADER, usePWDirection, usePWScale, usePWTheme } from './theme';

const PLUS_ACCENT = '#A855F7';

/** Scroll/content offset so rows sit below the overlay header, matching Matches. */
export function usePWHeaderOffset() {
  const insets = useSafeAreaInsets();
  const theme = usePWTheme();
  const extra = theme.isDark ? 54 : 58;
  return Math.max(insets.top, 10) + extra;
}

export function PWHeader({
  title,
  onBack,
  onBell,
}: {
  title: string;
  onBack?: () => void;
  onBell?: () => void;
}) {
  const theme = usePWTheme();
  const { isRTL, row } = usePWDirection();
  const { s, f } = usePWScale();
  const insets = useSafeAreaInsets();
  const padTop = Math.max(insets.top, 10) + (theme.isDark ? 10 : 8);
  const blurTint: BlurTint = theme.blurTint;

  const backButton = onBack ? (
    <Pressable
      onPress={onBack}
      hitSlop={10}
      accessibilityRole="button"
      style={[
        styles.sideSlot,
        !theme.isDark && {
          borderRadius: s(PW_HEADER.backSize) / 2,
          borderWidth: 1.5,
          borderColor: theme.primary,
        },
      ]}
    >
      <Ionicons
        name={isRTL ? 'arrow-forward' : 'arrow-back'}
        size={theme.isDark ? 22 : 20}
        color={theme.isDark ? '#fff' : theme.primary}
      />
    </Pressable>
  ) : null;

  const titleBlock = theme.isDark ? (
    <View style={styles.logoPill} accessibilityLabel={title}>
      <Text style={styles.logo90}>90</Text>
      <View style={styles.plusChip}>
        <Text style={styles.logoPlus}>PLUS</Text>
      </View>
      <Text style={styles.pillTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  ) : (
    <Text
      accessibilityLabel={title}
      numberOfLines={1}
      style={{
        color: theme.ink,
        fontSize: f(28),
        fontWeight: '700',
        letterSpacing: -0.4,
        flexShrink: 1,
        maxWidth: '58%',
      }}
    >
      {title}
    </Text>
  );

  const content = theme.isDark ? (
    <View style={[styles.row, { flexDirection: row }]}>
      {backButton}
      {titleBlock}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={onBell}
        hitSlop={10}
        accessibilityRole="button"
        disabled={!onBell}
        style={[styles.sideSlot, { opacity: onBell ? 1 : 0 }]}
        pointerEvents={onBell ? 'auto' : 'none'}
      >
        <IconBell width={s(PW_HEADER.bellSize)} height={s(PW_HEADER.bellSize * (26.6695 / 24.0004))} />
      </Pressable>
    </View>
  ) : (
    <View style={[styles.row, { flexDirection: row }]}>
      {backButton}
      {titleBlock}
      <View style={{ flex: 1 }} />
    </View>
  );

  const shellStyle = [
    styles.bar,
    {
      paddingTop: padTop,
      borderBottomColor: theme.headerBorder,
      backgroundColor: theme.isDark ? 'transparent' : theme.white,
    },
  ];

  if (theme.isDark) {
    if (isLiquidGlassSupported) {
      return (
        <LiquidGlassView {...glassProps.header} style={shellStyle}>
          {content}
        </LiquidGlassView>
      );
    }
    return (
      <BlurView intensity={15} tint={blurTint} style={shellStyle}>
        {content}
      </BlurView>
    );
  }

  return <View style={shellStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    minHeight: 38,
    gap: 8,
  },
  sideSlot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '72%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 5,
  },
  logo90: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusChip: {
    backgroundColor: PLUS_ACCENT,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoPlus: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pillTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
});