/**
 * Premium thinking card — quotes the user's question like Claude / ChatGPT.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { chatColors } from './chatTheme';

type Status = 'thinking' | 'done' | 'error';

interface ThinkingIndicatorProps {
  lastMessage?: string;
  isThinking: boolean;
  status?: Status;
}

const STEP_MS = 900;
const QUOTE_MAX = 88;

function clipQuote(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= QUOTE_MAX) return clean;
  return `${clean.slice(0, QUOTE_MAX - 1).trim()}…`;
}

function keywordFrom(message: string): string {
  const clean = message.replace(/[?!.,،؟]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter((w) => w.length > 2);
  if (!words.length) return clean.slice(0, 24) || '…';
  return [...words].sort((a, b) => b.length - a.length)[0] ?? clean;
}

function buildSteps(message: string, th: Record<string, string>): string[] {
  const quote = clipQuote(message);
  const keyword = keywordFrom(message);
  if (!quote) {
    return [th.readingQuestion, th.checkingLiveData, th.draftingPrecise];
  }
  return [
    (th.analyzing as string).replace('{keyword}', keyword),
    th.checkingLiveData,
    th.draftingPrecise,
  ];
}

function ThinkingDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setN((v) => (v % 3) + 1), 380);
    return () => clearInterval(timer);
  }, []);
  return <Text style={styles.dots}>{'.'.repeat(n)}</Text>;
}

export function ThinkingIndicator({
  lastMessage,
  isThinking,
  status = 'thinking',
}: ThinkingIndicatorProps) {
  const { t, language } = useTranslation();
  const th = t.chat.thinking as Record<string, string>;
  const isAr = language === 'ar';
  const [currentStep, setCurrentStep] = useState(0);
  const quote = clipQuote(lastMessage ?? '');
  const steps = useMemo(() => buildSteps(lastMessage ?? '', th), [lastMessage, th]);

  const pulse = useSharedValue(0.45);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (status !== 'thinking') {
      pulse.value = withTiming(1, { duration: 180 });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [status, pulse, shimmer]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.45, 1], [0.55, 1]),
    transform: [{ scale: interpolate(pulse.value, [0.45, 1], [0.96, 1.05]) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-80, 180]) }],
  }));

  useEffect(() => {
    if (!isThinking) return;
    setCurrentStep(0);
    const timer = setInterval(() => {
      setCurrentStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [isThinking, steps.length]);

  if (!isThinking && status === 'thinking') return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      style={styles.container}
    >
      <View style={styles.card}>
        <LinearGradient
          colors={['rgba(124,58,237,0.28)', 'rgba(12,6,22,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.shimmerClip} pointerEvents="none">
          <Animated.View style={[styles.shimmer, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <View style={[styles.header, isAr && styles.headerRtl]}>
          <Animated.View style={pulseStyle}>
            <View style={styles.sparkWrap}>
              <Sparkles size={16} color="#E9D5FF" strokeWidth={2.2} />
            </View>
          </Animated.View>
          <View style={[styles.titleRow, isAr && styles.titleRowRtl]}>
            <Text style={[styles.thinkingLabel, isAr && styles.rtlText]}>
              {th.thinkingLabel}
            </Text>
            <ThinkingDots />
          </View>
        </View>

        {quote ? (
          <Text style={[styles.quote, isAr && styles.rtlText]} numberOfLines={2}>
            “{quote}”
          </Text>
        ) : null}

        <View style={styles.steps}>
          {steps.map((step, i) => {
            if (i > currentStep) return null;
            const active = i === currentStep;
            return (
              <Animated.View
                key={`${step}-${i}`}
                entering={FadeIn.duration(180)}
                style={[styles.stepRow, isAr && styles.stepRowRtl]}
              >
                <View style={[styles.dot, active ? styles.dotActive : styles.dotPast]} />
                <Text
                  style={[
                    styles.stepText,
                    active ? styles.stepActive : styles.stepPast,
                    isAr && styles.rtlText,
                  ]}
                  numberOfLines={2}
                >
                  {step}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    marginVertical: 8,
    paddingHorizontal: 2,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  shimmerClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  titleRowRtl: {
    flexDirection: 'row-reverse',
  },
  sparkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.28)',
  },
  thinkingLabel: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dots: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: -2,
  },
  quote: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  steps: {
    gap: 7,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepRowRtl: {
    flexDirection: 'row-reverse',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  dotActive: {
    backgroundColor: chatColors.accentSoft,
  },
  dotPast: {
    backgroundColor: 'rgba(167,139,250,0.35)',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  stepActive: {
    color: 'rgba(255,255,255,0.88)',
  },
  stepPast: {
    color: 'rgba(255,255,255,0.42)',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
