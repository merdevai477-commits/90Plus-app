/**
 * Soft / force app update prompt — opens the store listing.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  BackHandler,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Download } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';

type Props = {
  visible: boolean;
  force: boolean;
  title: string;
  message: string;
  updateLabel: string;
  laterLabel: string;
  onUpdate: () => void;
  onLater: () => void;
};

export function AppUpdateModal({
  visible,
  force,
  title,
  message,
  updateLabel,
  laterLabel,
  onUpdate,
  onLater,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 110,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  useEffect(() => {
    if (!visible || !force) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible, force]);

  const handleUpdate = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdate();
  };

  const handleLater = () => {
    if (force) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLater();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 80}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        {!force ? <Pressable style={StyleSheet.absoluteFill} onPress={handleLater} /> : null}

        <Animated.View
          style={[
            styles.cardWrap,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(34,197,94,0.16)', 'rgba(0,0,0,0.55)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={styles.iconBadge}>
              <Download size={28} color="#22c55e" strokeWidth={1.8} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <Pressable
              onPress={handleUpdate}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={['#22c55e', '#16a34a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.primaryBtnText}>{updateLabel}</Text>
            </Pressable>

            {!force ? (
              <Pressable
                onPress={handleLater}
                accessibilityRole="button"
                style={({ pressed }) => [styles.laterBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.laterText}>{laterLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  cardWrap: {
    width: '88%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 18,
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(10,16,12,0.97)',
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  laterBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  laterText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
