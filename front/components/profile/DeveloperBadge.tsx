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
import { SURFACE_BG, AppGradients, ACCENT } from '../../constants/ui';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';

interface DeveloperBadgeProps {
  size?: number;
}

export default function DeveloperBadge({ size = 32 }: DeveloperBadgeProps) {
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
    t.profile.developerFeature1,
    t.profile.developerFeature2,
    t.profile.developerFeature3,
  ];

  return (
    <>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel={t.profile.developerBadgeTitle}
      >
        <Animated.View
          style={[
            styles.badge,
            { width: size, height: size, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View
            style={[
              styles.outerCircle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          />
          <View style={styles.innerContent}>
            <Ionicons name="person" size={size * 0.55} color={ACCENT} />
            <Ionicons
              name="star"
              size={size * 0.28}
              color={ACCENT}
              style={styles.starIcon}
            />
          </View>
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
              colors={['#170B2E', '#0B0614', '#140A28']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glow} />

            <View style={styles.modalIconWrap}>
              <LinearGradient
                colors={[...AppGradients.purpleCTA]}
                style={styles.modalIconBg}
              >
                <Ionicons name="code-slash" size={30} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={[styles.modalTitle, isRTL && styles.textRtl]}>
              {t.profile.developerBadgeTitle}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.modalSubtitle}>{t.profile.developerBadgeSubtitle}</Text>
            <Text style={[styles.modalText, isRTL && styles.textRtl]}>
              {t.profile.developerBadgeBody}
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
                colors={[...AppGradients.purpleCTA]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{t.profile.developerBadgeCta}</Text>
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
  outerCircle: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  innerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  starIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
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
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: SURFACE_BG,
  },
  glow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  modalIconWrap: { marginBottom: 18 },
  modalIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(216,174,255,0.25)',
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
    backgroundColor: ProfileTheme.colors.profilePrimary,
    marginVertical: 12,
  },
  modalSubtitle: {
    color: ProfileTheme.colors.avatarRing,
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
    backgroundColor: ProfileTheme.colors.profilePrimary,
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
