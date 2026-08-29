/**
 * Predict & Win header — same floating glass as Matches, with the 90 PLUS
 * brand pill and the screen title beside it.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView, type BlurTint } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassProps } from '../../constants/ui';
import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { IconBell } from './icons';
import { PW_HEADER, usePWDirection, usePWScale } from './theme';

const PLUS_ACCENT = '#A855F7';
const blurTint: BlurTint = 'dark';

/** Scroll/content offset so rows sit below the overlay header, matching Matches. */
export function usePWHeaderOffset() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 10) + 54;
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
  const { isRTL, row } = usePWDirection();
  const { s } = usePWScale();
  const insets = useSafeAreaInsets();
  const padTop = Math.max(insets.top, 10) + 10;

  const content = (
    <View style={[styles.row, { flexDirection: row }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          style={styles.sideSlot}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={22}
            color="#fff"
          />
        </Pressable>
      ) : null}

      <View style={styles.logoPill} accessibilityLabel={title}>
        <Text style={styles.logo90}>90</Text>
        <View style={styles.plusChip}>
          <Text style={styles.logoPlus}>PLUS</Text>
        </View>
        <Text style={styles.pillTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

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
  );

  const shellStyle = [styles.bar, { paddingTop: padTop }];

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
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
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
