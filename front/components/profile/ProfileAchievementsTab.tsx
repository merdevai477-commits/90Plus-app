import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useProfileTheme } from '../../hooks/useProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS, PROFILE_RANK_ICON } from './profileV2Assets';
import { getApiUrl } from '../../config/api.config';
import { getClerkBearerToken } from '../../utils/clerkAuthToken';
import BadgeIcon from '../identity/BadgeIcon';

type AchievementsSubTab = 'titles' | 'ranks';
type BadgeFilter = 'all' | 'done' | 'progress' | 'locked';

interface BadgeItem {
  id: string;
  title: string;
  status: 'done' | 'progress' | 'locked';
  progress?: string;
  progressPct?: number;
  badgeKey?: string;
  accent?: string | null;
  kind?: 'elite' | 'milestone';
}

interface RankRow {
  id: string;
  competition: string;
  period: string;
  rank: string;
  rankNumber: number | null;
  score: string;
}

interface ApiTitle {
  id: string;
  kind: 'elite' | 'milestone';
  key: string;
  titleAr: string;
  titleEn: string;
  accent?: string | null;
  status: 'done' | 'progress' | 'locked';
  progress?: string | null;
  progressPct?: number | null;
}

interface ApiStand {
  id: string;
  competitionKey: 'king_results' | 'king_predictions' | 'top_scorers' | 'coach_king' | 'share_win';
  periodKey: 'week' | 'season' | 'round' | 'month';
  rank: number | null;
  score: number;
  scoreLabel: 'xp' | 'points' | 'participants';
}

interface Props {
  userId: string;
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

export function ProfileAchievementsTab({ userId }: Props) {
  const { t, language } = useTranslation();
  const { colors: C, isDark } = useProfileTheme();
  const { getToken } = useAuth();
  const isAr = language === 'ar';
  const [subTab, setSubTab] = useState<AchievementsSubTab>('titles');
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [titles, setTitles] = useState<ApiTitle[]>([]);
  const [stands, setStands] = useState<ApiStand[]>([]);

  const load = useCallback(async () => {
    if (!userId || userId.startsWith('user_')) {
      setTitles([]);
      setStands([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token = await getClerkBearerToken(getToken);
      const res = await fetch(`${getApiUrl()}/profile/users/${userId}/achievements`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json?.data;
      setTitles(Array.isArray(data?.titles) ? data.titles : []);
      setStands(Array.isArray(data?.stands) ? data.stands : []);
    } catch {
      setError(true);
      setTitles([]);
      setStands([]);
    } finally {
      setLoading(false);
    }
  }, [userId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const competitionLabel = useCallback(
    (key: ApiStand['competitionKey']) => {
      switch (key) {
        case 'king_results':
          return t.profile.achievementsResultsKing;
        case 'king_predictions':
          return t.profile.achievementsPredictionsKing;
        case 'top_scorers':
          return t.profile.achievementsScorersCup;
        case 'coach_king':
          return t.profile.achievementsCoachKing;
        case 'share_win':
          return t.profile.achievementsShareWin;
        default:
          return key;
      }
    },
    [t],
  );

  const periodLabel = useCallback(
    (key: ApiStand['periodKey']) => {
      switch (key) {
        case 'week':
          return t.profile.achievementsPeriodWeek;
        case 'season':
          return t.profile.achievementsPeriodSeason;
        case 'round':
          return t.profile.achievementsPeriodRound;
        case 'month':
          return t.profile.achievementsPeriodMonth;
        default:
          return key;
      }
    },
    [t],
  );

  const scoreLabel = useCallback(
    (row: ApiStand) => {
      const count = formatCount(row.score);
      if (row.scoreLabel === 'xp') {
        return (t.profile.achievementsXp || '{count} XP').replace('{count}', count);
      }
      if (row.scoreLabel === 'participants') {
        return (t.profile.achievementsParticipants || '{count}').replace('{count}', count);
      }
      return t.profile.achievementsPoints.replace('{count}', count);
    },
    [t],
  );

  const badges = useMemo<BadgeItem[]>(
    () =>
      titles.map((row) => ({
        id: row.id,
        title: language === 'ar' ? row.titleAr : row.titleEn,
        status: row.status,
        progress: row.progress ?? undefined,
        progressPct: row.progressPct ?? undefined,
        badgeKey: row.kind === 'elite' ? row.key : undefined,
        accent: row.accent,
        kind: row.kind,
      })),
    [titles, language],
  );

  const ranks = useMemo<RankRow[]>(
    () =>
      stands.map((row) => ({
        id: row.id,
        competition: competitionLabel(row.competitionKey),
        period: periodLabel(row.periodKey),
        rank:
          row.rank != null && row.rank > 0
            ? `#${pad2(row.rank)}`
            : t.profile.achievementsUnranked || '—',
        rankNumber: row.rank != null && row.rank > 0 ? row.rank : null,
        score: scoreLabel(row),
      })),
    [stands, competitionLabel, periodLabel, scoreLabel, t],
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
    if (row.rankNumber == null) return best;
    return row.rankNumber < best ? row.rankNumber : best;
  }, Number.POSITIVE_INFINITY);
  const bestRankDisplay = Number.isFinite(bestRank) ? bestRank : null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={C.profilePrimary} />
        <Text style={[styles.loadingText, { color: C.profileMuted }]}>
          {t.profile.achievementsLoading || t.profile.achievements}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.loadingText, { color: C.profileMuted }]}>
          {t.profile.achievementsLoadError || t.profile.noAchievements}
        </Text>
        <TouchableOpacity onPress={() => void load()} activeOpacity={0.85}>
          <Text style={{ color: C.profilePrimary, fontWeight: '700' }}>
            {t.common.retry}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const segmentItems = (
    [
      ['titles', t.profile.achievementsMyTitles],
      ['ranks', t.profile.achievementsMyRanking],
    ] as const
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.segment,
          isAr ? styles.rowReverse : styles.rowForward,
          { backgroundColor: C.profilePrimarySoft },
        ]}
      >
        {segmentItems.map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[
              styles.segmentBtn,
              subTab === id && [styles.segmentBtnActive, { backgroundColor: C.profilePrimary }],
            ]}
            onPress={() => setSubTab(id)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.segmentText,
                { color: C.profilePrimary },
                subTab === id && styles.segmentTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === 'titles' ? (
        <>
          <View style={[styles.summaryCard, { backgroundColor: C.achievementsCard }]}>
            <View style={[styles.summaryTop, isAr ? styles.rowReverse : styles.rowForward]}>
              <View style={[styles.summaryTitleRow, isAr ? styles.rowForward : styles.rowReverse]}>
                <View style={[styles.trophyBubble, { backgroundColor: C.achievementsIconBg }]}>
                  <Image source={PROFILE_ICONS.trophy} style={styles.trophyIcon} contentFit="contain" />
                </View>
                <View style={[styles.summaryCopy, isAr ? styles.alignEnd : styles.alignStart]}>
                  <Text style={[styles.summaryTitle, { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' }]}>
                    {t.profile.myAchievements}
                  </Text>
                  <Text style={[styles.summarySub, { color: C.profileMuted, textAlign: isAr ? 'right' : 'left' }]}>
                    {t.profile.achievementsTitlesTagline}
                  </Text>
                </View>
              </View>
              <View style={isAr ? styles.alignStart : styles.alignEnd}>
                <Text style={[styles.summaryCount, { color: C.textPrimary, textAlign: isAr ? 'left' : 'right' }]}>
                  {pad2(doneCount)} / {pad2(totalCount)}
                </Text>
                <Text style={[styles.summaryCountLabel, { color: C.profileMuted, textAlign: isAr ? 'left' : 'right' }]}>
                  {t.profile.achievementsCompletedLabel}
                </Text>
              </View>
            </View>
            <View style={[styles.progressLabels, isAr ? styles.rowReverse : styles.rowForward]}>
              <Text style={[styles.progressLabel, { color: C.profileMuted }]}>
                {t.profile.achievementsProgressLabel}
              </Text>
              <Text style={[styles.progressPct, { color: C.profilePrimary }]}>{pct}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : C.profilePrimarySoft }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: C.profilePrimary,
                    alignSelf: isAr ? 'flex-end' : 'flex-start',
                  },
                ]}
              />
            </View>
            <Text style={[styles.summaryHint, { color: C.profileMuted, textAlign: isAr ? 'right' : 'left' }]}>
              {t.profile.achievementsUnlockHint}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filters, isAr ? styles.rowReverse : styles.rowForward]}
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

          {filteredBadges.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.profileMuted }]}>
              {t.profile.noAchievements}
            </Text>
          ) : (
            <View style={styles.badgeGrid}>
              {filteredBadges.map((badge) => (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: C.profileCard,
                      borderColor: badge.status === 'done'
                        ? (badge.accent || C.profilePrimary)
                        : C.embossBorder,
                      borderWidth: badge.status === 'done' ? 1.5 : 1,
                      shadowColor: C.embossShadow,
                    },
                    badge.status === 'locked' && styles.badgeCardLocked,
                  ]}
                >
                  <View
                    style={[
                      styles.badgeIconWrap,
                      {
                        backgroundColor:
                          badge.status === 'done'
                            ? `${badge.accent || C.profilePrimary}22`
                            : C.profilePrimarySoft,
                      },
                    ]}
                  >
                    {badge.status === 'locked' ? (
                      <Ionicons name="lock-closed" size={22} color={C.profileMuted} />
                    ) : badge.badgeKey ? (
                      <BadgeIcon
                        badgeKey={badge.badgeKey}
                        accent={badge.accent || C.profilePrimary}
                        variant="card"
                        size={28}
                      />
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
          )}
        </>
      ) : (
        <>
          <View style={[styles.rankOverview, { backgroundColor: C.achievementsCard }]}>
            <View style={[styles.summaryTitleRow, isAr ? styles.rowForward : styles.rowReverse]}>
              <View style={[styles.trophyBubble, { backgroundColor: C.achievementsIconBg }]}>
                <Image source={PROFILE_ICONS.trophy} style={styles.trophyIcon} contentFit="contain" />
              </View>
              <View style={[styles.summaryCopy, isAr ? styles.alignEnd : styles.alignStart]}>
                <Text style={[styles.summaryTitle, { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' }]}>
                  {t.profile.myAchievements}
                </Text>
                <Text style={[styles.summarySub, { color: C.profileMuted, textAlign: isAr ? 'right' : 'left' }]}>
                  {t.profile.achievementsRanksTagline}
                </Text>
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
                  {bestRankDisplay != null ? `#${pad2(bestRankDisplay)}` : t.profile.achievementsUnranked || '—'}
                </Text>
                <Text style={[styles.rankMetricLabel, { color: C.profileMuted }]}>
                  {t.profile.achievementsBestRank}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.rankHeading, isAr ? styles.rowReverse : styles.rowForward]}>
            <Text style={[styles.rankHeadingTitle, { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' }]}>
              {t.profile.achievementsCompetitionRanks}
            </Text>
            <Text style={[styles.rankHeadingHint, { color: C.profilePrimary }]}>
              {t.profile.achievementsCurrentRank}
            </Text>
          </View>

          <View style={styles.rankList}>
            {ranks.map((row) => (
              <View
                key={row.id}
                style={[
                  styles.rankRow,
                  isAr ? styles.rowReverse : styles.rowForward,
                  {
                    backgroundColor: C.profileCard,
                    borderColor: C.embossBorder,
                    borderWidth: 1,
                    shadowColor: C.embossShadow,
                  },
                ]}
              >
                <View style={[styles.rankIconBubble, { backgroundColor: C.profilePrimarySoft }]}>
                  <Image source={PROFILE_RANK_ICON} style={styles.rankIcon} contentFit="contain" />
                </View>
                <View style={[styles.rankCopyCol, isAr ? styles.alignEnd : styles.alignStart]}>
                  <Text
                    style={[
                      styles.rankCompetition,
                      { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' },
                    ]}
                  >
                    {row.competition}
                  </Text>
                  <Text
                    style={[
                      styles.rankPeriod,
                      { color: C.profileMuted, textAlign: isAr ? 'right' : 'left' },
                    ]}
                  >
                    {row.period}
                  </Text>
                </View>
                <View style={styles.rankScoreCol}>
                  <Text style={[styles.rankNumber, { color: C.profilePrimary }]}>{row.rank}</Text>
                  <Text style={[styles.rankScore, { color: C.profileMuted }]}>{row.score}</Text>
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 20,
  },
  rowForward: {
    flexDirection: 'row',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  segment: {
    height: 51,
    borderRadius: 24,
    backgroundColor: ProfileTheme.colors.profilePrimarySoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 12,
    alignItems: 'center',
    gap: 8,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  badgeCardLocked: {
    opacity: 0.68,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    flex: 1,
  },
  rankList: {
    gap: 9,
  },
  rankRow: {
    minHeight: 82,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
    gap: 4,
    paddingHorizontal: 10,
  },
  rankCompetition: {
    color: '#24143F',
    fontSize: 15,
    fontWeight: '700',
  },
  rankPeriod: {
    color: '#7F7A93',
    fontSize: 11.5,
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
