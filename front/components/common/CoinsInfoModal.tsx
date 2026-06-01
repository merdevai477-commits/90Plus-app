import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';

export function CoinsInfoModal({
  visible,
  onClose,
  onPrimaryAction,
}: {
  visible: boolean;
  onClose: () => void;
  onPrimaryAction?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          s.overlay,
          Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' },
        ]}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={s.outer}>
          <View style={s.inner}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ style: StyleSheet.absoluteFill, tint: 'rgba(15,5,25,0.99)', effect: 'regular' } as any)}
              />
            ) : (
              <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(168,85,247,0.15)', 'rgba(0,0,0,0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={s.iconWrap}>
              <View style={s.iconShadow}>
                <Zap size={32} color="#d8b4fe" />
              </View>
            </View>

            <Text style={s.title}>{t.coinsInfo.title}</Text>

            <View style={s.row}>
              <View style={s.dot} />
              <Text style={s.text}>{t.coinsInfo.rule1}</Text>
            </View>
            <View style={s.row}>
              <View style={s.dot} />
              <Text style={s.text}>{t.coinsInfo.rule2}</Text>
            </View>
            <View style={s.row}>
              <View style={s.dot} />
              <Text style={s.text}>{t.coinsInfo.rule3}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.9 }]}
              onPress={onPrimaryAction ?? onClose}
              accessibilityRole="button"
            >
              <LinearGradient colors={['#a855f7', '#7e22ce']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={s.btnTxt}>{t.coinsInfo.gotIt}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)' },
  outer: { width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 35, elevation: 20 },
  inner: { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)', overflow: 'hidden', padding: 24, alignItems: 'center' },
  iconWrap: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)' },
  iconShadow: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  row: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(168,85,247,0.85)', marginTop: 6 },
  text: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, flex: 1 },
  btn: { marginTop: 18, width: '100%', height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

