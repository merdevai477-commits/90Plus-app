import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
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
  BLUE_PRIMARY,
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
  variant?: 'full' | 'predictionsOnly';
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

function WideStatCard({ icon, value, label, accent, gradient }: StatCardProps) {
  return (
    <View style={[styles.wideCard, { borderColor: `${accent}44`, shadowColor: accent }]}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.wideIconCircle, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
        <Ionicons name={icon} size={24} color={accent} />
      </View>
      <View style={styles.wideCardText}>
        <Text style={styles.wideCardLabel}>{label}</Text>
      </View>
      <Text style={[styles.wideCardValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function TeamBadge({
  name,
  logo,
}: {
  name: string;
  logo: string | null;
}) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <View style={matchStyles.teamCol}>
      <View style={matchStyles.teamLogoWrap}>
        {logo ? (
          <Image source={{ uri: logo }} style={matchStyles.teamLogoImg} contentFit="contain" />
        ) : (
          <View style={matchStyles.teamAvatar}>
            <Text style={matchStyles.teamAvatarText}>{initial}</Text>
          </View>
        )}
      </View>
      <Text style={matchStyles.teamName} numberOfLines={1}>
        {name || '—'}
      </Text>
    </View>
  );
}

function PredictionMatchCard({ item }: { item: UserPredictionItem }) {
  const { t, formatDate } = useTranslation();

  const homeName = item.homeTeam || '—';
  const awayName = item.awayTeam || '—';

  const pickLabel = useMemo(() => {
    if (item.predictionType === 'home') return homeName;
    if (item.predictionType === 'away') return awayName;
    return t.predictions.draw;
  }, [item.predictionType, homeName, awayName, t]);

  const isPending = item.isCorrect === null;
  const isCorrect = item.isCorrect === true;

  const accentColor = isPending
    ? BLUE_PRIMARY
    : isCorrect
      ? '#22c55e'
      : '#ef4444';

  const statusLabel = isPending
    ? t.profile.pendingPredictions
    : isCorrect
      ? t.predictions.correctPrediction.replace('!', '')
      : t.predictions.wrongPrediction;

  const dateLabel = item.matchDate
    ? formatDate(new Date(item.matchDate), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : formatDate(new Date(item.createdAt), { day: 'numeric', month: 'short' });

  return (
    <View
      style={[
        matchStyles.card,
        !isPending && isCorrect && matchStyles.cardWin,
        !isPending && !isCorrect && matchStyles.cardLoss,
        isPending && matchStyles.cardPending,
      ]}
    >
      <LinearGradient
        colors={[`${accentColor}33`, 'transparent', `${accentColor}22`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={matchStyles.cardTop}>
        <Text style={matchStyles.leagueText} numberOfLines={1}>
          {item.leagueName || t.profile.predictionHistory}
        </Text>
        <View
          style={[
            matchStyles.statusBadge,
            isPending && matchStyles.statusPending,
            isCorrect && matchStyles.statusCorrect,
            !isPending && !isCorrect && matchStyles.statusWrong,
          ]}
        >
          <Text
            style={[
              matchStyles.statusText,
              { color: accentColor },
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={matchStyles.teamsRow}>
        <TeamBadge name={homeName} logo={item.homeTeamLogo} />

        <View style={matchStyles.pickArea}>
          <Text style={matchStyles.vsText}>{t.home.vs}</Text>
          <View style={[matchStyles.pickPill, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}18` }]}>
            <Text style={[matchStyles.pickPillText, { color: accentColor }]} numberOfLines={1}>
              {pickLabel}
            </Text>
          </View>
        </View>

        <TeamBadge name={awayName} logo={item.awayTeamLogo} />
      </View>

      <View style={matchStyles.cardBottom}>
        <Text style={matchStyles.pickHint}>
          {t.profile.yourPick}: <Text style={matchStyles.pickHintValue}>{pickLabel}</Text>
        </Text>
        <Text style={matchStyles.dateText}>{dateLabel}</Text>
      </View>
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
  variant = 'full',
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<PredictionFilter>('all');
  const predictionsOnly = variant === 'predictionsOnly';

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
      {!predictionsOnly && (
        <>
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
        </>
      )}

      <SectionHeader icon="stats-chart-outline" title={t.profile.predictionStats} />

      <WideStatCard
        icon="analytics"
        value={`${displayStats?.accuracy ?? 0}%`}
        label={t.profile.successRate}
        accent={PURPLE_PRIMARY}
        gradient={['rgba(124,58,237,0.16)', 'rgba(91,33,182,0.06)']}
      />

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

      {filteredPredictions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="football-outline" size={28} color={TEXT_MUTED} />
          <Text style={styles.emptyText}>{t.profile.noPredictionsYet}</Text>
        </View>
      ) : (
        <View style={styles.predList}>
          {filteredPredictions.map((item) => (
            <PredictionMatchCard key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
};

const matchStyles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 156,
    borderRadius: 16,
    backgroundColor: 'rgba(18,12,28,0.98)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 0,
    elevation: 2,
  },
  cardPending: {
    borderColor: 'rgba(59,130,246,0.22)',
    shadowColor: BLUE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  cardWin: {
    borderColor: 'rgba(34,197,94,0.25)',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  cardLoss: {
    borderColor: 'rgba(239,68,68,0.25)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  leagueText: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  statusPending: {
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  statusCorrect: {
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  statusWrong: {
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  teamLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  teamLogoImg: {
    width: 28,
    height: 28,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  teamAvatarText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '800',
  },
  teamName: {
    color: TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 88,
  },
  pickArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    gap: 6,
  },
  vsText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  pickPill: {
    maxWidth: 96,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  pickPillText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  pickHint: {
    flex: 1,
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  pickHintValue: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 10,
    color: PURPLE_SOFT,
    fontWeight: '600',
  },
});

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
  wideCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    backgroundColor: BG_BASE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 8,
    gap: 14,
  },
  wideIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  wideCardText: {
    flex: 1,
  },
  wideCardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  wideCardValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
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
    gap: 12,
  },
});
