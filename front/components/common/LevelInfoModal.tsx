import React, { useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';

const ACCENT = '#A855F7';

export function LevelInfoModal({
  visible,
  onClose,
  level,
}: {
  visible: boolean;
  onClose: () => void;
  level: number;
}) {
  const { t } = useTranslation();

  const safeClose = useCallback(() => {
    runSafeModalClose(onClose);
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={safeClose}
    >
      <View
        style={[
          s.overlay,
          Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' },
        ]}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={safeClose} />

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
                <Trophy size={30} color="#d8b4fe" />
              </View>
            </View>

            <Text style={s.title}>{t.levelInfo.title}</Text>
            <Text style={s.subtitle}>{t.levelInfo.youAreLevel.replace('{level}', String(level))}</Text>
            <Text style={s.hype}>{t.levelInfo.hype}</Text>

            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.9 }]}
              onPress={safeClose}
              accessibilityRole="button"
            >
              <LinearGradient colors={['#a855f7', '#7e22ce']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={s.btnTxt}>{t.levelInfo.gotIt}</Text>
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
  title: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  hype: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  btn: { marginTop: 18, width: '100%', height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
