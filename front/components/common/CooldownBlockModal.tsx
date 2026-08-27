/**
 * CooldownBlockModal
 *
 * Shown BEFORE opening any upload picker when a cooldown is active.
 * Purple glass styling aligned with the profile theme.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useCooldownTimer, CooldownInfo } from '../../hooks/useCooldownTimer';
import { useTranslation } from '../../src/i18n';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface Props {
  visible: boolean;
  cooldown: CooldownInfo | null;
  type: 'avatar' | 'cover' | 'reel';
  onClose: () => void;
}

export const CooldownBlockModal: React.FC<Props> = ({ visible, cooldown, type, onClose }) => {
  const { t, isRTL } = useTranslation();
  const closingRef = useRef(false);
  const { remainingText } = useCooldownTimer(visible ? cooldown : null, visible);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (!visible || closingRef.current) return;
    closingRef.current = true;
    onClose();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  const title =
    type === 'avatar'
      ? t.profile.cooldownCannotAvatar
      : type === 'cover'
        ? t.profile.cooldownCannotCover
        : t.profile.cooldownCannotReel;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#1A0B33', '#0B0614', '#12081F']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.glow} />

          <View style={styles.iconWrap}>
            <LinearGradient
              colors={['#8B5CF6', '#5B21B6']}
              style={styles.iconBg}
            >
              <Ionicons name="time-outline" size={32} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={[styles.title, isRTL && styles.rtl]}>{title}</Text>

          {remainingText ? (
            <Text style={[styles.subtitle, isRTL && styles.rtl]}>
              {t.profile.cooldownAvailableAfter}
              {'\n'}
              <Text style={styles.countdown}>{remainingText}</Text>
            </Text>
          ) : (
            <Text style={[styles.subtitle, isRTL && styles.rtl]}>
              {t.profile.cooldownPleaseWait}
            </Text>
          )}

          <TouchableOpacity style={styles.btnWrap} onPress={handleClose} activeOpacity={0.88}>
            <LinearGradient
              colors={['#8B5CF6', '#5B21B6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{t.profile.okay}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    backgroundColor: ProfileTheme.colors.profileCard,
  },
  glow: {
    position: 'absolute',
    top: -70,
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  iconWrap: { marginBottom: 16 },
  iconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 26,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  countdown: {
    color: ProfileTheme.colors.avatarRing,
    fontSize: 20,
    fontWeight: '800',
  },
  rtl: { writingDirection: 'rtl' },
  btnWrap: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  btn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
