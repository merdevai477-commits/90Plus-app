import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { subscribeLevelUp, drainLevelUpQueue } from '../../contexts/XpContext';
import { useTranslation } from '../../src/i18n';

interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

export const LevelUpModal: React.FC = () => {
  const [event, setEvent] = useState<LevelUpEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const show = useCallback((ev: LevelUpEvent) => {
    setEvent(ev);
    setVisible(true);
    scale.value = 0;
    opacity.value = 0;

    // Haptics
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 80, 50, 80]);
      }
    });

    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 300 });
  }, [scale, opacity]);

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setVisible)(false);
        runOnJS(setEvent)(null);
        // Check queue for next event
        const next = drainLevelUpQueue();
        if (next) {
          setTimeout(() => runOnJS(show)(next), 300);
        }
      }
    });
    scale.value = withTiming(0.8, { duration: 200 });
  }, [opacity, scale, show]);

  useEffect(() => {
    const unsub = subscribeLevelUp((ev) => {
      if (visible) {
        // Queue it — will be shown after current dismisses
        return;
      }
      show(ev);
    });

    // Drain any queued events
    const queued = drainLevelUpQueue();
    if (queued) show(queued);

    return unsub;
  }, [show, visible]);

  // Auto-dismiss after 5s
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible || !event) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[styles.backdrop, animatedBackdrop]}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </Animated.View>
      </Pressable>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, animatedCard]}>
          <Text style={styles.headline}>✨ {t?.xp?.levelUpModal?.headline || 'LEVEL UP'} ✨</Text>

          <View style={styles.levelRow}>
            <Text style={styles.levelNumber}>{event.newLevel}</Text>
          </View>

          <Text style={styles.titleText}>{event.newTitle}</Text>

          <Pressable style={styles.claimButton} onPress={dismiss}>
            <Text style={styles.claimText}>{t?.xp?.levelUpModal?.claim || 'Claim'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 320,
    backgroundColor: 'rgba(30, 10, 60, 0.95)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#A855F7',
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#A855F7',
    textAlign: 'center',
  },
  levelRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D8B4FE',
    textAlign: 'center',
  },
  claimButton: {
    marginTop: 8,
    backgroundColor: '#A855F7',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
  },
  claimText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
