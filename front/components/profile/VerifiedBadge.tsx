import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Text,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SURFACE_BG } from '../../constants/ui';
import { useTranslation } from '../../src/i18n';

interface VerifiedBadgeProps {
  size?: number;
}

export default function VerifiedBadge({ size = 32 }: VerifiedBadgeProps) {
  const { t, isRTL } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setShowModal(true);
  };

  const features = [
    t.profile.verifiedFeature1,
    t.profile.verifiedFeature2,
    t.profile.verifiedFeature3,
  ];

  return (
    <>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel={t.profile.verifiedBadgeTitle}
      >
        <Animated.View
          style={[
            styles.badge,
            { width: size, height: size, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={[styles.blueCircle, { width: size, height: size, borderRadius: size / 2 }]} />
          <Ionicons name="checkmark" size={size * 0.65} color="#FFF" />
        </Animated.View>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowModal(false)} />
          <View style={styles.modalCard}>
            <LinearGradient
              colors={['#140A28', '#0B0614', '#12081F']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glow} />

            <View style={styles.modalIconWrap}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                style={styles.modalIconBg}
              >
                <Ionicons name="checkmark" size={36} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={[styles.modalTitle, isRTL && styles.textRtl]}>
              {t.profile.verifiedBadgeTitle}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.modalSubtitle}>{t.profile.verifiedBadgeSubtitle}</Text>
            <Text style={[styles.modalText, isRTL && styles.textRtl]}>
              {t.profile.verifiedBadgeBody}
            </Text>

            <View style={styles.features}>
              {features.map((item) => (
                <View key={item} style={[styles.featureRow, isRTL && styles.rowRtl]}>
                  <View style={styles.bullet} />
                  <Text style={[styles.featureText, isRTL && styles.textRtl]}>{item}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.ctaWrap}
              onPress={() => setShowModal(false)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{t.profile.verifiedBadgeCta}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  badge: { justifyContent: 'center', alignItems: 'center' },
  blueCircle: {
    position: 'absolute',
    backgroundColor: '#1877F2',
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: SURFACE_BG,
  },
  glow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59,130,246,0.16)',
  },
  modalIconWrap: { marginBottom: 18 },
  modalIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
    marginVertical: 12,
  },
  modalSubtitle: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  features: { width: '100%', gap: 10, marginBottom: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  featureText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  ctaWrap: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  cta: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
