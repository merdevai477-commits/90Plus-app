/**
 * SoonModal
 *
 * "Coming soon" modal triggered from the WC banner. Uses a proper backdrop
 * pattern (separate dismiss layer + content) and only runs the countdown
 * interval while the modal is visible.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Trophy } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getWorldCupTimeLeft,
  padCountdown,
  WorldCupTimeLeft,
} from '../../constants/worldCup';
import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';
const GOLD = '#FFD700';

const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;

interface SoonModalProps {
  visible: boolean;
  onClose: () => void;
}

const SoonModal: React.FC<SoonModalProps> = ({ visible, onClose }) => {
  const [time, setTime] = useState<WorldCupTimeLeft>(() => getWorldCupTimeLeft());
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible) return;
    setTime(getWorldCupTimeLeft());
    const tickRate = time.days > 1 ? 60_000 : 1_000;
    const id = setInterval(() => setTime(getWorldCupTimeLeft()), tickRate);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, time.days > 1]);

  const countdownItems: ReadonlyArray<{ val: number; lbl: string }> = [
    { val: time.days, lbl: t.rank.worldCup.days },
    { val: time.hours, lbl: t.rank.worldCup.hours },
    { val: time.mins, lbl: t.rank.worldCup.mins },
    { val: time.secs, lbl: t.rank.worldCup.secs },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.rank.worldCup.comingSoon}
        />
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Animated.View style={s.soonContent}>
          <GlassContainer
            intensity={40}
            tint="dark"
            effect="clear"
            interactive
            style={s.soonCard}
          >
            <View style={s.soonGlow} />
            <View style={s.soonIconBox}>
              <Trophy size={40} color={GOLD} fill={GOLD} />
            </View>

            <Text style={s.soonTitle}>{t.rank.worldCup.anticipate}</Text>
            <Text style={s.soonBrand}>{t.rank.worldCup.brand}</Text>

            <View style={s.modalCdRow}>
              {countdownItems.map(item => (
                <View key={item.lbl} style={s.modalCdBlock}>
                  <Text style={s.modalCdNum}>{padCountdown(item.val)}</Text>
                  <Text style={s.modalCdLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [s.soonCloseBtn, pressed && { opacity: 0.85 }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t.rank.worldCup.getReady}
            >
              <Text style={s.soonCloseText}>{t.rank.worldCup.getReady}</Text>
            </Pressable>
          </GlassContainer>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default SoonModal;

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  soonContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    elevation: 20,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  soonCard: {
    padding: 35,
    alignItems: 'center',
    gap: 12,
    backgroundColor:
      Platform.OS === 'ios' ? 'rgba(5, 1, 13, 0.4)' : 'rgba(20, 10, 40, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.5)',
  },
  soonGlow: {
    position: 'absolute',
    top: -50,
    width: 200,
    height: 200,
    backgroundColor: ACCENT,
    borderRadius: 100,
    opacity: 0.15,
  },
  soonIconBox: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(168,85,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  soonTitle: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(168,85,247,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    textAlign: 'center',
  },
  soonBrand: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 10,
  },
  modalCdRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  modalCdBlock: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCdNum: { color: GOLD, fontSize: 22, fontWeight: '900' },
  modalCdLbl: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
  },
  soonCloseBtn: {
    marginTop: 5,
    width: '100%',
    paddingVertical: 14,
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.5)',
    alignItems: 'center',
  },
  soonCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
