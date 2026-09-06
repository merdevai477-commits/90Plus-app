/**
 * Lucky wheel card — Figma node 135:76.
 *
 * The wheel is the app's existing daily-spin feature (`/api/daily-spin`), not a
 * second one: the server picks the prize, enforces the 24h cooldown and awards
 * the coins. This component's job is to make the wheel *land on that result*.
 *
 * ── SPIN PHYSICS ─────────────────────────────────────────────────────────────
 * A real wheel doesn't lerp to its answer, so neither does this one:
 *
 *   1. WIND-UP   — a short counter-rotation, the way you pull a wheel back
 *                  before letting go.
 *   2. LAUNCH    — accelerates out of the wind-up (ease-in) into free spin.
 *   3. FREE SPIN — constant fast rotation while the network call is in flight,
 *                  so the wait is part of the spin rather than a freeze.
 *   4. SETTLE    — one long ease-out across several turns onto the winning
 *                  segment, decelerating the whole way.
 *   5. RECOIL    — a small overshoot-and-return, the mechanical bounce as the
 *                  pointer drops into the final peg.
 *
 * The landing angle is randomised *within* the winning segment, so the same
 * prize never stops at exactly the same spot.
 *
 * Everything runs on Reanimated's UI thread — no per-frame JS — so it stays at
 * 60fps on low-end Android.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useDailySpin, type SpinOutcome } from '../../../hooks/useDailySpin';
import { toastManager } from '../../../services/toastManager';
import { useTranslation } from '../../../src/i18n';
import { SW_ASSET } from '../assets';
import {
  SW_GRADIENT,
  WHEEL_DOTS,
  WHEEL_GEOMETRY,
  WHEEL_PRIZES,
  useShareWinStyles,
} from '../styles';
import GradientText from './GradientText';

interface LuckyWheelCardProps {
  /** Fired once the wheel has settled, so the page can refresh its stats. */
  onSpinSettled?: (outcome: SpinOutcome) => void;
  /** True while a spin animation is in flight (wind-up through settle). */
  onBusyChange?: (busy: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

/** Silver→indigo gradient used by the two lit prize labels in Figma. */
const LIT_XP_GRADIENT = ['#DCD5EC', '#340C8E'] as const;

/** Half the difference between the dot asset and its layout box. */
const DOT_INSET = (WHEEL_GEOMETRY.dot.assetSize - WHEEL_GEOMETRY.dot.size) / 2;

const SEGMENT_COUNT = WHEEL_PRIZES.length; // 8, matching the server prize table
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

/* Timings (ms) — tuned so the whole spin reads as one motion, ~4.3s worst case. */
const WINDUP_MS = 260;
const LAUNCH_MS = 520;
const FREE_SPIN_TURN_MS = 620; // one full turn while waiting on the network
const SETTLE_MS = 2600;
const RECOIL_MS = 320;

/** Turns the settle sweeps through before stopping. */
const SETTLE_TURNS = 5;
/** Degrees the wheel overshoots and springs back at the very end. */
const RECOIL_DEG = 4;

const LuckyWheelCard = memo(function LuckyWheelCard({
  onSpinSettled,
  onBusyChange,
  style,
}: LuckyWheelCardProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  const { prizes, canSpin, isSpinning, spin, finishSpin } = useDailySpin();

  /** Absolute wheel rotation in degrees; only ever increases. */
  const rotation = useSharedValue(0);
  /** Pointer deflection — the peg being flicked by each passing segment. */
  const pointerTilt = useSharedValue(0);
  /** Hub press feedback. */
  const hubScale = useSharedValue(1);
  /** Prevents rapid taps from launching more than one wheel animation. */
  const spinGuardRef = useRef(false);

  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      cancelAnimation(rotation);
      cancelAnimation(pointerTilt);
      cancelAnimation(hubScale);
    },
    [hubScale, pointerTilt, rotation],
  );

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  /** The pointer pivots about its tip, not its centre — hence the offset. */
  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pointerTilt.value}deg` }],
  }));

  const hubStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hubScale.value }],
  }));

  const settleComplete = useCallback(
    (outcome: SpinOutcome) => {
      if (!mounted.current) return;
      spinGuardRef.current = false;
      onBusyChange?.(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      finishSpin();
      onSpinSettled?.(outcome);

      // The wheel stopping is not, on its own, a confirmation — say what was
      // won so the result reads as "this happened," not "did that do anything?"
      toastManager.showSuccess(
        copy.spinWonTitle.replace('{amount}', outcome.label),
        outcome.source === 'offline' ? copy.spinWonOfflineDetail : copy.spinWonDetail,
      );
    },
    [copy.spinWonDetail, copy.spinWonOfflineDetail, copy.spinWonTitle, finishSpin, onBusyChange, onSpinSettled],
  );

  /** Cancels a spin that never got a result to land on (offline/locked path
   * aside — this is only reached for a genuine early-out before launch). */
  const stopIdle = useCallback(() => {
    if (!mounted.current) return;
    spinGuardRef.current = false;
    onBusyChange?.(false);
    cancelAnimation(rotation);
    cancelAnimation(pointerTilt);
    pointerTilt.value = withTiming(0, { duration: 200 });
    finishSpin();
  }, [finishSpin, onBusyChange, pointerTilt, rotation]);

  /** A real 24h cooldown — stop gracefully and say exactly when to come back. */
  const stopForCooldown = useCallback(
    (timeRemaining: { hours: number; minutes: number }) => {
      stopIdle();
      toastManager.showInfo(
        copy.spinCooldownTitle,
        copy.spinCooldownDetail
          .replace('{hours}', String(timeRemaining.hours))
          .replace('{minutes}', String(timeRemaining.minutes)),
      );
    },
    [copy.spinCooldownDetail, copy.spinCooldownTitle, stopIdle],
  );

  const handleSpin = useCallback(async () => {
    if (spinGuardRef.current || isSpinning || !canSpin) return;
    spinGuardRef.current = true;
    onBusyChange?.(true);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    hubScale.value = withSequence(
      withTiming(0.92, { duration: 90 }),
      withTiming(1, { duration: 140 }),
    );

    // 1 + 2 + 3 — wind up, launch, then free-spin until the server answers.
    rotation.value = withSequence(
      withTiming(rotation.value - 14, { duration: WINDUP_MS, easing: Easing.out(Easing.quad) }),
      withTiming(rotation.value + 340, { duration: LAUNCH_MS, easing: Easing.in(Easing.quad) }),
    );
    rotation.value = withDelay(
      WINDUP_MS + LAUNCH_MS,
      withRepeat(
        withTiming(rotation.value + 340 + 360, {
          duration: FREE_SPIN_TURN_MS,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );

    // The pointer keeps getting knocked back by segments flying past.
    pointerTilt.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: FREE_SPIN_TURN_MS / SEGMENT_COUNT / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: FREE_SPIN_TURN_MS / SEGMENT_COUNT / 2, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );

    const attempt = await spin();

    if (!mounted.current) return;
    if (attempt.status === 'locked') {
      spinGuardRef.current = false;
      onBusyChange?.(false);
      return;
    }
    if (attempt.status === 'cooldown') {
      stopForCooldown(attempt.timeRemaining);
      return;
    }
    if (attempt.status === 'error') {
      stopIdle();
      toastManager.showError('Spin failed', attempt.message || 'The reward could not be saved. Please try again.');
      return;
    }

    const outcome = attempt.outcome;

    // 4 + 5 — settle onto the winning segment, then recoil into the peg.
    cancelAnimation(rotation);

    const current = rotation.value;
    // Segment centre, measured clockwise from the pointer at 12 o'clock.
    const segmentCentre = outcome.prizeIndex * SEGMENT_ANGLE;
    // Land anywhere in the middle 70% of the wedge so it never looks snapped.
    const jitter = (Math.random() - 0.5) * SEGMENT_ANGLE * 0.7;
    const targetMod = (360 - ((segmentCentre + jitter) % 360)) % 360;

    const currentMod = ((current % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta < 0) delta += 360;
    const finalAngle = current + SETTLE_TURNS * 360 + delta;

    rotation.value = withSequence(
      // Long deceleration. A wheel under constant friction is quadratic, but
      // that stops too abruptly to read as heavy — a 4th-order ease-out keeps
      // the slow creep across the last few segments that sells the weight.
      withTiming(finalAngle + RECOIL_DEG, {
        duration: SETTLE_MS,
        easing: Easing.out(Easing.poly(4)),
      }),
      withTiming(finalAngle, { duration: RECOIL_MS, easing: Easing.elastic(1.1) }, (done) => {
        if (done) runOnJS(settleComplete)(outcome);
      }),
    );

    // Pointer ticks slow with the wheel, then rests.
    cancelAnimation(pointerTilt);
    pointerTilt.value = withSequence(
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
        ),
        6,
        false,
      ),
      withTiming(-4, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.elastic(1.4) }),
    );
  }, [
    canSpin,
    hubScale,
    isSpinning,
    onBusyChange,
    pointerTilt,
    rotation,
    settleComplete,
    spin,
    stopForCooldown,
    stopIdle,
  ]);

  /**
   * Figma fixes eight label slots; the values come from the server's prize
   * table so the segment the pointer lands on is the reward actually granted.
   */
  const labels = useMemo(
    () =>
      WHEEL_PRIZES.map((slot, index) => ({
        ...slot,
        value: prizes[index]?.label ?? slot.value,
      })),
    [prizes],
  );

  const spinDisabled = isSpinning || !canSpin;
  const spinLabel = isSpinning
    ? copy.wheelSpinningCta ?? copy.wheelCta
    : spinDisabled
      ? copy.wheelDisabledCta ?? copy.wheelCta
      : copy.wheelCta;

  return (
    <View style={[sw.card, sw.wheelCard, style]}>
      <View style={sw.wheelHeader}>
        <Text style={sw.cardTitle}>{copy.wheelTitle}</Text>
        <Text style={sw.cardSubtitle}>{copy.wheelSubtitle}</Text>
      </View>

      <View style={sw.wheelBox}>
        {/* Everything that physically rotates lives in this layer. */}
        <Animated.View style={[sw.wheelRotor, wheelStyle]}>
          <Image
            source={SW_ASSET.wheelRing}
            style={sw.wheelRing}
            contentFit="contain"
            transition={0}
          />

          <View style={sw.wheelSegmentLayer} pointerEvents="none">
            <Image
              source={SW_ASSET.wheelSegA}
              style={[sw.wheelSegment, { transform: [{ rotate: '22deg' }] }]}
              contentFit="contain"
              transition={0}
            />
          </View>
          <View style={sw.wheelSegmentLayer} pointerEvents="none">
            <Image
              source={SW_ASSET.wheelSegB}
              style={[sw.wheelSegment, { transform: [{ rotate: '22deg' }, { scaleY: -1 }] }]}
              contentFit="contain"
              transition={0}
            />
          </View>

          {labels.map((prize, index) => (
            <View
              key={`slot-${index}`}
              style={[sw.wheelPrizeLabel, { left: s(prize.left), top: s(prize.top) }]}
              pointerEvents="none"
            >
              <Text style={sw.wheelPrizeValue}>{prize.value}</Text>
              {prize.gradient ? (
                <GradientText colors={LIT_XP_GRADIENT} style={sw.wheelPrizeValue}>
                  XP
                </GradientText>
              ) : (
                <Text style={sw.wheelPrizeXp}>XP</Text>
              )}
            </View>
          ))}

          {WHEEL_DOTS.map((dot, index) => (
            <Image
              key={`dot-${index}`}
              source={SW_ASSET.wheelDot}
              style={[sw.wheelDot, { left: s(dot.left - DOT_INSET), top: s(dot.top - DOT_INSET) }]}
              contentFit="contain"
              transition={0}
            />
          ))}
        </Animated.View>

        {/* Pointer is outside the rotor — it only flicks, it doesn't spin. */}
        <Animated.View style={[sw.wheelPointer, pointerStyle]} pointerEvents="none">
          <Image
            source={SW_ASSET.wheelPointer}
            style={sw.wheelPointerImage}
            contentFit="contain"
            transition={0}
          />
        </Animated.View>

        {/* Centre hub — bezel + gradient face. Also stationary. */}
        <View
          style={[sw.wheelHubOuter, spinDisabled && sw.wheelHubOuterDisabled]}
          pointerEvents="none"
        />
        <Animated.View
          style={[sw.wheelHubInner, spinDisabled && sw.wheelHubInnerDisabled, hubStyle]}
        >
          <LinearGradient
            colors={spinDisabled ? SW_GRADIENT.wheelButtonDisabled : SW_GRADIENT.wheelButton}
            locations={SW_GRADIENT.wheelButtonLocations}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[sw.wheelHubFill, spinDisabled && sw.wheelHubFillDisabled]}
          />
          <Pressable
            onPress={() => void handleSpin()}
            disabled={spinDisabled}
            style={[sw.wheelHubPressable, spinDisabled && sw.wheelHubPressableDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: spinDisabled, busy: isSpinning }}
            accessibilityLabel={spinLabel}
            hitSlop={8}
          >
            <Text style={[sw.wheelHubLabel, spinDisabled && sw.wheelHubLabelDisabled]}>
              {spinLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={sw.wheelFooter}>
        <Text style={sw.wheelFooterText}>{copy.wheelNote}</Text>
        <Image
          source={SW_ASSET.alertCircle}
          style={{ width: s(24), height: s(24) }}
          contentFit="contain"
          transition={0}
        />
      </View>
    </View>
  );
});

export default LuckyWheelCard;
