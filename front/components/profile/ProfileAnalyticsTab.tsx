import React, { memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS } from './profileV2Assets';

interface PredictionStats {
  correct?: number;
  incorrect?: number;
  pending?: number;
  accuracy?: number;
  total?: number;
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
  xpAwarded?: number;
  createdAt: string;
  source?: 'match' | 'group';
  sourceLabel?: string;
  mode?: 'WINNER' | 'EXACT';
  predictedHomeScore?: number | null;
  predictedAwayScore?: number | null;
}

type PredictionFilter = 'all' | 'correct' | 'pending' | 'group' | 'wrong';

interface Props {
  predictionStats: PredictionStats | null;
  predictions?: UserPredictionItem[];
}

const FILTER_OPTIONS: {
  id: PredictionFilter;
  labelKey: 'predictionFilterAll' | 'correctPredictions' | 'pendingPredictions' | 'predictionFilterGroup' | 'wrongPredictions';
}[] = [
  { id: 'all', labelKey: 'predictionFilterAll' },
  { id: 'correct', labelKey: 'correctPredictions' },
  { id: 'pending', labelKey: 'pendingPredictions' },
  { id: 'group', labelKey: 'predictionFilterGroup' },
  { id: 'wrong', labelKey: 'wrongPredictions' },
];

const INITIAL_VISIBLE = 3;
const LOAD_MORE_STEP = 4;

function pickLabel(
  item: UserPredictionItem,
  homeName: string,
  awayName: string,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (
    item.mode === 'EXACT' &&
    item.predictedHomeScore != null &&
    item.predictedAwayScore != null
  ) {
    return `${item.predictedHomeScore}-${item.predictedAwayScore}`;
  }
  if (item.predictionType === 'home') return homeName;
  if (item.predictionType === 'away') return awayName;
  return t.predictions.draw;
}

function resolveCorrectLabel(
  item: UserPredictionItem,
  homeName: string,
  awayName: string,
  userPick: string,
  pendingLabel: string,
  drawLabel: string,
): string {
  if (item.isCorrect === null) return pendingLabel;
  if (item.isCorrect === true) return userPick;
  if (item.predictionType === 'home') return awayName;
  if (item.predictionType === 'away') return homeName;
  if (item.predictionType === 'draw') return homeName;
  return drawLabel;
}

type CardTheme = 'pending' | 'correct' | 'wrong';

function cardThemeFor(item: UserPredictionItem): CardTheme {
  if (item.isCorrect === null) return 'pending';
  if (item.isCorrect === true) return 'correct';
  return 'wrong';
}

const CARD_THEMES: Record<
  CardTheme,
  {
    border: string;
    gradient: readonly [string, string];
    shadow: string;
  }
> = {
  pending: {
    border: '#04081F',
    gradient: ['rgba(12,40,176,0.14)', 'rgba(5,17,77,0.14)'],
    shadow: 'rgba(9,27,113,0.33)',
  },
  correct: {
    border: '#081F04',
    gradient: ['rgba(12,176,42,0.18)', 'rgba(5,77,18,0.18)'],
    shadow: 'rgba(25,113,9,0.33)',
  },
  wrong: {
    border: '#300D0D',
    gradient: ['rgba(182,6,6,0.18)', 'rgba(80,3,3,0.18)'],
    shadow: 'rgba(176,35,25,0.33)',
  },
};

function ResultPill({
  label,
  tone,
}: {
  label: string;
  tone: 'pending' | 'correct' | 'wrong';
}) {
  const palette =
    tone === 'pending'
      ? { bg: 'rgba(30,40,89,0.24)', color: '#3B4FAF' }
      : tone === 'correct'
        ? { bg: 'rgba(33,89,30,0.24)', color: '#3DA437' }
        : { bg: 'rgba(99,7,7,0.24)', color: '#D64949' };

  return (
    <View style={[pillStyles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={[pillStyles.text, { color: palette.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const PredictionMatchCard = memo(function PredictionMatchCard({
  item,
}: {
  item: UserPredictionItem;
}) {
  const { t } = useTranslation();
  const homeName = item.homeTeam || '—';
  const awayName = item.awayTeam || '—';
  const themeKey = cardThemeFor(item);
  const theme = CARD_THEMES[themeKey];
  const isPending = themeKey === 'pending';
  const pendingLabel = t.profile.pendingPredictions;

  const userPick = pickLabel(item, homeName, awayName, t);
  const correctPick = resolveCorrectLabel(
    item,
    homeName,
    awayName,
    userPick,
    pendingLabel,
    t.predictions.draw,
  );

  return (
    <View style={[cardStyles.wrap, { borderColor: theme.border, shadowColor: theme.shadow }]}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
      <View style={cardStyles.teamsRow}>
        <TeamColumn name={homeName} logo={item.homeTeamLogo} />
        <View style={cardStyles.centerCol}>
          <Text style={cardStyles.vs}>{t.home.vs}</Text>
        </View>
        <TeamColumn name={awayName} logo={item.awayTeamLogo} />
      </View>

      <Image source={PROFILE_ICONS.predictionDivider} style={cardStyles.divider} contentFit="fill" />

      <View style={cardStyles.resultsBlock}>
        <View style={cardStyles.resultRow}>
          <ResultPill
            label={isPending ? pendingLabel : userPick}
            tone={isPending ? 'pending' : themeKey === 'wrong' ? 'wrong' : 'correct'}
          />
          <Text style={cardStyles.resultLabel}>{t.profile.yourPick}</Text>
        </View>
        <View style={cardStyles.resultRow}>
          <ResultPill
            label={isPending ? pendingLabel : correctPick}
            tone={isPending ? 'pending' : 'correct'}
          />
          <Text style={cardStyles.resultLabel}>{t.profile.correctPredictionLabel}</Text>
        </View>
      </View>
    </View>
  );
});

function TeamColumn({ name, logo }: { name: string; logo: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={cardStyles.teamCol}>
      <View style={cardStyles.logoWrap}>
        {logo ? (
          <Image source={{ uri: logo }} style={cardStyles.logo} contentFit="contain" />
        ) : (
          <Text style={cardStyles.logoFallback}>{initial}</Text>
        )}
      </View>
      <Text style={cardStyles.teamName} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

export const ProfileAnalyticsTab: React.FC<Props> = ({
  predictionStats,
  predictions = [],
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<PredictionFilter>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

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
    if (filter === 'group') list = list.filter((p) => p.source === 'group');
    else if (filter === 'pending') list = list.filter((p) => p.isCorrect === null);
    else if (filter === 'correct') list = list.filter((p) => p.isCorrect === true);
    else if (filter === 'wrong') list = list.filter((p) => p.isCorrect === false);
    return list;
  }, [predictions, filter]);

  const visiblePredictions = filteredPredictions.slice(0, visibleCount);
  const hasMore = filteredPredictions.length > visibleCount;

  const emptyMessage =
    filter === 'group' ? t.profile.noGroupPredictionsYet : t.profile.noPredictionsYet;

  const accuracyPct = displayStats?.accuracy ?? 0;
  const normalizedAccuracy =
    accuracyPct <= 1 && accuracyPct > 0 ? Math.round(accuracyPct * 100) : Math.round(accuracyPct);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map(({ id, labelKey }) => {
          const active = filter === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => {
                setFilter(id);
                setVisibleCount(INITIAL_VISIBLE);
              }}
              activeOpacity={0.8}
              style={[styles.filterChip, active && styles.filterChipActiveShell]}
            >
              {active ? (
                <LinearGradient
                  colors={['#8B5CF6', '#513690']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
              ) : null}
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {t.profile[labelKey]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.successCard}>
        <LinearGradient
          colors={['#110A22', '#2A1950']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
        <Text style={styles.successPct}>{normalizedAccuracy}%</Text>
        <View style={styles.successRight}>
          <Text style={styles.successLabel}>{t.profile.successRate}</Text>
          <Image source={PROFILE_ICONS.lineChart} style={styles.successIcon} contentFit="contain" />
        </View>
      </View>

      {visiblePredictions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visiblePredictions.map((item) => (
            <PredictionMatchCard key={item.id} item={item} />
          ))}
        </View>
      )}

      {hasMore ? (
        <TouchableOpacity
          style={styles.loadMore}
          activeOpacity={0.8}
          onPress={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
        >
          <Image source={PROFILE_ICONS.chevronDownPurple} style={styles.loadMoreIcon} contentFit="contain" />
          <Text style={styles.loadMoreText}>{t.profile.showMore}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const pillStyles = StyleSheet.create({
  wrap: {
    minWidth: 67,
    height: 20,
    borderRadius: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});

const cardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 29,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 9,
    paddingBottom: 34,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 7.4,
    elevation: 4,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 31,
    paddingHorizontal: 12,
    minHeight: 119,
  },
  teamCol: {
    width: 67,
    alignItems: 'center',
    gap: 9,
  },
  logoWrap: {
    width: 60,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 60,
    height: 80,
  },
  logoFallback: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  teamName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerCol: {
    width: 66,
    height: 57,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vs: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    width: '82%',
    height: 1,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  resultsBlock: {
    gap: 7,
    paddingHorizontal: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    direction: 'rtl',
  },
  resultLabel: {
    color: '#C5C5C5',
    fontSize: 12,
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 21,
    paddingBottom: 11,
    paddingHorizontal: 8,
    gap: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
  },
  filterChip: {
    height: 24,
    paddingHorizontal: 12,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#23162E',
    backgroundColor: '#120D1F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterChipActiveShell: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#41354D',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  successCard: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#331E64',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  successPct: {
    color: '#EBD9FC',
    fontSize: 24,
    fontWeight: '700',
  },
  successRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'rtl',
  },
  successLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  successIcon: {
    width: 35,
    height: 35,
  },
  list: {
    gap: 20,
    paddingHorizontal: 4,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8C8C8C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  loadMoreIcon: {
    width: 16,
    height: 16,
  },
  loadMoreText: {
    color: ProfileTheme.colors.profilePrimary,
    fontSize: 10,
    fontWeight: '600',
  },
});
