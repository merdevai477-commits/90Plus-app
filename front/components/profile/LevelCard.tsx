import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

interface LevelCardProps {
  level: number;
  currentXP: number;
  maxXP: number;
  coins: number;
}

export default function LevelCard({ level, currentXP, maxXP, coins }: LevelCardProps) {
  const rawProgress = maxXP > 0 ? Math.min(currentXP / maxXP, 1) : 0;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: rawProgress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [rawProgress]);

  const formatCoins = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatXP = (n: number): string => {
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const GlassWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const glassProps = isLiquidGlassSupported
    ? { effect: 'regular' as const, interactive: false }
    : { intensity: 25, tint: 'dark' as const };

  return (
    <View style={styles.wrapper}>
      <View style={styles.cardOuter}>
        <GlassWrapper {...(glassProps as any)} style={StyleSheet.absoluteFill} />
        {/* Purple tint overlay */}
        <LinearGradient
          colors={['rgba(124,58,237,0.18)', 'rgba(79,70,229,0.08)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Top row: level badge + coins */}
        <View style={styles.topRow}>
          {/* Level badge */}
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            style={styles.levelBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.levelLabel}>LVL</Text>
            <Text style={styles.levelValue}>{level}</Text>
          </LinearGradient>

          {/* XP info */}
          <View style={styles.xpInfo}>
            <Text style={styles.xpTitle}>نقاط الخبرة</Text>
            <Text style={styles.xpNumbers}>
              <Text style={styles.xpCurrent}>{formatXP(currentXP)}</Text>
              <Text style={styles.xpSep}> / </Text>
              <Text style={styles.xpMax}>{formatXP(maxXP)} XP</Text>
            </Text>
          </View>

          {/* Coins */}
          <View style={styles.coinsChip}>
            <Ionicons name="logo-bitcoin" size={16} color="#FFD700" />
            <Text style={styles.coinsValue}>{formatCoins(coins)}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.barBg}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={['#7C3AED', '#00D9FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Glow dot at progress tip */}
          <Animated.View
            style={[
              styles.barGlow,
              {
                left: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Percentage */}
        <Text style={styles.pct}>{Math.round(rawProgress * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  cardOuter: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: isLiquidGlassSupported ? 'transparent' : '#111118',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },

  /* Level badge */
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  levelLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  levelValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },

  /* XP info */
  xpInfo: { flex: 1 },
  xpTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  xpNumbers: {},
  xpCurrent: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  xpSep: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  xpMax: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Coins chip */
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  coinsValue: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Progress bar */
  barBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barGlow: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00D9FF',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
    marginLeft: -8,
  },

  /* Percentage */
  pct: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 8,
  },
});
