/**
 * Fixed ultra-transparent top bar — back | 90 PLUS Kings | share.
 * Floats above scroll content (Quiz / Rank header pattern).
 */

import { BlurView } from 'expo-blur';
import { ChevronLeft, ChevronRight, Share as ShareIcon } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

import { glassProps } from '../../constants/ui';
import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { GroupKingsBrandTitle } from './GroupKingsBrandTitle';
import { LiquidGlassIconButton } from './LiquidGlassIconButton';

const SIDE_SLOT = 44;
const BAR_MIN_HEIGHT = 48;

export const GROUP_FIXED_HEADER_HEIGHT = BAR_MIN_HEIGHT + 12;

type Props = {
  topInset: number;
  isRTL: boolean;
  brandTitle: string;
  onBack: () => void;
  onBrandPress: () => void;
  onShare: () => void;
};

export function GroupFixedTopBar({
  topInset,
  isRTL,
  brandTitle,
  onBack,
  onBrandPress,
  onShare,
}: Props) {
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const shellStyle = [
    styles.shell,
    { paddingTop: topInset + 6, minHeight: topInset + GROUP_FIXED_HEADER_HEIGHT },
  ];

  const content = (
    <View style={[styles.row, row]}>
      <View style={styles.sideSlot}>
        <LiquidGlassIconButton onPress={onBack} accessibilityLabel="رجوع" size={SIDE_SLOT}>
          <BackIcon size={20} color="#FFFFFF" strokeWidth={2.25} />
        </LiquidGlassIconButton>
      </View>

      <View style={styles.centerSlot}>
        <GroupKingsBrandTitle onPress={onBrandPress} isRTL={isRTL} title={brandTitle} compact />
      </View>

      <View style={[styles.sideSlot, styles.sideSlotEnd]}>
        <LiquidGlassIconButton onPress={onShare} accessibilityLabel="مشاركة" size={SIDE_SLOT}>
          <ShareIcon size={19} color="#FFFFFF" strokeWidth={2.25} />
        </LiquidGlassIconButton>
      </View>
    </View>
  );

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView {...glassProps.header} style={shellStyle}>
        {content}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView intensity={Platform.OS === 'ios' ? 12 : 18} tint="dark" style={shellStyle}>
      <View style={styles.fallbackTint} pointerEvents="none" />
      {content}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'transparent',
  },
  fallbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,2,8,0.12)',
  },
  row: {
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: BAR_MIN_HEIGHT,
  },
  sideSlot: {
    width: SIDE_SLOT,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
