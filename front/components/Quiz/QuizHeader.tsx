/**
 * QuizHeader — Fixed top bar with back button, 90PLUS logo, and coin chip.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { ChevronLeft, Zap } from 'lucide-react-native';
import { router } from 'expo-router';

import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { TEXT_PRIMARY } from '../../constants/tokens';
import { ACCENT, ACCENT_SOFT, BLUR_INTENSITY } from './quiz.constants';

interface QuizHeaderProps {
  topInset: number;
}

export function QuizHeader({ topInset }: QuizHeaderProps) {
  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const { coins, loading } = useCoins();
  const { t } = useTranslation();
  const rowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';
  const display = loading ? '—' : String(coins);

  return (
    <GlassContainer
      intensity={25}
      tint="dark"
      effect="regular"
      style={[styles.container, { paddingTop: topInset + 12, flexDirection: rowDirection }]}
    >
      {/* Back → rank */}
      <TouchableOpacity
        onPress={() => router.push('/rank' as never)}
        style={styles.backBtn}
        activeOpacity={0.75}
        accessibilityLabel={t.common.cancel}
      >
        <ChevronLeft size={20} color={TEXT_PRIMARY} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* 90 PLUS logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoGlow} pointerEvents="none" />
        <View style={styles.logoPill}>
          <Text style={styles.logo90}>90</Text>
          <View style={styles.plusBadge}>
            <Text style={styles.plusTxt}>PLUS</Text>
          </View>
        </View>
      </View>

      {/* Coin chip */}
      <View
        style={styles.coinChip}
        accessibilityRole="text"
        accessibilityLabel={`${t.rank.a11yCoinChip}: ${display}`}
      >
        <Zap size={14} color={ACCENT_SOFT} fill={ACCENT_SOFT} />
        <Text style={styles.coinTxt}>{display}</Text>
      </View>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, start: 0, end: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(176,38,255,0.12)',
    backgroundColor: 'rgba(5,1,13,0.0)',
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#17172A',
    borderWidth: 1, borderColor: '#2B2B45',
  },
  logoWrap: {
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 90, height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    opacity: 0.18,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 0,
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17172A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#2B2B45',
    gap: 7,
  },
  logo90: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusBadge: {
    backgroundColor: ACCENT_SOFT,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  plusTxt: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17172A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2B2B45',
    gap: 6,
  },
  coinTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
