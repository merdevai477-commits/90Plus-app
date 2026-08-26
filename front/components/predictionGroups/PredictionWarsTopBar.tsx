/**
 * Cup screen top bar — back, title, XP chip (Figma 601:4075).
 */

import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import GradientText from '../ShareWin/components/GradientText';
import { useTranslation } from '../../src/i18n';
import { usePGFonts } from './theme';

const ICON_BACK = require('../../assets/images/prediction-groups/icon-back-arrow.svg');

/** Figma text fill: #EFE5FF → #5C14CA → #120335 */
const XP_GRADIENT = ['#EFE5FF', '#5C14CA', '#120335'] as const;
const XP_GRADIENT_LOCATIONS = [0, 0.62, 1] as const;

export const WARS_TOP_BAR_HEIGHT = 56;

function formatXp(value: number): string {
  try {
    return Math.round(value).toLocaleString('en-US');
  } catch {
    return String(Math.round(value));
  }
}

export function PredictionWarsTopBar({
  topInset,
  title,
  xp,
  onBack,
}: {
  topInset: number;
  title: string;
  xp: number;
  onBack: () => void;
}) {
  const { bold, medium } = usePGFonts();
  const { isRTL, direction } = useTranslation();
  const xpLabel = useMemo(() => formatXp(xp), [xp]);

  return (
    <View style={[styles.shell, { paddingTop: topInset }]}>
      <View style={styles.inner}>
        <View style={[styles.leftCluster, isRTL && styles.leftClusterRtl]}>
          <Pressable
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Image
              source={ICON_BACK}
              style={[styles.backIcon, isRTL && styles.backIconRtl]}
              contentFit="contain"
              transition={0}
            />
          </Pressable>
          <Text
            style={[styles.title, { fontFamily: bold, writingDirection: direction }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <View style={styles.xpCluster}>
          <View style={styles.xpDot}>
            <GradientText
              colors={XP_GRADIENT}
              locations={XP_GRADIENT_LOCATIONS}
              style={[styles.xpDotTxt, { fontFamily: bold }]}
            >
              XP
            </GradientText>
          </View>
          <View style={styles.xpPill}>
            <GradientText
              colors={XP_GRADIENT}
              locations={XP_GRADIENT_LOCATIONS}
              style={[styles.xpVal, { fontFamily: medium }]}
            >
              {xpLabel}
            </GradientText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    backgroundColor: '#030303',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  inner: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
    height: 38,
    maxWidth: 232,
  },
  leftClusterRtl: {
    flexDirection: 'row-reverse',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 28,
    height: 28,
  },
  backIconRtl: {
    transform: [{ scaleX: -1 }],
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    flexShrink: 1,
    textAlign: 'center',
  },
  xpCluster: {
    width: 111,
    height: 39,
    position: 'relative',
  },
  xpDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 39,
    height: 39,
    borderRadius: 35,
    backgroundColor: '#05010E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  xpPill: {
    position: 'absolute',
    left: 17,
    top: 0,
    width: 94,
    height: 39,
    paddingLeft: 28,
    paddingRight: 16,
    borderTopRightRadius: 48,
    borderBottomRightRadius: 48,
    backgroundColor: '#05010E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(92,20,202,0.58)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8.6,
    elevation: 8,
  },
  xpDotTxt: {
    color: '#EFE5FF',
    fontSize: 16,
  },
  xpVal: {
    color: '#EFE5FF',
    fontSize: 16,
  },
});
