/**
 * CooldownBlockModal
 *
 * UX Fix 3: Shown BEFORE opening any upload picker when a cooldown is active.
 * Displays remaining time with a live countdown.
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCooldownTimer, CooldownInfo } from '../../hooks/useCooldownTimer';

interface Props {
  visible: boolean;
  cooldown: CooldownInfo | null;
  type: 'avatar' | 'cover' | 'reel';
  onClose: () => void;
}

const TYPE_LABELS: Record<Props['type'], string> = {
  avatar: 'تغيير صورة البروفايل',
  cover: 'تغيير صورة الغلاف',
  reel: 'رفع فيديو جديد',
};

export const CooldownBlockModal: React.FC<Props> = ({ visible, cooldown, type, onClose }) => {
  const { remainingText } = useCooldownTimer(cooldown);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['rgba(255,165,0,0.15)', 'rgba(255,69,0,0.1)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.iconRow}>
            <Ionicons name="time-outline" size={48} color="#FFD700" />
          </View>

          <Text style={styles.title}>لا يمكنك {TYPE_LABELS[type]} الآن</Text>

          {remainingText ? (
            <Text style={styles.subtitle}>
              متاح بعد{'\n'}
              <Text style={styles.countdown}>{remainingText}</Text>
            </Text>
          ) : (
            <Text style={styles.subtitle}>يرجى الانتظار قبل المحاولة مجدداً</Text>
          )}

          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.btnText}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,165,0,0.3)',
    overflow: 'hidden',
  },
  iconRow: { marginBottom: 16 },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  countdown: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
