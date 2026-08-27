import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS } from './profileV2Assets';
import BadgesDisplay from './BadgesDisplay';

interface ProfileAnalytics {
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  recentFollowers?: number;
}

interface Props {
  analytics: ProfileAnalytics | null;
  userId: string;
  authToken: string | null;
}

function fmt(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const EngagementStat = memo(function EngagementStat({
  icon,
  ionIcon,
  value,
  label,
}: {
  icon?: number;
  ionIcon?: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={statStyles.card}>
      <LinearGradient
        colors={['rgba(23,13,43,0.95)', 'rgba(32,13,68,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      />
      {icon ? (
        <Image source={icon} style={statStyles.icon} contentFit="contain" />
      ) : ionIcon ? (
        <Ionicons name={ionIcon} size={28} color="#D8AEFF" />
      ) : null}
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
});

export function ProfileAchievementsTab({ analytics, userId, authToken }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <EngagementStat
          icon={PROFILE_ICONS.video}
          value={fmt(analytics?.totalViews)}
          label={t.profile.views}
        />
        <EngagementStat
          icon={PROFILE_ICONS.heart}
          value={fmt(analytics?.totalLikes)}
          label={t.profile.likes}
        />
        <EngagementStat
          ionIcon="chatbubble-outline"
          value={fmt(analytics?.totalComments)}
          label={t.profile.comments}
        />
        <EngagementStat
          icon={PROFILE_ICONS.following}
          value={fmt(analytics?.recentFollowers)}
          label={t.profile.newFollowers}
        />
      </View>

      {userId && !String(userId).startsWith('user_') ? (
        <View style={styles.badgesWrap}>
          <BadgesDisplay userId={userId} token={authToken} compact={false} />
        </View>
      ) : null}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
  },
  icon: {
    width: 28,
    height: 28,
  },
  value: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    color: '#8C8C8C',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 21,
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  badgesWrap: {
    marginTop: 4,
  },
});
