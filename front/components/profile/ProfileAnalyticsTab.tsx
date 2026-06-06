import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import {
  BG_BASE,
  PURPLE_PRIMARY,
  PURPLE_DARK,
  PURPLE_GLOW_SM,
  PURPLE_SOFT,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../../constants/tokens';

interface PredictionStats {
  correct?: number;
  incorrect?: number;
  pending?: number;
  accuracy?: number;
  total?: number;
}

interface ProfileAnalytics {
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  recentFollowers?: number;
}

export interface UserPredictionItem {
  id: string;
  apiMatchId: number;
  predictionType: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  matchDate: string | null;
  leagueName: string | null;
  isCorrect: boolean | null;
  coinsWon: number | null;
  coinsSpent: number;
  createdAt: string;
}

type PredictionFilter = 'all' | 'pending' | 'correct' | 'wrong';

interface Props {
  analytics: ProfileAnalytics | null;
  predictionStats: PredictionStats | null;
  predictions?: UserPredictionItem[];
  predictionsLoading?: boolean;
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  accent: string;
  gradient: readonly [string, string];
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <LinearGradient
        colors={[PURPLE_PRIMARY, PURPLE_DARK]}
        style={styles.sectionIconWrap}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={icon} size={16} color={TEXT_PRIMARY} />
      </LinearGradient>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function StatCard({ icon, value, label, accent, gradient }: StatCardProps) {
  return (
    <View style={[styles.card, { borderColor: `${accent}44`, shadowColor: accent }]}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.iconCircle, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={[styles.cardValue, { color: accent }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function TeamLogo({ uri }: { uri: string | null }) {
  if (!uri) {
    return (
      <View style={styles.teamLogoFallback}>
        <Ionicons name="football-outline" size={14} color={TEXT_MUTED} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.teamLogo} />;
}

function StatusBadge({ isCorrect }: { isCorrect: boolean | null }) {
  const { t } = useTranslation();

  if (isCorrect === true) {
    return (
      <View style={[styles.statusBadge, styles.statusCorrect]}>
        <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
        <Text style={[styles.statusText, { color: '#22c55e' }]}>{t.predictions.correctPrediction.replace('!', '')}</Text>
      </View>
    );
  }
  if (isCorrect === false) {
    return (
      <View style={[styles.statusBadge, styles.statusWrong]}>
        <Ionicons name="close-circle" size={12} color="#ef4444" />
        <Text style={[styles.statusText, { color: '#ef4444' }]}>{t.predictions.wrongPrediction}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, styles.statusPending]}>
      <Ionicons name="time" size={12} color={ProfileTheme.colors.gold} />
      <Text style={[styles.statusText, { color: ProfileTheme.colors.gold }]}>{t.profile.pendingPredictions}</Text>
    </View>
  );
}

function PredictionRow({ item }: { item: UserPredictionItem }) {
  const { t, formatDate } = useTranslation();

  const pickLabel = useMemo(() => {
    if (item.predictionType === 'home') return item.homeTeam || t.predictions.homeWin;
    if (item.predictionType === 'away') return item.awayTeam || t.predictions.awayWin;
    return t.predictions.draw;
  }, [item, t]);

  const dateLabel = item.matchDate
    ? formatDate(new Date(item.matchDate), { day: 'numeric', month: 'short' })
    : formatDate(new Date(item.createdAt), { day: 'numeric', month: 'short' });

  return (
    <View style={styles.predRow}>
      <View style={styles.predTeamsRow}>
        <View style={styles.predTeamSide}>
          <TeamLogo uri={item.homeTeamLogo} />
          <Text style={styles.predTeamName} numberOfLines={1}>
            {item.homeTeam || '—'}
          </Text>
        </View>
        <Text style={styles.predVs}>vs</Text>
        <View style={styles.predTeamSide}>
          <TeamLogo uri={item.awayTeamLogo} />
          <Text style={styles.predTeamName} numberOfLines={1}>
            {item.awayTeam || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.predMetaRow}>
        <View style={styles.predMetaLeft}>
          {item.leagueName ? (
            <Text style={styles.predLeague} numberOfLines={1}>{item.leagueName}</Text>
          ) : null}
          <Text style={styles.predPick}>
            {t.profile.yourPick}: <Text style={styles.predPickValue}>{pickLabel}</Text>
          </Text>
        </View>
        <Text style={styles.predDate}>{dateLabel}</Text>
      </View>

      <StatusBadge isCorrect={item.isCorrect} />
    </View>
  );
}

const FILTER_OPTIONS: { id: PredictionFilter; labelKey: 'predictionFilterAll' | 'pendingPredictions' | 'correctPredictions' | 'wrongPredictions' }[] = [
  { id: 'all', labelKey: 'predictionFilterAll' },
  { id: 'pending', labelKey: 'pendingPredictions' },
  { id: 'correct', labelKey: 'correctPredictions' },
  { id: 'wrong', labelKey: 'wrongPredictions' },
];

export const ProfileAnalyticsTab: React.FC<Props> = ({
  analytics,
  predictionStats,
  predictions = [],
  predictionsLoading = false,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<PredictionFilter>('all');

  const derivedStats = useMemo(() => {
    if (!predictions.length) return null;
    const correct = predictions.filter((p) => p.isCorrect === true).length;
    const incorrect = predictions.filter((p) => p.isCorrect === false).length;
    const pending = predictions.filter((p) => p.isCorrect === null).length;
    const resolved = correct + incorrect;
    return {
      correct,
      incorrect,
      pending,
      accuracy: resolved > 0 ? Math.round((correct / resolved) * 100) : 0,
      total: predictions.length,
    };
  }, [predictions]);

  const displayStats = useMemo(() => {
    const hasServerStats =
      predictionStats &&
      ((predictionStats.total ?? 0) > 0 ||
        (predictionStats.correct ?? 0) > 0 ||
        (predictionStats.incorrect ?? 0) > 0 ||
        (predictionStats.pending ?? 0) > 0);
    if (hasServerStats) return predictionStats;
    return derivedStats ?? predictionStats;
  }, [predictionStats, derivedStats]);

  const filteredPredictions = useMemo(() => {
    let list = [...predictions];
    if (filter === 'pending') list = list.filter((p) => p.isCorrect === null);
    else if (filter === 'correct') list = list.filter((p) => p.isCorrect === true);
    else if (filter === 'wrong') list = list.filter((p) => p.isCorrect === false);
    return list.slice(0, 5);
  }, [predictions, filter]);

  const fmt = (n?: number): string => {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <View style={styles.container}>
      <SectionHeader icon="videocam-outline" title={t.profile.videoAnalytics} />

      <View style={styles.grid}>
        <StatCard
          icon="eye-outline"
          value={fmt(analytics?.totalViews)}
          label={t.profile.views}
          accent={ProfileTheme.colors.neonBlue}
          gradient={['rgba(0,217,255,0.14)', 'rgba(0,217,255,0.04)']}
        />
        <StatCard
          icon="heart-outline"
          value={fmt(analytics?.totalLikes)}
          label={t.profile.likes}
          accent="#FF6B6B"
          gradient={['rgba(255,107,107,0.14)', 'rgba(255,107,107,0.04)']}
        />
        <StatCard
          icon="chatbubble-outline"
          value={fmt(analytics?.totalComments)}
          label={t.profile.comments}
          accent={ProfileTheme.colors.neonGreen}
          gradient={['rgba(50,205,50,0.14)', 'rgba(50,205,50,0.04)']}
        />
        <StatCard
          icon="person-add-outline"
          value={fmt(analytics?.recentFollowers)}
          label={t.profile.newFollowers}
          accent={PURPLE_SOFT}
          gradient={['rgba(167,139,250,0.16)', 'rgba(124,58,237,0.06)']}
        />
      </View>

      <SectionHeader icon="stats-chart-outline" title={t.profile.predictionStats} />

      <View style={styles.grid}>
        <StatCard
          icon="checkmark-circle"
          value={displayStats?.correct ?? 0}
          label={t.profile.correctPredictions}
          accent="#22c55e"
          gradient={['rgba(34,197,94,0.14)', 'rgba(34,197,94,0.05)']}
        />
        <StatCard
          icon="close-circle"
          value={displayStats?.incorrect ?? 0}
          label={t.profile.wrongPredictions}
          accent="#ef4444"
          gradient={['rgba(239,68,68,0.14)', 'rgba(239,68,68,0.05)']}
        />
        <StatCard
          icon="time"
          value={displayStats?.pending ?? 0}
          label={t.profile.pendingPredictions}
          accent={ProfileTheme.colors.gold}
          gradient={['rgba(245,197,24,0.14)', 'rgba(245,197,24,0.05)']}
        />
        <StatCard
          icon="analytics"
          value={`${displayStats?.accuracy ?? 0}%`}
          label={t.profile.successRate}
          accent={PURPLE_PRIMARY}
          gradient={['rgba(124,58,237,0.16)', 'rgba(91,33,182,0.06)']}
        />
      </View>

      <SectionHeader icon="list-outline" title={t.profile.predictionHistory} />

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map(({ id, labelKey }) => {
          const active = filter === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {t.profile[labelKey]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {predictionsLoading && predictions.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={PURPLE_PRIMARY} />
        </View>
      ) : filteredPredictions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="football-outline" size={28} color={TEXT_MUTED} />
          <Text style={styles.emptyText}>{t.profile.noPredictionsYet}</Text>
        </View>
      ) : (
        <View style={styles.predList}>
          {filteredPredictions.map((item) => (
            <PredictionRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
    gap: 10,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: PURPLE_GLOW_SM,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  card: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: BG_BASE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  cardLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PURPLE_GLOW_SM,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  filterChipActive: {
    borderColor: PURPLE_PRIMARY,
    backgroundColor: 'rgba(124,58,237,0.28)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  filterChipTextActive: {
    color: TEXT_PRIMARY,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  predList: {
    gap: 10,
  },
  predRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PURPLE_GLOW_SM,
    backgroundColor: 'rgba(124,58,237,0.06)',
    padding: 12,
    gap: 8,
  },
  predTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  predTeamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  teamLogoFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  predTeamName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  predVs: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  predMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  predMetaLeft: {
    flex: 1,
    gap: 2,
  },
  predLeague: {
    fontSize: 10,
    color: PURPLE_SOFT,
    fontWeight: '600',
  },
  predPick: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  predPickValue: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  predDate: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCorrect: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  statusWrong: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  statusPending: {
    backgroundColor: 'rgba(245,197,24,0.12)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
