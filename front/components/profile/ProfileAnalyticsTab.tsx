import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

interface PredictionStats {
  correct?: number;
  incorrect?: number;
  pending?: number;
  accuracy?: number;
}

interface ProfileAnalytics {
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  recentFollowers?: number;
}

interface Props {
  analytics: ProfileAnalytics | null;
  predictionStats: PredictionStats | null;
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  gradientColors: readonly [string, string];
  glowColor: string;
}

function StatCard({ icon, value, label, gradientColors, glowColor }: StatCardProps) {
  const GlassCard = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const glassProps = isLiquidGlassSupported
    ? { effect: 'clear' as const, interactive: false }
    : { intensity: 15, tint: 'dark' as const };

  return (
    <View style={[styles.card, { shadowColor: glowColor }]}>
      <GlassCard {...(glassProps as any)} style={StyleSheet.absoluteFill} />
      {/* Colored tint overlay */}
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.iconCircle, { backgroundColor: `${glowColor}22` }]}>
        <Ionicons name={icon} size={22} color={glowColor} />
      </View>
      <Text style={[styles.cardValue, { color: glowColor }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export const ProfileAnalyticsTab: React.FC<Props> = ({ analytics, predictionStats }) => {
  const { t } = useTranslation();

  const fmt = (n?: number): string => {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <View style={styles.container}>
      {/* ── Video analytics ─────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📹 {t.profile.videoAnalytics}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard
          icon="eye-outline"
          value={fmt(analytics?.totalViews)}
          label={t.profile.views}
          gradientColors={['rgba(0,217,255,0.08)', 'rgba(0,217,255,0.03)']}
          glowColor={ProfileTheme.colors.neonBlue}
        />
        <StatCard
          icon="heart-outline"
          value={fmt(analytics?.totalLikes)}
          label={t.profile.likes}
          gradientColors={['rgba(255,107,107,0.08)', 'rgba(255,107,107,0.03)']}
          glowColor="#FF6B6B"
        />
        <StatCard
          icon="chatbubble-outline"
          value={fmt(analytics?.totalComments)}
          label={t.profile.comments}
          gradientColors={['rgba(50,205,50,0.08)', 'rgba(50,205,50,0.03)']}
          glowColor={ProfileTheme.colors.neonGreen}
        />
        <StatCard
          icon="person-add-outline"
          value={fmt(analytics?.recentFollowers)}
          label={t.profile.newFollowers}
          gradientColors={['rgba(155,89,182,0.08)', 'rgba(155,89,182,0.03)']}
          glowColor="#9B59B6"
        />
      </View>

      {/* ── Prediction stats ─────────────────────────────────────── */}
      <View style={[styles.sectionHeader, { marginTop: 28 }]}>
        <Text style={styles.sectionTitle}>📊 {t.profile.predictionStats}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard
          icon="checkmark-circle"
          value={predictionStats?.correct ?? 0}
          label={t.profile.correctPredictions}
          gradientColors={['rgba(34,197,94,0.1)', 'rgba(34,197,94,0.04)']}
          glowColor="#22c55e"
        />
        <StatCard
          icon="close-circle"
          value={predictionStats?.incorrect ?? 0}
          label={t.profile.wrongPredictions}
          gradientColors={['rgba(239,68,68,0.1)', 'rgba(239,68,68,0.04)']}
          glowColor="#ef4444"
        />
        <StatCard
          icon="time"
          value={predictionStats?.pending ?? 0}
          label={t.profile.pendingPredictions}
          gradientColors={['rgba(245,158,11,0.1)', 'rgba(245,158,11,0.04)']}
          glowColor="#f59e0b"
        />
        <StatCard
          icon="analytics"
          value={`${predictionStats?.accuracy ?? 0}%`}
          label={t.profile.successRate}
          gradientColors={['rgba(59,130,246,0.1)', 'rgba(59,130,246,0.04)']}
          glowColor="#3b82f6"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ProfileTheme.colors.textPrimary,
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    borderRadius: 18,
    overflow: 'hidden',
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(255,255,255,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  cardLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    textAlign: 'center',
  },
});
