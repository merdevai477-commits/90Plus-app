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
 * floating sparkle ring, and haptic feedback. Shown when the user opens
 * Profile or Rank; dismissed only via the primary button (once per level).
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

import { useAuth } from '@clerk/clerk-expo';

import { drainLevelUpQueue, subscribeLevelUp } from '../../contexts/XpContext';
import { useTranslation } from '../../src/i18n';
import { acknowledgeLevelUpCelebration } from '../../utils/levelUpCelebration.storage';

interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

const ACCENT = '#A855F7';
const ACCENT_DEEP = '#7C3AED';
const GOLD = '#F5C518';

const CONFETTI_COUNT = 14;

const CONFETTI_COLORS = [GOLD, ACCENT, '#fff', '#F472B6', '#34D399'];

function ConfettiBurst({ active }: { active: boolean }): React.ReactElement | null {
  const particles = React.useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        angle: (360 / CONFETTI_COUNT) * i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dist: 60 + (i % 5) * 18,
      })),
    [],
  );

  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.confettiRoot}>
      {particles.map((p) => (
        <ConfettiParticle key={p.id} angle={p.angle} color={p.color} dist={p.dist} />
      ))}
    </View>
  );
}

function ConfettiParticle({
  angle,
  color,
  dist,
}: {
  angle: number;
  color: string;
  dist: number;
}): React.ReactElement {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const style = useAnimatedStyle(() => {
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * dist * progress.value;
    const dy = Math.sin(rad) * dist * progress.value;
    return {
      opacity: 1 - progress.value,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale: 1 - progress.value * 0.4 },
        { rotate: `${progress.value * 180}deg` },
      ],
    };
  });

  return <Animated.View style={[styles.confettiDot, { backgroundColor: color }, style]} />;
}

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
  const { userId } = useAuth();
  const { t } = useTranslation();

  const cardScale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const arrow = useSharedValue(0);
  const newLevelScale = useSharedValue(0.6);
  const prevLevelScale = useSharedValue(1);
  const glowFlash = useSharedValue(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const show = useCallback(
    (ev: LevelUpEvent) => {
      setEvent(ev);
      setVisible(true);
      setShowConfetti(true);
      cardScale.value = 0;
      opacity.value = 0;
      arrow.value = 0;
      newLevelScale.value = 0.6;
      prevLevelScale.value = 1;
      glowFlash.value = 0.85;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {
            if (Platform.OS === 'android') {
              Vibration.vibrate([0, 80, 50, 80]);
            }
          },
        );
      });

      glowFlash.value = withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 420 }),
      );

      cardScale.value = withSpring(1, { damping: 11, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 280 });
      prevLevelScale.value = withSequence(
        withTiming(0.75, { duration: 320, easing: Easing.in(Easing.cubic) }),
        withTiming(0.6, { duration: 200 }),
      );
      arrow.value = withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(0.85, { duration: 220 }),
        withTiming(1, { duration: 220 }),
      );
      newLevelScale.value = withSequence(
        withTiming(1.28, { duration: 420, easing: Easing.out(Easing.back(1.8)) }),
        withSpring(1, { damping: 8, stiffness: 200 }),
        withTiming(1.08, { duration: 120 }),
        withSpring(1, { damping: 12, stiffness: 220 }),
      );

      setTimeout(() => setShowConfetti(false), 1000);
    },
    [arrow, cardScale, glowFlash, newLevelScale, opacity, prevLevelScale],
  );

  const dismiss = useCallback(() => {
    const current = event;
    setShowConfetti(false);
    opacity.value = withTiming(0, { duration: 220 }, finished => {
      if (finished) {
        runOnJS(setVisible)(false);
        runOnJS(setEvent)(null);
        if (current && userId) {
          void acknowledgeLevelUpCelebration(userId, current.newLevel);
        }
        const next = drainLevelUpQueue();
        if (next) {
          setTimeout(() => runOnJS(show)(next), 250);
        }
      }
    });
    cardScale.value = withTiming(0.85, { duration: 220 });
  }, [cardScale, event, opacity, show, userId]);

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
  const animatedPrevLevel = useAnimatedStyle(() => ({
    transform: [{ scale: prevLevelScale.value }],
    opacity: 0.35 + prevLevelScale.value * 0.35,
  }));
  const animatedGlow = useAnimatedStyle(() => ({
    opacity: glowFlash.value * 0.55,
  }));

  if (!visible || !event) return null;

  const titleText: string =
    (t as any)?.xp?.levelUpModal?.headline ?? 'LEVEL UP';
  const claimText: string = (t as any)?.xp?.levelUpModal?.claim ?? 'Awesome!';
  const youAreNowTpl: string =
    (t as any)?.xp?.levelUpModal?.youAreNow ?? "You're now Level {{level}}";
  const youAreNow = youAreNowTpl.replace('{{level}}', String(event.newLevel));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.glowFlash, animatedGlow]}>
        <LinearGradient
          colors={['rgba(168,85,247,0.45)', 'rgba(124,58,237,0.0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.backdrop, animatedBackdrop]}>
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, animatedCard]}>
          <ConfettiBurst active={showConfetti} />
          <SparkleRing />

          <LinearGradient
            colors={['rgba(168,85,247,0.20)', 'rgba(124,58,237,0.0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <Text style={styles.headline}>{titleText}</Text>

          {/* prev → new transition */}
          <View style={styles.levelTransition}>
            <Animated.View style={[styles.levelChip, styles.levelChipPrev, animatedPrevLevel]}>
              <Text style={styles.levelChipPrevTxt}>{event.previousLevel}</Text>
            </Animated.View>

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
  glowFlash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  confettiRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
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
    marginTop: 10,
    minWidth: 200,
    backgroundColor: ACCENT,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  claimText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});

export default LevelUpModal;
