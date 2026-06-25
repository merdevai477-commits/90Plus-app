import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

interface StatsRowProps {
  followers: string;
  following: string;
  videos: string;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onVideosPress?: () => void;
}

const StatsRow = memo(function StatsRow({
  followers,
  following,
  videos,
  onFollowersPress,
  onFollowingPress,
  onVideosPress,
}: StatsRowProps) {
  const { t } = useTranslation();

  const GlassWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const glassProps = isLiquidGlassSupported
    ? { effect: 'clear' as const, interactive: false }
    : { intensity: 18, tint: 'dark' as const };

  return (
    <View style={styles.container}>
      <GlassWrapper {...(glassProps as any)} style={StyleSheet.absoluteFill} />
      <StatCard
        label={t.profile.followers}
        value={followers}
        accentColor={ProfileTheme.colors.neonBlue}
        onPress={onFollowersPress}
      />
      <View style={styles.divider} />
      <StatCard
        label={t.profile.following}
        value={following}
        accentColor={ProfileTheme.colors.neonGreen}
        onPress={onFollowingPress}
      />
      <View style={styles.divider} />
      <StatCard
        label={t.profile.videos}
        value={videos}
        accentColor={ProfileTheme.colors.gold}
        onPress={onVideosPress}
      />
    </View>
  );
});

export default StatsRow;

interface StatCardProps {
  label: string;
  value: string;
  accentColor: string;
  onPress?: () => void;
}

function StatCard({ label, value, accentColor, onPress }: StatCardProps) {
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const inner = (
    <View style={styles.statInner}>
      <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.statTouchable} onPress={handlePress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.statTouchable}>{inner}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 28,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statTouchable: {
    flex: 1,
  },
  statInner: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
