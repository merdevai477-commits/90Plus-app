/**
 * Locked World Cup tab — hero image with live countdown overlay.
 * Dismiss by tapping the backdrop.
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
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';

const ACCENT = '#A855F7';
const GOLD = '#F5D547';

interface WorldCupLockedModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WorldCupLockedModal({ visible, onClose }: WorldCupLockedModalProps) {
  const unlockAtMs = useAppFeaturesStore((s) => s.unlockAtMs);
  const [time, setTime] = useState<WorldCupTimeLeft>(() => getWorldCupTimeLeft(Date.now(), unlockAtMs));
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible) return;
    setTime(getWorldCupTimeLeft(Date.now(), unlockAtMs));
    const id = setInterval(() => setTime(getWorldCupTimeLeft(Date.now(), unlockAtMs)), 1_000);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') setTime(getWorldCupTimeLeft(Date.now(), unlockAtMs));
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [visible, unlockAtMs]);

  const items = [
    { val: time.days, lbl: t.rank.worldCup.days },
    { val: time.hours, lbl: t.rank.worldCup.hours },
    { val: time.mins, lbl: t.rank.worldCup.mins },
    { val: time.secs, lbl: t.rank.worldCup.secs },
  ];

  const Glass = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

        <View style={s.cardOuter} pointerEvents="box-none">
          <View style={s.heroClip}>
            <Image
              source={require('../../assets/images/plear 90Plus.png')}
              style={s.heroImg}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>

          <LinearGradient
            colors={['transparent', 'rgba(5,1,13,0.35)', 'rgba(5,1,13,0.88)']}
            locations={[0.45, 0.72, 1]}
            style={s.bottomFade}
            pointerEvents="none"
          />

          <View style={s.countdownWrap} pointerEvents="none">
            <Glass
              {...(isLiquidGlassSupported
                ? ({ effect: 'clear', tint: 'rgba(15,5,25,0.55)' } as object)
                : { intensity: 28, tint: 'dark' })}
              style={s.countdownGlass}
            >
              <LinearGradient
                colors={['rgba(168,85,247,0.18)', 'rgba(0,0,0,0.45)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={s.countdownLabel}>{t.rank.worldCup.countdownLabel}</Text>
              <View style={s.cdRow}>
                {items.map((item, index) => (
                  <React.Fragment key={item.lbl}>
                    {index > 0 ? <Text style={s.cdSep}>:</Text> : null}
                    <View style={s.cdBlock}>
                      <Text style={s.cdNum}>{padCountdown(item.val)}</Text>
                      <Text style={s.cdLbl}>{item.lbl}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </Glass>
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
    aspectRatio: 340 / 400,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  heroClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroImg: {
    position: 'absolute',
    top: '-2%',
    left: '-62%',
    width: '165%',
    height: '104%',
  },
  bottomFade: {
    ...StyleSheet.absoluteFillObject,
  },
  countdownWrap: {
    position: 'absolute',
    start: 16,
    end: 16,
    bottom: 18,
  },
  countdownGlass: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(10,5,20,0.35)' : 'rgba(15,8,28,0.82)',
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  cdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cdBlock: {
    alignItems: 'center',
    minWidth: 58,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  cdNum: {
    color: GOLD,
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  cdLbl: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  cdSep: {
    color: 'rgba(168,85,247,0.7)',
    fontSize: 20,
    fontWeight: '900',
    marginHorizontal: 2,
    marginBottom: 14,
  },
});

export default WorldCupLockedModal;
