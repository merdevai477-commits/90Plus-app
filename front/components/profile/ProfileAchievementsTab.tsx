import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useProfileTheme } from '../../hooks/useProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS, PROFILE_RANK_ICON } from './profileV2Assets';

interface ProfileAnalytics {
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  recentFollowers?: number;
}

type AchievementsSubTab = 'titles' | 'ranks';
type BadgeFilter = 'all' | 'done' | 'progress' | 'locked';

interface BadgeItem {
  id: string;
  title: string;
  status: 'done' | 'progress' | 'locked';
  progress?: string;
  progressPct?: number;
}

interface RankRow {
  id: string;
  competition: string;
  period: string;
  rank: string;
  score: string;
}

interface Props {
  analytics: ProfileAnalytics | null;
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

export function ProfileAchievementsTab({ analytics }: Props) {
  const { t } = useTranslation();
  const { colors: C, isDark } = useProfileTheme();
  const [subTab, setSubTab] = useState<AchievementsSubTab>('titles');
  const [filter, setFilter] = useState<BadgeFilter>('all');

  const badges = useMemo<BadgeItem[]>(
    () => [
      { id: 'first', title: t.profile.firstPrediction, status: 'done' },
      { id: 'active', title: t.profile.achievementsFanActive, status: 'done' },
      {
        id: 'expert',
        title: t.profile.achievementsPredictionsExpert,
        status: 'progress',
        progress: '7/10',
        progressPct: 0.7,
      },
      {
        id: 'star',
        title: t.profile.achievementsCommunityStar,
        status: 'progress',
        progress: '3/5',
        progressPct: 0.6,
      },
      { id: 'results', title: t.profile.achievementsResultsKing, status: 'locked' },
      { id: 'legend', title: t.profile.achievementsLegend, status: 'locked' },
    ],
    [t],
  );

  const ranks = useMemo<RankRow[]>(
    () => [
      {
        id: 'results',
        competition: t.profile.achievementsResultsKing,
        period: t.profile.achievementsPeriodWeek,
        rank: '#06',
        score: t.profile.achievementsPoints.replace('{count}', '670'),
      },
      {
        id: 'scorers',
        competition: t.profile.achievementsScorersCup,
        period: t.profile.achievementsPeriodSeason,
        rank: '#08',
        score: t.profile.achievementsPoints.replace('{count}', '2,450'),
      },
      {
        id: 'predictions',
        competition: t.profile.achievementsPredictionsKing,
        period: t.profile.achievementsPeriodWeek,
        rank: '#12',
        score: t.profile.achievementsPoints.replace('{count}', '840'),
      },
      {
        id: 'coach',
        competition: t.profile.achievementsCoachKing,
        period: t.profile.achievementsPeriodRound,
        rank: '#15',
        score: t.profile.achievementsPoints.replace('{count}', '1,120'),
      },
      {
        id: 'share',
        competition: t.profile.achievementsShareWin,
        period: t.profile.achievementsPeriodMonth,
        rank: '#24',
        score: t.profile.achievementsPoints.replace('{count}', '12,320'),
      },
    ],
    [t],
  );

  const doneCount = badges.filter((b) => b.status === 'done').length;
  const totalCount = badges.length;
  const pct = Math.round((doneCount / Math.max(totalCount, 1)) * 100);

  const filteredBadges = badges.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'done') return b.status === 'done';
    if (filter === 'progress') return b.status === 'progress';
    return b.status === 'locked';
  });

  const bestRank = ranks.reduce((best, row) => {
    const n = Number(row.rank.replace('#', ''));
    return Number.isFinite(n) && n < best ? n : best;
  }, 99);

  void analytics;

  return (
    <View style={styles.container}>
      <View style={[styles.segment, { backgroundColor: C.profilePrimarySoft }]}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            subTab === 'titles' && [styles.segmentBtnActive, { backgroundColor: C.profilePrimary }],
          ]}
          onPress={() => setSubTab('titles')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              { color: C.profilePrimary },
              subTab === 'titles' && styles.segmentTextActive,
            ]}
          >
            {t.profile.achievementsMyTitles}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            subTab === 'ranks' && [styles.segmentBtnActive, { backgroundColor: C.profilePrimary }],
          ]}
          onPress={() => setSubTab('ranks')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              { color: C.profilePrimary },
              subTab === 'ranks' && styles.segmentTextActive,
            ]}
          >
            {t.profile.achievementsMyRanking}
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'titles' ? (
        <>
          <View style={[styles.summaryCard, { backgroundColor: C.achievementsCard }]}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={[styles.summaryCount, { color: C.textPrimary }]}>
                  {pad2(doneCount)} / {pad2(totalCount)}
                </Text>
                <Text style={[styles.summaryCountLabel, { color: C.profileMuted }]}>
                  {t.profile.achievementsCompletedLabel}
                </Text>
              </View>
              <View style={styles.summaryTitleRow}>
                <View style={styles.summaryCopy}>
                  <Text style={[styles.summaryTitle, { color: C.textPrimary }]}>
                    {t.profile.myAchievements}
                  </Text>
                  <Text style={[styles.summarySub, { color: C.profileMuted }]}>
                    {t.profile.achievementsTitlesTagline}
                  </Text>
                </View>
                <View style={[styles.trophyBubble, { backgroundColor: C.achievementsIconBg }]}>
                  <Image source={PROFILE_ICONS.trophy} style={styles.trophyIcon} contentFit="contain" />
                </View>
              </View>
            </View>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressPct, { color: C.profilePrimary }]}>{pct}%</Text>
              <Text style={[styles.progressLabel, { color: C.profileMuted }]}>
                {t.profile.achievementsProgressLabel}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#DED0F2' }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${pct}%`, backgroundColor: C.profilePrimary },
                ]}
              />
            </View>
            <Text style={[styles.summaryHint, { color: C.profileMuted }]}>
              {t.profile.achievementsUnlockHint}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {(
              [
                ['all', t.profile.achievementsFilterAll],
                ['done', t.profile.achievementsFilterDone],
                ['progress', t.profile.achievementsFilterProgress],
                ['locked', t.profile.achievementsFilterLocked],
              ] as const
            ).map(([id, label]) => (
              <TouchableOpacity
                key={id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: C.profileCard,
                    borderColor: C.profileCardBorder,
                  },
                  filter === id && { backgroundColor: C.profilePrimary, borderColor: C.profilePrimary },
                ]}
                onPress={() => setFilter(id)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: C.profileMuted },
                    filter === id && styles.filterTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.badgeGrid}>
            {filteredBadges.map((badge) => (
              <View
                key={badge.id}
                style={[
                  styles.badgeCard,
                  {
                    backgroundColor: C.profileCard,
                    borderColor: C.embossBorder,
                    borderWidth: 1,
                  },
                  badge.status === 'locked' && styles.badgeCardLocked,
                ]}
              >
                <View style={[styles.badgeIconWrap, { backgroundColor: C.profilePrimarySoft }]}>
                  {badge.status === 'locked' ? (
                    <Ionicons name="lock-closed" size={22} color={C.profileMuted} />
                  ) : (
                    <Image source={PROFILE_ICONS.trophy} style={styles.badgeIcon} contentFit="contain" />
                  )}
                </View>
                <Text style={[styles.badgeTitle, { color: C.textPrimary }]} numberOfLines={2}>
                  {badge.title}
                </Text>
                {badge.status === 'progress' ? (
                  <>
                    <View
                      style={[
                        styles.badgeProgressTrack,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E8E2F0' },
                      ]}
                    >
                      <View
                        style={[
                          styles.badgeProgressFill,
                          {
                            width: `${Math.round((badge.progressPct || 0) * 100)}%`,
                            backgroundColor: C.profilePrimary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.badgeProgressText, { color: C.profileMuted }]}>
                      {badge.progress}
                    </Text>
                  </>
                ) : null}
                <View
                  style={[
                    styles.statusTag,
                    badge.status === 'done' && styles.statusDone,
                    badge.status === 'progress' && styles.statusProgress,
                    badge.status === 'locked' && [
                      styles.statusLocked,
                      isDark && { backgroundColor: 'rgba(255,255,255,0.08)' },
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      badge.status === 'done' && styles.statusTextDone,
                      badge.status === 'progress' && styles.statusTextProgress,
                      badge.status === 'locked' && [
                        styles.statusTextLocked,
                        { color: C.profileMuted },
                      ],
                    ]}
                  >
                    {badge.status === 'done'
                      ? t.profile.achievementsFilterDone
                      : badge.status === 'progress'
                        ? t.profile.achievementsFilterProgress
                        : t.profile.achievementsFilterLocked}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={[styles.rankOverview, { backgroundColor: C.achievementsCard }]}>
            <View style={styles.summaryTitleRow}>
              <View style={styles.summaryCopy}>
                <Text style={[styles.summaryTitle, { color: C.textPrimary }]}>
                  {t.profile.myAchievements}
                </Text>
                <Text style={[styles.summarySub, { color: C.profileMuted }]}>
                  {t.profile.achievementsRanksTagline}
                </Text>
              </View>
              <View style={[styles.trophyBubble, { backgroundColor: C.achievementsIconBg }]}>
                <Image source={PROFILE_ICONS.trophy} style={styles.trophyIcon} contentFit="contain" />
              </View>
            </View>
            <View style={styles.rankMetrics}>
              <View style={styles.rankMetric}>
                <Text style={[styles.rankMetricValue, { color: C.textPrimary }]}>
                  {pad2(ranks.length)}
                </Text>
                <Text style={[styles.rankMetricLabel, { color: C.profileMuted }]}>
                  {t.profile.achievementsCompetitions}
                </Text>
              </View>
              <View style={[styles.rankMetricDivider, { backgroundColor: C.divider }]} />
              <View style={styles.rankMetric}>
                <Text style={[styles.rankMetricValue, { color: C.textPrimary }]}>
                  #{pad2(bestRank)}
                </Text>
                <Text style={[styles.rankMetricLabel, { color: C.profileMuted }]}>
                  {t.profile.achievementsBestRank}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.rankHeading}>
            <Text style={[styles.rankHeadingHint, { color: C.profilePrimary }]}>
              {t.profile.achievementsCurrentRank}
            </Text>
            <Text style={[styles.rankHeadingTitle, { color: C.textPrimary }]}>
              {t.profile.achievementsCompetitionRanks}
            </Text>
          </View>

          <View style={styles.rankList}>
            {ranks.map((row) => (
              <View
                key={row.id}
                style={[
                  styles.rankRow,
                  {
                    backgroundColor: C.profileCard,
                    borderColor: C.embossBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.rankScoreCol}>
                  <Text style={[styles.rankNumber, { color: C.profilePrimary }]}>{row.rank}</Text>
                  <Text style={[styles.rankScore, { color: C.profileMuted }]}>{row.score}</Text>
                </View>
                <View style={styles.rankCopyCol}>
                  <Text style={[styles.rankCompetition, { color: C.textPrimary }]}>
                    {row.competition}
                  </Text>
                  <Text style={[styles.rankPeriod, { color: C.profileMuted }]}>{row.period}</Text>
                </View>
                <View style={[styles.rankIconBubble, { backgroundColor: C.profilePrimarySoft }]}>
                  <Image source={PROFILE_RANK_ICON} style={styles.rankIcon} contentFit="contain" />
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.rankFooter, { color: C.profileMuted }]}>
            {t.profile.achievementsRankFooter}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  segment: {
    height: 51,
    borderRadius: 24,
    backgroundColor: ProfileTheme.colors.profilePrimarySoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    height: 41,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#6C27DE',
  },
  segmentText: {
    color: '#6C27DE',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: ProfileTheme.colors.achievementsCard,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 11,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCount: {
    color: '#261242',
    fontSize: 24,
    fontWeight: '700',
  },
  summaryCountLabel: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 11,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryCopy: {
    alignItems: 'flex-end',
    gap: 4,
  },
  summaryTitle: {
    color: '#261242',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  summarySub: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  trophyBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: ProfileTheme.colors.achievementsIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyIcon: {
    width: 30,
    height: 30,
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPct: {
    color: '#6C27DE',
    fontSize: 13,
    fontWeight: '700',
  },
  progressLabel: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 12,
  },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#DED0F2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: ProfileTheme.colors.profilePrimary,
    alignSelf: 'flex-end',
  },
  summaryHint: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 11.5,
    textAlign: 'right',
  },
  filters: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: ProfileTheme.colors.profilePrimary,
    borderColor: ProfileTheme.colors.profilePrimary,
  },
  filterText: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  badgeCard: {
    width: '48%',
    minHeight: 148,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  badgeCardLocked: {
    opacity: 0.72,
  },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ProfileTheme.colors.profilePrimarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    width: 24,
    height: 24,
  },
  badgeTitle: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  badgeProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 4,
    backgroundColor: '#E8E2F0',
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    backgroundColor: ProfileTheme.colors.profilePrimary,
  },
  badgeProgressText: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 11,
  },
  statusTag: {
    marginTop: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDone: {
    backgroundColor: '#E7F8ED',
  },
  statusProgress: {
    backgroundColor: '#E8F1FF',
  },
  statusLocked: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextDone: {
    color: '#15803D',
  },
  statusTextProgress: {
    color: '#2563EB',
  },
  statusTextLocked: {
    color: '#6B7280',
  },
  rankOverview: {
    backgroundColor: '#F0E7FF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 13,
  },
  rankMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  rankMetric: {
    width: 110,
    alignItems: 'center',
    gap: 1,
  },
  rankMetricValue: {
    color: '#24143F',
    fontSize: 19,
    fontWeight: '700',
  },
  rankMetricLabel: {
    color: '#7F7A93',
    fontSize: 10.5,
  },
  rankMetricDivider: {
    width: 1,
    height: 39,
    backgroundColor: '#E8E2F0',
  },
  rankHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankHeadingHint: {
    color: '#6C27DE',
    fontSize: 11.5,
    fontWeight: '600',
  },
  rankHeadingTitle: {
    color: '#24143F',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  rankList: {
    gap: 9,
  },
  rankRow: {
    height: 82,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankScoreCol: {
    width: 90,
    alignItems: 'center',
    gap: 2,
  },
  rankNumber: {
    color: '#6C27DE',
    fontSize: 23,
    fontWeight: '700',
  },
  rankScore: {
    color: '#7F7A93',
    fontSize: 11,
    fontWeight: '600',
  },
  rankCopyCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 10,
  },
  rankCompetition: {
    color: '#24143F',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  rankPeriod: {
    color: '#7F7A93',
    fontSize: 11.5,
    textAlign: 'right',
  },
  rankIconBubble: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#F3EDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIcon: {
    width: 24,
    height: 24,
  },
  rankFooter: {
    color: '#7F7A93',
    fontSize: 10.5,
    textAlign: 'center',
  },
});
