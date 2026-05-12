/**
 * LimitReachedMessage.tsx — Native
 * Full card shown in the messages area when daily limit is reached.
 * Shows countdown timer with gradient text via MaskedView.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { LimitReachedCountdown } from './LimitReachedCountdown';
import { Colors, Radius, FontSize, Spacing, BlurIntensity } from '../../../constants/theme';

interface LimitReachedMessageProps {
  resetTime: Date;
}

export function LimitReachedMessage({ resetTime }: LimitReachedMessageProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.container}
    >
      <View style={styles.card}>
        {/* Glass blur */}
        <BlurView
          intensity={BlurIntensity.glass}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        {/* Fallback overlay */}
        <View style={styles.fallback} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.label}>Daily message limit reached</Text>

          {/* Gradient countdown text */}
          <MaskedView
            maskElement={
              <LimitReachedCountdown
                resetTime={resetTime}
                style={styles.countdownMask}
              />
            }
            androidRenderingMode="software"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <LimitReachedCountdown
                resetTime={resetTime}
                style={[styles.countdownMask, { opacity: 0 }]}
              />
            </LinearGradient>
          </MaskedView>

          <Text style={styles.sublabel}>Resets after the countdown</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.base,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,10,20,0.7)',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.md,
    color: Colors.white50,
    marginBottom: Spacing.md,
  },
  countdownMask: {
    fontSize: FontSize['9xl'],
    fontWeight: '300',
    letterSpacing: 2,
    color: Colors.white,
    fontVariant: ['tabular-nums'],
  },
  sublabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
