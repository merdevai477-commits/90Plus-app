/**
 * QuizHeader — Fixed liquid-glass bar aligned like Rank (back | 90 PLUS | coins).
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { ChevronLeft, Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { glassProps } from '../../constants/ui';

const ACCENT = '#A855F7';
const SIDE_SLOT_W = 88;
const blurTint: BlurTint = 'dark';

interface QuizHeaderProps {
  topInset: number;
}

export function QuizHeader({ topInset }: QuizHeaderProps) {
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const display = loading ? '—' : String(coins);

  const shellStyle = [styles.shell, { paddingTop: topInset + 10 }];

  const content = (
    <View style={[styles.row, I18nManager.isRTL && styles.rowRTL]}>
      <View style={[styles.sideSlot, I18nManager.isRTL && styles.sideSlotRTL]}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/rank')}
          style={styles.glassChip}
          activeOpacity={0.75}
          accessibilityLabel={t.common.cancel}
        >
          <ChevronLeft
            size={20}
            color="#FFFFFF"
            strokeWidth={2.5}
            style={I18nManager.isRTL ? styles.chevronRTL : undefined}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.centerSlot}>
        <View style={styles.logoPillSmall}>
          <Text style={styles.logo90Small}>90</Text>
          <View style={styles.plusChipSmall}>
            <Text style={styles.logoPlusSmall}>PLUS</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sideSlot, styles.sideSlotEnd, I18nManager.isRTL && styles.sideSlotEndRTL]}>
        <View
          style={styles.glassChip}
          accessibilityRole="text"
          accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
        >
          <Zap size={13} color={ACCENT} fill={ACCENT} />
          <Text style={styles.coinTxt}>{display}</Text>
        </View>
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
    <BlurView intensity={15} tint={blurTint} style={shellStyle}>
      {content}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 100,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  sideSlot: {
    width: SIDE_SLOT_W,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideSlotRTL: {
    alignItems: 'flex-end',
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  sideSlotEndRTL: {
    alignItems: 'flex-start',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 5,
  },
  logoPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 5,
  },
  logo90Small: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusChipSmall: {
    backgroundColor: ACCENT,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoPlusSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  coinTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  chevronRTL: {
    transform: [{ scaleX: -1 }],
  },
});
