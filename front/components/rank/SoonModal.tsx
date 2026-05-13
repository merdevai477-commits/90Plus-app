import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Trophy } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const ACCENT = '#A855F7';
const GOLD = '#FFD700';

const WC_DATE = new Date('2026-06-11T00:00:00').getTime();

function getTimeLeft() {
  const diff = WC_DATE - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;

interface SoonModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SoonModal({ visible, onClose }: SoonModalProps) {
  const [t, setT] = useState(getTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setT(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdownItems = [
    { val: t.days, lbl: 'DAYS' },
    { val: t.hours, lbl: 'HOURS' },
    { val: t.mins, lbl: 'MINS' },
    { val: t.secs, lbl: 'SECS' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[s.soonOverlay, Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
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

            <Text style={s.soonTitle}>ANTICIPATE</Text>
            <Text style={s.soonBrand}>90 PLUS WORLD CUP</Text>

            <View style={s.modalCdRow}>
              {countdownItems.map((item) => (
                <View key={item.lbl} style={s.modalCdBlock}>
                  <Text style={s.modalCdNum}>{pad(item.val)}</Text>
                  <Text style={s.modalCdLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.soonCloseBtn} onPress={onClose}>
              <Text style={s.soonCloseText}>GET READY</Text>
            </TouchableOpacity>
          </GlassContainer>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  soonOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  soonContent: {
    width: '100%', maxWidth: 320, borderRadius: 28, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)', elevation: 20,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20,
  },
  soonCard: {
    padding: 35, alignItems: 'center', gap: 12,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(5, 1, 13, 0.4)' : 'rgba(20, 10, 40, 0.75)',
    borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.5)',
  },
  soonGlow: {
    position: 'absolute', top: -50, width: 200, height: 200,
    backgroundColor: ACCENT, borderRadius: 100, opacity: 0.15,
  },
  soonIconBox: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 5, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  soonTitle: {
    color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 4, textTransform: 'uppercase',
    textShadowColor: 'rgba(168,85,247,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15,
  },
  soonBrand: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '800', textAlign: 'center', letterSpacing: 2, marginBottom: 10 },
  modalCdRow: { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 20 },
  modalCdBlock: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, minWidth: 60,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCdNum: { color: GOLD, fontSize: 22, fontWeight: '900' },
  modalCdLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700', marginTop: 2 },
  soonCloseBtn: {
    marginTop: 5, width: '100%', paddingVertical: 14,
    backgroundColor: 'rgba(168,85,247,0.2)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.5)', alignItems: 'center',
  },
  soonCloseText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
