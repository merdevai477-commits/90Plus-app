/**
 * Locked World Cup tab — tickets-style popup with hero image + countdown.
 * No action button; dismiss by tapping the backdrop.
 */

import React, { useEffect, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import {
  getWorldCupTimeLeft,
  padCountdown,
  WorldCupTimeLeft,
} from '../../constants/worldCup';
import { useTranslation } from '../../src/i18n';

interface WorldCupLockedModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WorldCupLockedModal({ visible, onClose }: WorldCupLockedModalProps) {
  const [time, setTime] = useState<WorldCupTimeLeft>(() => getWorldCupTimeLeft());
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible) return;
    setTime(getWorldCupTimeLeft());
    const id = setInterval(() => setTime(getWorldCupTimeLeft()), 1_000);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') setTime(getWorldCupTimeLeft());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [visible]);

  const items = [
    { val: time.days, lbl: t.rank.worldCup.days },
    { val: time.hours, lbl: t.rank.worldCup.hours },
    { val: time.mins, lbl: t.rank.worldCup.mins },
    { val: time.secs, lbl: t.rank.worldCup.secs },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

        <View style={s.cardOuter}>
          <View style={s.cardInner}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                {...({ style: StyleSheet.absoluteFill, tint: 'rgba(15,5,25,0.99)', effect: 'regular' } as object)}
              />
            ) : (
              <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(168,85,247,0.12)', 'rgba(0,0,0,0.55)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={s.heroWrap}>
              <Image
                source={require('../../assets/images/plear 90Plus.png')}
                style={s.heroImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <LinearGradient
                colors={['transparent', 'rgba(5,1,13,0.92)']}
                style={s.heroFade}
                pointerEvents="none"
              />
            </View>

            <Text style={s.countdownLabel}>{t.rank.worldCup.countdownLabel}</Text>
            <View style={s.cdRow}>
              {items.map((item) => (
                <View key={item.lbl} style={s.cdBlock}>
                  <Text style={s.cdNum}>{padCountdown(item.val)}</Text>
                  <Text style={s.cdLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.85)' : undefined,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
  },
  cardInner: {
    overflow: 'hidden',
    paddingBottom: 22,
  },
  heroWrap: {
    height: 200,
    width: '100%',
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  cdRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  cdBlock: {
    alignItems: 'center',
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cdNum: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  cdLbl: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default WorldCupLockedModal;
