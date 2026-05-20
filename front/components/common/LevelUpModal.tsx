/**
 * LevelUpModal
 *
 * Globally-mounted celebratory pop-up that fires whenever the user crosses
 * a level boundary. Subscribes to the XpContext level-up channel; events
 * can be triggered either by:
 *   - `XpContext.handleXpEvents()` (immediate, optimistic — when a mutation
 *     responds with XP events)
 *   - `XpContext.fetchXpData()` (passive — when polling notices the level
 *     went up server-side without the client having fired anything)
 *
 * Ships with a spring-in card, animated previous-→ new-level transition,
 * floating sparkle ring, and haptic feedback. Auto-dismisses after 4s and
 * processes a queue so a burst of awards doesn't drop events.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Sparkles, Star, ChevronUp } from 'lucide-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { drainLevelUpQueue, subscribeLevelUp } from '../../contexts/XpContext';
import { useTranslation } from '../../src/i18n';

interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

const ACCENT = '#A855F7';
const ACCENT_DEEP = '#7C3AED';
const GOLD = '#F5C518';

const AUTO_DISMISS_MS = 4000;

// ───────────────────────────── Sparkle ring ────────────────────────────────
function SparkleRing(): React.ReactElement {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rot]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkleRing, style]}>
      <View style={[styles.sparkleDot, styles.sparkleDot0]}>
        <Sparkles size={12} color={GOLD} fill={GOLD} />
      </View>
      <View style={[styles.sparkleDot, styles.sparkleDot1]}>
        <Sparkles size={10} color={ACCENT} fill={ACCENT} />
      </View>
      <View style={[styles.sparkleDot, styles.sparkleDot2]}>
        <Star size={11} color={GOLD} fill={GOLD} />
      </View>
      <View style={[styles.sparkleDot, styles.sparkleDot3]}>
        <Sparkles size={9} color={ACCENT} fill={ACCENT} />
      </View>
    </Animated.View>
  );
}

// ───────────────────────────── LevelUpModal ─────────────────────────────────
export const LevelUpModal: React.FC = () => {
  const [event, setEvent] = useState<LevelUpEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  const cardScale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const arrow = useSharedValue(0);
  const newLevelScale = useSharedValue(0.6);

  const show = useCallback(
    (ev: LevelUpEvent) => {
      setEvent(ev);
      setVisible(true);
      cardScale.value = 0;
      opacity.value = 0;
      arrow.value = 0;
      newLevelScale.value = 0.6;

      // Haptics — graceful on iOS, vibration fallback on Android.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {
          if (Platform.OS === 'android') {
            Vibration.vibrate([0, 80, 50, 80]);
          }
        },
      );

      cardScale.value = withSpring(1, { damping: 12, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 250 });
      // Ramp arrow up while the new-level pops in.
      arrow.value = withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(0.85, { duration: 220 }),
        withTiming(1, { duration: 220 }),
      );
      newLevelScale.value = withSequence(
        withTiming(1.2, { duration: 380, easing: Easing.out(Easing.back(1.6)) }),
        withSpring(1, { damping: 10, stiffness: 180 }),
      );
    },
    [arrow, cardScale, newLevelScale, opacity],
  );

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 220 }, finished => {
      if (finished) {
        runOnJS(setVisible)(false);
        runOnJS(setEvent)(null);
        const next = drainLevelUpQueue();
        if (next) {
          // Small pause before showing the next queued event.
          setTimeout(() => runOnJS(show)(next), 250);
        }
      }
    });
    cardScale.value = withTiming(0.85, { duration: 220 });
  }, [cardScale, opacity, show]);

  useEffect(() => {
    const unsub = subscribeLevelUp(ev => {
      // If the modal is already showing, don't overwrite it — the queue in
      // XpContext.drainLevelUpQueue handles delivery once dismissed.
      if (visible) return;
      show(ev);
    });
    // Drain anything that was emitted before this listener mounted.
    const queued = drainLevelUpQueue();
    if (queued) show(queued);
    return unsub;
  }, [show, visible]);

  // Auto-dismiss
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: opacity.value,
  }));
  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  const animatedArrow = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 + arrow.value * -8 }],
    opacity: arrow.value,
  }));
  const animatedNewLevel = useAnimatedStyle(() => ({
    transform: [{ scale: newLevelScale.value }],
  }));

  if (!visible || !event) return null;

  const titleText: string =
    (t as any)?.xp?.levelUpModal?.headline ?? 'LEVEL UP';
  const claimText: string = (t as any)?.xp?.levelUpModal?.claim ?? 'Claim';
  const youAreNowTpl: string =
    (t as any)?.xp?.levelUpModal?.youAreNow ?? "You're now Level {{level}}";
  const youAreNow = youAreNowTpl.replace('{{level}}', String(event.newLevel));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[styles.backdrop, animatedBackdrop]}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </Animated.View>
      </Pressable>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, animatedCard]}>
          <SparkleRing />

          <LinearGradient
            colors={['rgba(168,85,247,0.20)', 'rgba(124,58,237,0.0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <Text style={styles.headline}>✨ {titleText} ✨</Text>

          {/* prev → new transition */}
          <View style={styles.levelTransition}>
            <View style={[styles.levelChip, styles.levelChipPrev]}>
              <Text style={styles.levelChipPrevTxt}>{event.previousLevel}</Text>
            </View>

            <Animated.View style={animatedArrow}>
              <View style={styles.arrowRing}>
                <ChevronUp size={20} color={GOLD} strokeWidth={3} />
              </View>
            </Animated.View>

            <Animated.View
              style={[styles.levelChip, styles.levelChipNew, animatedNewLevel]}
            >
              <Text style={styles.levelChipNewTxt}>{event.newLevel}</Text>
            </Animated.View>
          </View>

          <Text style={styles.titleText}>{event.newTitle}</Text>
          <Text style={styles.subText}>{youAreNow}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.claimButton,
              pressed && { opacity: 0.85 },
            ]}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel={claimText}
          >
            <Text style={styles.claimText}>{claimText}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 320,
    backgroundColor: 'rgba(20, 8, 40, 0.96)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.5)',
    paddingVertical: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    shadowColor: ACCENT_DEEP,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 20,
  },
  sparkleRing: {
    position: 'absolute',
    top: 18,
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleDot: { position: 'absolute' },
  sparkleDot0: { top: 0, start: 70 },
  sparkleDot1: { top: 60, end: 0 },
  sparkleDot2: { bottom: 30, start: 0 },
  sparkleDot3: { bottom: 0, end: 50 },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1,
  },
  levelTransition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  levelChip: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  levelChipPrev: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  levelChipPrevTxt: {
    fontSize: 28,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.6)',
  },
  arrowRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,197,24,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipNew: {
    backgroundColor: 'rgba(168,85,247,0.22)',
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 6,
  },
  levelChipNewTxt: { fontSize: 32, fontWeight: '900', color: '#fff' },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: GOLD,
    textAlign: 'center',
  },
  subText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 4,
  },
  claimButton: {
    marginTop: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  claimText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
});

export default LevelUpModal;
