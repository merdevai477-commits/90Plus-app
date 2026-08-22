/**
 * Cup screen top bar — back, title, XP pill.
 */

import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PG, PG_GRADIENTS, PG_RADII, usePGFonts } from './theme';

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
  const { extra, bold } = usePGFonts();

  return (
    <View style={[styles.shell, { paddingTop: topInset + 6 }]}>
      <View style={styles.row}>
        <Pressable onPress={onBack} style={styles.side} hitSlop={8} accessibilityRole="button">
          <ChevronLeft size={22} color="#fff" strokeWidth={2.25} />
        </Pressable>
        <Text style={[styles.title, { fontFamily: extra }]} numberOfLines={1}>
          {title}
        </Text>
        <LinearGradient colors={[...PG_GRADIENTS.purple]} style={styles.xpPill}>
          <View style={styles.xpDot}>
            <Text style={[styles.xpDotTxt, { fontFamily: extra }]}>XP</Text>
          </View>
          <Text style={[styles.xpVal, { fontFamily: bold }]}>{xp}</Text>
        </LinearGradient>
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
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(3,3,3,0.78)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PG.borderSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: WARS_TOP_BAR_HEIGHT, gap: 8 },
  side: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: PG.text, fontSize: 16, textAlign: 'center' },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 10,
    borderRadius: PG_RADII.pill,
    borderWidth: 1,
    borderColor: PG.borderBright,
  },
  xpDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PG.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpDotTxt: { color: '#fff', fontSize: 8 },
  xpVal: { color: PG.primaryLight, fontSize: 13 },
});
