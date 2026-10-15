/**
 * In-app rating prompt: 1–5 stars, submit, or later.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  submitLabel: string;
  laterLabel: string;
  onSubmit: (stars: number) => void;
  onLater: () => void;
};

export function AppRatingModal({
  visible,
  title,
  subtitle,
  submitLabel,
  laterLabel,
  onSubmit,
  onLater,
}: Props) {
  const [stars, setStars] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStars(0);
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

  const pickStar = (n: number) => {
    setStars(n);
    void Haptics.selectionAsync();
  };

  const handleSubmit = () => {
    if (stars < 1) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(stars);
  };

  const handleLater = () => {
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
        <Pressable style={StyleSheet.absoluteFill} onPress={handleLater} />

        <Animated.View
          style={[
            styles.cardWrap,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(245,197,24,0.18)', 'rgba(0,0,0,0.55)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={styles.iconBadge}>
              <Star size={28} color={Colors.gold} fill={Colors.gold} strokeWidth={1.5} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= stars;
                return (
                  <Pressable
                    key={n}
                    onPress={() => pickStar(n)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} stars`}
                    style={({ pressed }) => [styles.starBtn, pressed && { opacity: 0.85 }]}
                  >
                    <Star
                      size={34}
                      color={filled ? Colors.gold : 'rgba(255,255,255,0.28)'}
                      fill={filled ? Colors.gold : 'transparent'}
                      strokeWidth={1.6}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={stars < 1}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryBtn,
                stars < 1 && styles.primaryBtnDisabled,
                pressed && stars >= 1 && { opacity: 0.92 },
              ]}
            >
              <LinearGradient
                colors={
                  stars >= 1
                    ? [Colors.gold, Colors.goldDark]
                    : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.08)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text
                style={[
                  styles.primaryBtnText,
                  stars < 1 && styles.primaryBtnTextDisabled,
                ]}
              >
                {submitLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleLater}
              accessibilityRole="button"
              style={({ pressed }) => [styles.laterBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.laterText}>{laterLabel}</Text>
            </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.82)',
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
    borderColor: 'rgba(245,197,24,0.35)',
    backgroundColor: 'rgba(18,14,10,0.97)',
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
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.35)',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 22,
  },
  starBtn: {
    padding: 4,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#1a1408',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryBtnTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
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
