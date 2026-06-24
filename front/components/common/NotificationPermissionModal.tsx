import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Radio, Newspaper, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PURPLE_PRIMARY, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/tokens';
import { useTranslation } from '../../src/i18n';

interface NotificationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const { t, isRTL } = useTranslation();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 360);
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textAlign = isRTL ? 'right' : 'left';

  const features = [
    { id: 'live', Icon: Radio, label: t.notificationPermission.liveGoals },
    { id: 'news', Icon: Newspaper, label: t.notificationPermission.exclusiveNews },
  ] as const;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 14,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    scaleAnim.setValue(0.94);
    opacityAnim.setValue(0);
  }, [visible, scaleAnim, opacityAnim]);

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          style={[
            styles.container,
            { width: cardWidth, opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.card}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t.notificationPermission.closeA11y}
            >
              <X size={18} color={TEXT_MUTED} strokeWidth={2} />
            </TouchableOpacity>

            <LinearGradient
              colors={['rgba(124,58,237,0.22)', 'rgba(59,130,246,0.08)']}
              style={styles.iconWrap}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Bell size={28} color={TEXT_PRIMARY} strokeWidth={1.75} />
            </LinearGradient>

            <Text style={[styles.title, { textAlign }]}>{t.notificationPermission.title}</Text>
            <Text style={[styles.description, { textAlign }]}>
              {t.notificationPermission.description}
            </Text>

            <View style={styles.features}>
              {features.map(({ id, Icon, label }) => (
                <View key={id} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Icon size={16} color={PURPLE_PRIMARY} strokeWidth={2} />
                  </View>
                  <Text style={[styles.featureText, { textAlign }]}>{label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.9} style={styles.primaryButton}>
              <LinearGradient
                colors={[PURPLE_PRIMARY, '#5b21b6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.primaryButtonText}>{t.notificationPermission.turnOn}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{t.notificationPermission.maybeLater}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20,
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    backgroundColor: 'rgba(12,8,20,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.22)',
    borderRadius: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 16,
  },
  features: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  featureText: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
});
