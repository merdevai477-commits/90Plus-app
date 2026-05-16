import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain, ArrowRight, X, Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  BG_SURFACE,
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_PRIMARY,
} from '../../constants/tokens';

const { width } = Dimensions.get('window');

interface QuizPopupProps {
  /** Delay before the popup appears (ms). Default 3 s. */
  initialDelay?: number;
}

export function QuizPopup({ initialDelay = 3000 }: QuizPopupProps) {
  const [visible, setVisible] = useState(false);
  const hasShown = useRef(false);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasShown.current) return;
    const timer = setTimeout(() => {
      hasShown.current = true;
      setVisible(true);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }, initialDelay);

    return () => clearTimeout(timer);
  }, [initialDelay, scaleAnim, opacityAnim]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  const handleStart = () => {
    dismiss();
    setTimeout(() => router.push('/(tabs)/quiz'), 180);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={[
        styles.backdrop,
        Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }
      ]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismiss}
        />
      </View>

      <View style={styles.centeredWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={12}>
            <X size={18} color={TEXT_MUTED} strokeWidth={2.2} />
          </TouchableOpacity>

          <LinearGradient
            colors={['#7c3aed', '#a855f7', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topAccent}
          />

          <View style={styles.iconWrap}>
            <LinearGradient
              colors={['#3b1f6e', '#5b21b6']}
              style={styles.iconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Brain size={28} color="#c4b5fd" strokeWidth={1.8} />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Daily Quiz</Text>
          <Text style={styles.subtitle}>
            A new question is waiting for you. Answer correctly and earn coins.
          </Text>

          <View style={styles.rewardRow}>
            <View style={styles.rewardPill}>
              <Zap size={13} color="#a78bfa" strokeWidth={2.2} />
              <Text style={styles.rewardTxt}>+10 coins per correct answer</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ctaWrap}
            onPress={handleStart}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[PURPLE_PRIMARY, '#9333ea']}
              style={styles.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.ctaTxt}>Start Quiz</Text>
              <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={dismiss} hitSlop={10} style={styles.dismissWrap}>
            <Text style={styles.dismissTxt}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const CARD_WIDTH = Math.min(width - 48, 340);

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,3,10,0.78)' },
  centeredWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  card: { width: CARD_WIDTH, backgroundColor: BG_SURFACE, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(124,58,237,0.28)', overflow: 'hidden', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22, alignItems: 'center', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 28, elevation: 18 },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { marginBottom: 18, borderRadius: 20, overflow: 'hidden', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  iconGrad: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)' },
  title: { fontSize: 22, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20, fontWeight: '500', marginBottom: 18, paddingHorizontal: 4 },
  rewardRow: { marginBottom: 22 },
  rewardPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(124,58,237,0.14)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  rewardTxt: { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
  ctaWrap: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  cta: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  dismissWrap: { paddingVertical: 4 },
  dismissTxt: { color: TEXT_MUTED, fontSize: 13, fontWeight: '600' },
});
