import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';

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

export const ProfileAnalyticsTab: React.FC<Props> = ({ analytics, predictionStats }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.profile.videoAnalytics}</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Ionicons name="eye-outline" size={28} color={ProfileTheme.colors.neonBlue} />
          <Text style={styles.value}>{analytics?.totalViews || 0}</Text>
          <Text style={styles.label}>{t.profile.views}</Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="heart-outline" size={28} color="#FF6B6B" />
          <Text style={styles.value}>{analytics?.totalLikes || 0}</Text>
          <Text style={styles.label}>{t.profile.likes}</Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="chatbubble-outline" size={28} color={ProfileTheme.colors.neonGreen} />
          <Text style={styles.value}>{analytics?.totalComments || 0}</Text>
          <Text style={styles.label}>{t.profile.comments}</Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="person-add-outline" size={28} color="#9B59B6" />
          <Text style={styles.value}>{analytics?.recentFollowers || 0}</Text>
          <Text style={styles.label}>{t.profile.newFollowers}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 {t.profile.predictionStats}</Text>
        <View style={styles.grid}>
          <View style={[styles.card, { borderColor: '#22c55e', borderWidth: 1 }]}>
            <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
            <Text style={[styles.value, { color: '#22c55e' }]}>{predictionStats?.correct || 0}</Text>
            <Text style={styles.label}>{t.profile.correctPredictions}</Text>
          </View>
          <View style={[styles.card, { borderColor: '#ef4444', borderWidth: 1 }]}>
            <Ionicons name="close-circle" size={28} color="#ef4444" />
            <Text style={[styles.value, { color: '#ef4444' }]}>{predictionStats?.incorrect || 0}</Text>
            <Text style={styles.label}>{t.profile.wrongPredictions}</Text>
          </View>
          <View style={[styles.card, { borderColor: '#f59e0b', borderWidth: 1 }]}>
            <Ionicons name="time" size={28} color="#f59e0b" />
            <Text style={[styles.value, { color: '#f59e0b' }]}>{predictionStats?.pending || 0}</Text>
            <Text style={styles.label}>{t.profile.pendingPredictions}</Text>
          </View>
          <View style={[styles.card, { borderColor: '#3b82f6', borderWidth: 1 }]}>
            <Ionicons name="analytics" size={28} color="#3b82f6" />
            <Text style={[styles.value, { color: '#3b82f6' }]}>{predictionStats?.accuracy || 0}%</Text>
            <Text style={styles.label}>{t.profile.successRate}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 0,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    color: ProfileTheme.colors.textSecondary,
    marginTop: 4,
  },
  section: { marginTop: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ProfileTheme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'right',
  },
});
