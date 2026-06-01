/**
 * LevelUpModal — full-screen Modal with liquid-glass card.
 * Shows once per level; user must tap the button to dismiss.
 * Backfills missed celebrations for existing users via syncNextPendingCelebration.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronUp, Sparkles, Star } from 'lucide-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

import {
  drainLevelUpQueue,
  enqueueLevelUpEvent,
  subscribeLevelUp,
  useXp,
} from '../../contexts/XpContext';
import { useTranslation } from '../../src/i18n';
import { acknowledgeLevelUpCelebration } from '../../utils/levelUpCelebration.storage';
import { syncNextPendingCelebration } from '../../utils/levelUpCelebration.sync';
import { presentPendingLevelUpCelebration, setLevelUpModalVisible } from '../../utils/presentPendingLevelUpCelebration';

interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

const ACCENT = '#A855F7';
const ACCENT_DEEP = '#7C3AED';
const GOLD = '#F5C518';
const CONFETTI_COUNT = 16;
const CONFETTI_COLORS = [GOLD, ACCENT, '#fff', '#F472B6', '#34D399', '#60A5FA'];

function ConfettiBurst({ active }: { active: boolean }): React.ReactElement | null {
  const particles = React.useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        angle: (360 / CONFETTI_COUNT) * i + (i % 3) * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dist: 72 + (i % 6) * 16,
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
    progress.value = withDelay(
      Math.random() * 120,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress]);

  const style = useAnimatedStyle(() => {
    const rad = (angle * Math.PI) / 180;
    return {
      opacity: (1 - progress.value) * 0.95,
      transform: [
        { translateX: Math.cos(rad) * dist * progress.value },
        { translateY: Math.sin(rad) * dist * progress.value + progress.value * 24 },
        { scale: 1 - progress.value * 0.35 },
        { rotateZ: `${progress.value * 220}deg` },
      ],
    } as ViewStyle;
  });

  return <Animated.View style={[styles.confettiDot, { backgroundColor: color }, style]} />;
}

function SparkleRing(): React.ReactElement {
  const rot = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse, rot]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rot.value}deg` }, { scale: pulse.value }],
  }) as ViewStyle);

  return (
    <Animated.View pointerEvents="none" style={[styles.sparkleRing, style]}>
      <View style={[styles.sparkleDot, styles.sparkleDot0]}>
        <Sparkles size={13} color={GOLD} fill={GOLD} />
      </View>
      <View style={[styles.sparkleDot, styles.sparkleDot1]}>
        <Sparkles size={10} color={ACCENT} fill={ACCENT} />
      </View>
      <View style={[styles.sparkleDot, styles.sparkleDot2]}>
        <Star size={12} color={GOLD} fill={GOLD} />
      </View>
      <View style={[styles.sparkleDot, styles.sparkleDot3]}>
        <Sparkles size={9} color="#fff" fill="#fff" />
      </View>
    </Animated.View>
  );
}

export const LevelUpModal: React.FC = () => {
  const [event, setEvent] = useState<LevelUpEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const { userId } = useAuth();
  const { level } = useXp();
  const levelRef = useRef(level);
  const { t } = useTranslation();

  const cardScale = useSharedValue(0.72);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(36);
  const backdropOpacity = useSharedValue(0);
  const arrow = useSharedValue(0);
  const newLevelScale = useSharedValue(0.5);
  const prevLevelScale = useSharedValue(1);
  const glowFlash = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const [showConfetti, setShowConfetti] = useState(false);

  levelRef.current = level;
  visibleRef.current = visible;

  const show = useCallback(
    (ev: LevelUpEvent) => {
      setLevelUpModalVisible(true);
      setEvent(ev);
      setVisible(true);
      setShowConfetti(true);

      cardScale.value = 0.72;
      cardOpacity.value = 0;
      cardTranslateY.value = 36;
      backdropOpacity.value = 0;
      arrow.value = 0;
      newLevelScale.value = 0.5;
      prevLevelScale.value = 1;
      glowFlash.value = 0;
      shimmer.value = 0;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        if (Platform.OS === 'android') Vibration.vibrate([0, 60, 40, 80]);
      });

      backdropOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      glowFlash.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600 }),
      );
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );

      cardOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
      cardTranslateY.value = withSpring(0, { damping: 16, stiffness: 140, mass: 0.9 });
      cardScale.value = withSpring(1, { damping: 14, stiffness: 120, mass: 0.85 });

      prevLevelScale.value = withSequence(
        withTiming(0.82, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.68, { duration: 260 }),
      );
      arrow.value = withDelay(
        180,
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.4)) }),
          withTiming(0.92, { duration: 180 }),
          withTiming(1, { duration: 240 }),
        ),
      );
      newLevelScale.value = withDelay(
        260,
        withSequence(
          withSpring(1.22, { damping: 7, stiffness: 180 }),
          withSpring(1, { damping: 10, stiffness: 200 }),
        ),
      );

      setTimeout(() => setShowConfetti(false), 1400);
    },
    [arrow, backdropOpacity, cardOpacity, cardScale, cardTranslateY, glowFlash, newLevelScale, prevLevelScale, shimmer],
  );

  const finishDismiss = useCallback(
    async (current: LevelUpEvent | null) => {
      setLevelUpModalVisible(false);
      setVisible(false);
      setEvent(null);

      if (current && userId) {
        await acknowledgeLevelUpCelebration(userId, current.newLevel);
        await syncNextPendingCelebration(userId, levelRef.current);
        await presentPendingLevelUpCelebration(userId);
      }

      const next = drainLevelUpQueue();
      if (next) {
        setTimeout(() => show(next), 300);
      }
    },
    [show, userId],
  );

  const dismiss = useCallback(() => {
    const current = event;
    setShowConfetti(false);

    cardOpacity.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) });
    cardTranslateY.value = withTiming(24, { duration: 260, easing: Easing.in(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
      if (finished) runOnJS(finishDismiss)(current);
    });
    cardScale.value = withTiming(0.88, { duration: 260, easing: Easing.in(Easing.cubic) });
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY, event, finishDismiss]);

  useEffect(() => {
    const unsub = subscribeLevelUp((ev) => {
      if (visibleRef.current) {
        enqueueLevelUpEvent(ev);
        return;
      }
      show(ev);
    });

    const queued = drainLevelUpQueue();
    if (queued && !visibleRef.current) show(queued);

    return unsub;
  }, [show]);

  const animatedCardWrap = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardTranslateY.value },
      { scale: cardScale.value },
    ],
  }) as ViewStyle);
  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }) as ViewStyle);
  const animatedArrow = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + arrow.value * -10 }],
    opacity: arrow.value,
  }) as ViewStyle);
  const animatedNewLevel = useAnimatedStyle(() => ({
    transform: [{ scale: newLevelScale.value }],
  }) as ViewStyle);
  const animatedPrevLevel = useAnimatedStyle(() => ({
    transform: [{ scale: prevLevelScale.value }],
    opacity: 0.4 + prevLevelScale.value * 0.35,
  }) as ViewStyle);
  const animatedGlow = useAnimatedStyle(() => ({
    opacity: glowFlash.value * 0.5,
  }) as ViewStyle);
  const animatedShimmer = useAnimatedStyle(() => ({
    opacity: 0.08 + shimmer.value * 0.14,
  }) as ViewStyle);

  const headline: string = (t as any)?.xp?.levelUpModal?.headline ?? 'LEVEL UP';
  const claimText: string = (t as any)?.xp?.levelUpModal?.claim ?? 'Got it!';
  const tapHint: string = (t as any)?.xp?.levelUpModal?.tapHint ?? 'Tap to continue';
  const youAreNowTpl: string =
    (t as any)?.xp?.levelUpModal?.youAreNow ?? "You're now Level {{level}}";
  const youAreNow = event
    ? youAreNowTpl.replace('{{level}}', String(event.newLevel))
    : '';

  return (
    <Modal
      visible={visible && !!event}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, animatedBackdrop]}>
          <BlurView intensity={Platform.OS === 'ios' ? 40 : 90} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdropDim} />
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.glowFlash, animatedGlow]}>
          <LinearGradient
            colors={['rgba(168,85,247,0.55)', 'rgba(124,58,237,0.0)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.cardShell, animatedCardWrap]}>
          {isLiquidGlassSupported ? (
            <LiquidGlassView
              effect="clear"
              interactive
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ style: styles.glassCard, tint: 'rgba(12, 6, 28, 0.55)' } as any)}
            >
              <LevelUpCardBody
                event={event}
                headline={headline}
                youAreNow={youAreNow}
                claimText={claimText}
                tapHint={tapHint}
                showConfetti={showConfetti}
                animatedShimmer={animatedShimmer}
                animatedPrevLevel={animatedPrevLevel}
                animatedNewLevel={animatedNewLevel}
                animatedArrow={animatedArrow}
                onDismiss={dismiss}
              />
            </LiquidGlassView>
          ) : (
            <BlurView intensity={55} tint="dark" style={styles.glassCard}>
              <LevelUpCardBody
                event={event}
                headline={headline}
                youAreNow={youAreNow}
                claimText={claimText}
                tapHint={tapHint}
                showConfetti={showConfetti}
                animatedShimmer={animatedShimmer}
                animatedPrevLevel={animatedPrevLevel}
                animatedNewLevel={animatedNewLevel}
                animatedArrow={animatedArrow}
                onDismiss={dismiss}
              />
            </BlurView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

function LevelUpCardBody({
  event,
  headline,
  youAreNow,
  claimText,
  tapHint,
  showConfetti,
  animatedShimmer,
  animatedPrevLevel,
  animatedNewLevel,
  animatedArrow,
  onDismiss,
}: {
  event: LevelUpEvent | null;
  headline: string;
  youAreNow: string;
  claimText: string;
  tapHint: string;
  showConfetti: boolean;
  animatedShimmer: AnimatedStyle<ViewStyle>;
  animatedPrevLevel: AnimatedStyle<ViewStyle>;
  animatedNewLevel: AnimatedStyle<ViewStyle>;
  animatedArrow: AnimatedStyle<ViewStyle>;
  onDismiss: () => void;
}): React.ReactElement {
  return (
    <>
            <Animated.View pointerEvents="none" style={[styles.shimmer, animatedShimmer]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.22)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <View style={styles.glowOrb} />
            <ConfettiBurst active={showConfetti} />
            <SparkleRing />

            <Text style={styles.headline}>{headline}</Text>

            <View style={styles.levelTransition}>
              <Animated.View style={[styles.levelChip, styles.levelChipPrev, animatedPrevLevel]}>
                <Text style={styles.levelChipPrevTxt}>{event?.previousLevel}</Text>
              </Animated.View>

              <Animated.View style={animatedArrow}>
                <View style={styles.arrowRing}>
                  <ChevronUp size={20} color={GOLD} strokeWidth={3} />
                </View>
              </Animated.View>

              <Animated.View style={[styles.levelChip, styles.levelChipNew, animatedNewLevel]}>
                <Text style={styles.levelChipNewTxt}>{event?.newLevel}</Text>
              </Animated.View>
            </View>

            <Text style={styles.titleText}>{event?.newTitle}</Text>
            <Text style={styles.subText}>{youAreNow}</Text>
            <Text style={styles.tapHint}>{tapHint}</Text>

            <Pressable
              style={({ pressed }) => [styles.claimButton, pressed && styles.claimButtonPressed]}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={claimText}
            >
              {isLiquidGlassSupported ? (
                <LiquidGlassView
                  effect="clear"
                  interactive
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...({ style: styles.claimGlass, tint: 'rgba(168,85,247,0.35)' } as any)}
                >
                  <Text style={styles.claimText}>{claimText}</Text>
                </LiquidGlassView>
              ) : (
                <View style={styles.claimFallback}>
                  <Text style={styles.claimText}>{claimText}</Text>
                </View>
              )}
            </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  glowFlash: {
    ...StyleSheet.absoluteFillObject,
  },
  cardShell: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.45)',
    shadowColor: ACCENT_DEEP,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 24,
  },
  glassCard: {
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(8, 4, 20, 0.35)' : 'rgba(16, 8, 32, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ skewX: '-18deg' }],
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: ACCENT,
    opacity: 0.12,
  },
  confettiRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiDot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  sparkleRing: {
    position: 'absolute',
    top: 12,
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleDot: { position: 'absolute' },
  sparkleDot0: { top: 0, start: 78 },
  sparkleDot1: { top: 64, end: 0 },
  sparkleDot2: { bottom: 28, start: 4 },
  sparkleDot3: { bottom: 0, end: 56 },
  headline: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(168,85,247,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  levelTransition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  levelChip: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  levelChipPrev: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  levelChipPrevTxt: {
    fontSize: 30,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
  },
  arrowRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,197,24,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipNew: {
    backgroundColor: 'rgba(168,85,247,0.25)',
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 8,
  },
  levelChipNewTxt: { fontSize: 34, fontWeight: '900', color: '#fff' },
  titleText: {
    fontSize: 19,
    fontWeight: '800',
    color: GOLD,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: -2,
    marginBottom: 4,
  },
  claimButton: {
    marginTop: 8,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  claimButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  claimGlass: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.55)',
  },
  claimFallback: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  claimText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});

export default LevelUpModal;
