/**
 * ThinkingIndicator.tsx — Optimized Version (Production Ready)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { Brain, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Colors, Radius, FontSize, Spacing, Duration } from '../../constants/theme';
import { useTranslation } from '../../src/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = 'thinking' | 'done' | 'error';

interface ThinkingIndicatorProps {
  lastMessage?: string;
  isThinking: boolean;
  status?: Status;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateThinkingSteps(message: string, th: Record<string, string>): string[] {
  if (!message) {
    return [th.readingQuestion, th.draftingReply];
  }

  const clean = message.replace(/[?!.,]/g, '');
  const words = clean.split(/\s+/).filter(w => w.length > 2);

  const keyword =
    words.sort((a, b) => b.length - a.length)[0] || 'details';

  const lower = message.toLowerCase();

  if (/\b(how many|count|number of|what'?s the score)\b/.test(lower)) {
    return [
      th.parsingNumbers,
      th.lookingUp.replace('{keyword}', keyword),
      th.workingThrough,
    ];
  }

  if (/\b(how\b|why\b|what\b|explain|steps?|walk me through)\b/.test(lower) || message.includes('?')) {
    return [
      th.breakingDown,
      th.analyzing.replace('{keyword}', keyword),
      th.draftingClear,
    ];
  }

  return [
    th.understanding,
    th.searching.replace('{keyword}', keyword),
    th.writing,
  ];
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function StatusGlyph({ status }: { status: Status }) {
  const size = 18;
  if (status === 'done') return <CheckCircle size={size} color={Colors.success} strokeWidth={2.2} />;
  if (status === 'error') return <AlertTriangle size={size} color={Colors.warning} strokeWidth={2.2} />;
  return <Brain size={size} color={Colors.purpleSoft} strokeWidth={2.2} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ThinkingIndicator({
  lastMessage,
  isThinking,
  status = 'thinking',
}: ThinkingIndicatorProps) {
  const { t } = useTranslation();
  const th = t.chat.thinking;
  const [isOpen, setIsOpen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [duration, setDuration] = useState(0);

  const steps = useMemo(
    () => generateThinkingSteps(lastMessage ?? '', th),
    [lastMessage, th],
  );

  // ─── Animations ────────────────────────────────────────────────────────────

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status !== 'thinking') {
      pulse.value = withTiming(1);
      return;
    }

    pulse.value = withRepeat(
      withTiming(0.4, { duration: 400 }),
      -1,
      true
    );
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: interpolate(pulse.value, [0.4, 1], [0.95, 1.05]) }],
  }));

  // Expand animation
  const expand = useSharedValue(1);

  useEffect(() => {
    expand.value = withSpring(isOpen ? 1 : 0, {
      stiffness: 200,
      damping: 22,
      mass: 0.8,
    });
  }, [isOpen]);

  // Measured content height — ref outside animated view
  const [contentHeight, setContentHeight] = useState(0);

  const contentStyle = useAnimatedStyle(() => {
    if (contentHeight === 0) {
      // First render — show content normally for measurement, hide via opacity
      return { opacity: 0 };
    }
    return {
      height: expand.value * contentHeight,
      opacity: expand.value,
    };
  });

  // ─── Timers ────────────────────────────────────────────────────────────────

  // Duration
  useEffect(() => {
    if (!isThinking) return;

    const timer = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isThinking]);

  // Steps
  useEffect(() => {
    if (!isThinking) return;

    setCurrentStep(0);

    const stepTimer = setInterval(() => {
      setCurrentStep(s =>
        s < steps.length - 1 ? s + 1 : s
      );
    }, Duration.thinkingStep);

    return () => clearInterval(stepTimer);
  }, [steps, isThinking]);

  // Reset when done
  useEffect(() => {
    if (!isThinking) {
      setDuration(0);
      setCurrentStep(steps.length - 1);
    }
  }, [isThinking]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const toggleOpen = () => setIsOpen(p => !p);

  const formattedTime = `${Math.floor(duration / 60)}:${(duration % 60)
    .toString()
    .padStart(2, '0')}`;

  const getStatusText = () => {
    if (status === 'done') return th.responseReady;
    if (status === 'error') return th.somethingWrong;
    return th.thinkingDuration.replace('{time}', formattedTime);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!isThinking && status === 'thinking') return null;

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={styles.container}>
      <View style={styles.wrapper}>
        {/* Trigger */}
        <Pressable onPress={toggleOpen} style={styles.trigger}>
          <View style={styles.triggerBg} />
          <View style={styles.triggerContent}>
            <View style={styles.left}>
              <Animated.View style={pulseStyle}>
                <StatusGlyph status={status} />
              </Animated.View>
              <Text style={styles.text}>{getStatusText()}</Text>
            </View>
            {isOpen ? (
              <ChevronUp size={18} color={Colors.white50} strokeWidth={2} />
            ) : (
              <ChevronDown size={18} color={Colors.white50} strokeWidth={2} />
            )}
          </View>
        </Pressable>

        {/* Content */}
        {isOpen && (
          <Animated.View style={[styles.content, contentStyle]}>
            <View style={styles.contentBg} />

            <View
              style={styles.steps}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && h !== contentHeight) setContentHeight(h);
              }}
            >
              {steps.map((step, i) => {
                const visible = i <= currentStep;
                if (!visible) return null;

                const isActive = i === currentStep;

                return (
                  <Animated.View
                    key={i}
                    entering={FadeIn.delay(i * 80)}
                    style={styles.stepRow}
                  >
                    <View
                      style={[
                        styles.dot,
                        isActive ? styles.dotActive : styles.dotPast,
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepText,
                        isActive ? styles.textActive : styles.textPast,
                      ]}
                    >
                      {step}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    marginVertical: Spacing.sm,
  },
  wrapper: {
    width: '85%',
    maxWidth: 280,
  },
  trigger: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  triggerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surfaceGlass,
  },
  triggerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    zIndex: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  text: {
    color: Colors.white70,
    fontSize: FontSize.md,
  },
  content: {
    borderRadius: Radius.xl,
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  contentBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,16,36,0.95)',
  },
  steps: {
    padding: Spacing.base,
    gap: Spacing.sm,
    zIndex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Colors.purpleSoft,
  },
  dotPast: {
    backgroundColor: 'rgba(124,58,237,0.4)',
  },
  stepText: {
    fontSize: FontSize.base,
  },
  textActive: {
    color: Colors.white80,
  },
  textPast: {
    color: Colors.white40,
  },
});