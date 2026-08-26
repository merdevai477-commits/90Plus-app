/**
 * Cup screen top bar — back, title, XP pill (Figma 477:2766).
 * Bottom LiquidGlass nav is unchanged elsewhere.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { usePGFonts } from './theme';

export const WARS_TOP_BAR_HEIGHT = 48;

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
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={[styles.shell, { paddingTop: topInset + 6 }]}>
      <View style={[styles.row, isRTL && styles.rowRtl]}>
        <View style={styles.leftCluster}>
          <Pressable onPress={onBack} style={styles.side} hitSlop={8} accessibilityRole="button">
            <BackIcon size={22} color="#fff" strokeWidth={2.25} />
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
            <Text style={[styles.xpDotTxt, { fontFamily: bold }]}>XP</Text>
          </View>
          <View style={styles.xpPill}>
            <Text style={[styles.xpVal, { fontFamily: medium }]}>{xp}</Text>
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
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: '#030303',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: WARS_TOP_BAR_HEIGHT,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  side: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, flexShrink: 1 },
  xpCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpPill: {
    height: 39,
    minWidth: 94,
    paddingLeft: 28,
    paddingRight: 20,
    marginLeft: -12,
    borderTopRightRadius: 48,
    borderBottomRightRadius: 48,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
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
  xpDot: {
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
  xpDotTxt: { color: '#EFE5FF', fontSize: 16 },
  xpVal: { color: '#EFE5FF', fontSize: 16 },
});
