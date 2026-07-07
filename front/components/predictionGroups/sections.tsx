/**
 * Composed sections for the prediction-groups screens. Each is a self-contained,
 * reusable block; the screen container swaps between them via the main tabs.
 *
 *  - HomeSection        → group main overview (top-5 staggered list + progress).
 *  - LeaderboardSection → full ranking via FlashList, with a "simulate result"
 *                         action that reorders rows (Reanimated layout) and
 *                         counts points up (AnimatedCounter).
 *  - PredictionsSection → round tabs + match cards + save.
 *  - StatsSection       → totals, stat grid, record bar.
 */

import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Award,
  Calendar,
  Flame,
  Gem,
  Target,
  TrendingUp,
  Trophy,
  X as XIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useToast } from '../../contexts/ToastContext';
import { AnimatedCounter } from './AnimatedCounter';
import { AnimatedTabs } from './AnimatedTabs';
import { GlassCard, SimpleStatCard } from './atoms';
import {
  CURRENT_ROUND,
  GROUP,
  GroupMember,
  MEMBERS,
  MY_STATS,
  NEXT_ROUND,
  RESULTS_ROUND,
} from './data';
import { GroupProgressCard } from './GroupProgressCard';
import { HomeLeaderboardRow } from './HomeLeaderboardRow';
import { PurpleTrophyIcon } from './PurpleTrophyIcon';
import { LeaderboardRow } from './LeaderboardRow';
import { MatchPredictionCard } from './MatchPredictionCard';
import { mapRoundMatchToCard } from '../../services/predictionGroups.service';
import type { GroupRoundMatch } from '../../services/predictionGroups.service';
import { PG, PG_GRADIENTS, PG_RADII, PG_SPACING, usePGFonts } from './theme';

// ─── Section title ──────────────────────────────────────────────────────────

export function SectionTitle({
  title,
  icon,
  isRTL,
  onSeeAll,
}: {
  title: string;
  icon?: React.ReactNode;
  isRTL: boolean;
  onSeeAll?: () => void;
}) {
  const { medium, bold } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <View style={[styles.sectionHead, row]}>
      <View style={[styles.sectionHeadLeft, row]}>
        {icon}
        <Text style={[styles.sectionTitle, { fontFamily: bold }]}>{title}</Text>
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAll, { fontFamily: medium }]}>عرض الكل</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────

export function HomeSection({ isRTL, onSeeAll }: { isRTL: boolean; onSeeAll: () => void }) {
  const top5 = MEMBERS.slice(0, 5);
  return (
    <View style={{ gap: PG_SPACING.lg }}>
      <SectionTitle
        title="ترتيب المجموعة"
        icon={<Trophy size={18} color={PG.gold} />}
        isRTL={isRTL}
        onSeeAll={onSeeAll}
      />
      <View style={{ gap: 8 }}>
        {top5.map((m, i) => (
          <Animated.View
            key={m.name}
            entering={FadeInDown.delay(i * 60)
              .duration(420)
              .springify()
              .damping(16)}
          >
            <LeaderboardRow member={m} isRTL={isRTL} animatePoints={false} showPoints={false} />
          </Animated.View>
        ))}
      </View>

      <GroupProgressCard
        rank={GROUP.myRank}
        myPoints={GROUP.myPoints}
        abovePoints={GROUP.myPoints + GROUP.pointsToNext}
        isRTL={isRTL}
      />
    </View>
  );
}

export { GroupsStandingsSection } from './GroupsStandingsSection';

function reRank(members: GroupMember[]): GroupMember[] {
  return [...members]
    .sort((a, b) => b.points - a.points)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

export function LeaderboardSection({
  isRTL,
  contentPaddingBottom,
  embedded = false,
}: {
  isRTL: boolean;
  contentPaddingBottom: number;
  /** When true, render inside the main ScrollView (reference full-tab layout). */
  embedded?: boolean;
}) {
  const { medium, bold, extra } = usePGFonts();
  const [members, setMembers] = useState<GroupMember[]>(() => reRank(MEMBERS));
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const simulate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMembers((prev) =>
      reRank(
        prev.map((m) => ({
          ...m,
          points: m.points + Math.floor(Math.random() * 6),
        })),
      ),
    );
  }, []);

  const periodTabs = (
    <View style={[styles.periodTabs, row]}>
      {(
        [
          { key: 'all' as const, label: 'الترتيب العام' },
          { key: 'week' as const, label: 'هذا الأسبوع' },
          { key: 'month' as const, label: 'هذا الشهر' },
        ] as const
      ).map((tab) => (
        <Pressable key={tab.key} onPress={() => setPeriod(tab.key)} hitSlop={6}>
          <Text
            style={[
              styles.periodTab,
              { fontFamily: medium },
              period === tab.key && styles.periodTabActive,
              period === tab.key && { fontFamily: bold },
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const gradientHeader = (
    <LinearGradient
      colors={['rgba(20,14,32,0.98)', 'rgba(10,8,18,0.99)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fullHeader}
    >
      <PurpleTrophyIcon size={44} />
      <Text style={[styles.fullHeaderTitle, { fontFamily: extra }]}>ترتيب المجموعة</Text>
    </LinearGradient>
  );

  const tableHeader = (
    <View style={[styles.tableHeader, row]}>
      <Text style={[styles.tableHeaderText, { fontFamily: medium }]}>النقاط</Text>
      <Text style={[styles.tableHeaderText, { fontFamily: medium }]}>الاسم</Text>
      <Text style={[styles.tableHeaderText, { fontFamily: medium }]}>الترتيب</Text>
    </View>
  );

  if (embedded) {
    return (
      <View style={styles.embeddedWrap}>
        {gradientHeader}
        {periodTabs}
        {tableHeader}
        {members.map((item) => (
          <HomeLeaderboardRow key={item.name} member={item} isRTL={isRTL} />
        ))}
      </View>
    );
  }

  const header = (
    <View style={{ gap: PG_SPACING.md, paddingBottom: PG_SPACING.md }}>
      {gradientHeader}
      {periodTabs}
      {tableHeader}
      <View style={[styles.sectionHead, row]}>
        <Pressable onPress={simulate} hitSlop={8} style={styles.simBtn}>
          <Text style={[styles.simTxt, { fontFamily: medium }]}>محاكاة نتيجة</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={members}
        keyExtractor={(m) => m.name}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentPaddingBottom }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Animated.View layout={LinearTransition.springify().damping(18)}>
            <LeaderboardRow member={item} isRTL={isRTL} showSubtitle />
          </Animated.View>
        )}
      />
    </View>
  );
}

// ─── Predictions ────────────────────────────────────────────────────────────

const ROUND_TABS = [
  { key: 'current', label: 'الجولة الحالية' },
  { key: 'next', label: 'الجولة القادمة' },
  { key: 'results', label: 'النتائج' },
];

function PointsSystemCard({ isRTL }: { isRTL: boolean }) {
  const { medium, bold } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <GlassCard style={styles.pointsCard}>
      <Text style={[styles.pointsCardTitle, { fontFamily: bold, textAlign: isRTL ? 'right' : 'left' }]}>
        نظام النقاط
      </Text>
      <View style={[styles.pointsCols, row]}>
        <View style={[styles.pointsCol, row]}>
          <View style={[styles.pointsIcon, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
            <Target size={18} color={PG.purpleSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pointsColTitle, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
              توقع الفائز أو التعادل
            </Text>
            <Text style={[styles.pointsColValue, { fontFamily: bold, textAlign: isRTL ? 'right' : 'left', color: PG.purpleSoft }]}>
              2 XP
            </Text>
          </View>
        </View>

        <View style={styles.pointsDivider} />

        <View style={[styles.pointsCol, row]}>
          <View style={[styles.pointsIcon, { backgroundColor: 'rgba(245,185,66,0.18)' }]}>
            <Gem size={18} color={PG.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pointsColTitle, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
              النتيجة الدقيقة
            </Text>
            <Text style={[styles.pointsColValue, { fontFamily: bold, textAlign: isRTL ? 'right' : 'left', color: PG.gold }]}>
              5 XP
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

export function PredictionsSection({
  isRTL,
  groupId,
  roundMatches,
  roundMeta,
  onSave,
}: {
  isRTL: boolean;
  groupId?: string;
  roundMatches?: GroupRoundMatch[];
  roundMeta?: { id: string; date: string; status: string } | null;
  onSave?: (
    predictions: Array<{
      apiMatchId: number;
      mode: 'WINNER' | 'EXACT';
      predictedWinner?: 'home' | 'draw' | 'away';
      predictedHomeScore?: number;
      predictedAwayScore?: number;
    }>,
  ) => Promise<void>;
}) {
  const { medium, bold, extra } = usePGFonts();
  const toast = useToast();
  const [roundTab, setRoundTab] = useState('current');
  const [drafts, setDrafts] = useState<
    Record<number, { mode: 'WINNER' | 'EXACT'; home: number; away: number; winner: 'home' | 'draw' | 'away' | null }>
  >({});
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  const apiMode = Boolean(groupId && roundMatches && onSave);

  useEffect(() => {
    if (!roundMatches?.length) return;
    const seeded: typeof drafts = {};
    for (const m of roundMatches) {
      if (!m.prediction) continue;
      const p = m.prediction;
      seeded[m.apiMatchId] = {
        mode: p.mode,
        home: p.predictedHomeScore ?? 0,
        away: p.predictedAwayScore ?? 0,
        winner: (p.predictedWinner as 'home' | 'draw' | 'away' | null) ?? null,
      };
    }
    if (Object.keys(seeded).length > 0) {
      setDrafts((prev) => ({ ...seeded, ...prev }));
    }
  }, [roundMatches]);

  const data = useMemo(() => {
    if (apiMode && roundMatches) {
      return roundMatches.map(mapRoundMatchToCard);
    }
    if (roundTab === 'next') return NEXT_ROUND;
    if (roundTab === 'results') return RESULTS_ROUND;
    return CURRENT_ROUND;
  }, [apiMode, roundMatches, roundTab]);

  const roundMetaDisplay = useMemo(() => {
    if (apiMode && roundMeta) {
      return {
        title: 'الجولة الأولى',
        sub: 'أهم 10 مباريات اليوم — أكمل توقعاتك قبل انطلاق المباريات',
      };
    }
    if (roundTab === 'results')
      return { title: 'الجولة 11', sub: 'نتائج الجولة السابقة' };
    if (roundTab === 'next')
      return { title: 'الجولة 13', sub: 'تفتح بعد انتهاء الجولة الحالية' };
    return { title: 'الجولة 12', sub: 'أكمل توقعاتك قبل انطلاق المباريات' };
  }, [apiMode, roundMeta, roundTab]);

  const handleDraft = useCallback(
    (
      apiMatchId: number,
      patch: Partial<{ mode: 'WINNER' | 'EXACT'; home: number; away: number; winner: 'home' | 'draw' | 'away' | null }>,
    ) => {
      setDrafts((prev) => ({
        ...prev,
        [apiMatchId]: {
          mode: patch.mode ?? prev[apiMatchId]?.mode ?? 'WINNER',
          home: patch.home ?? prev[apiMatchId]?.home ?? 0,
          away: patch.away ?? prev[apiMatchId]?.away ?? 0,
          winner: patch.winner !== undefined ? patch.winner : (prev[apiMatchId]?.winner ?? null),
        },
      }));
    },
    [],
  );

  const onSavePress = useCallback(async () => {
    if (!apiMode || !onSave) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.showSuccess('تم الحفظ', 'تم حفظ توقعاتك لهذه الجولة بنجاح');
      return;
    }

    const predictions = Object.entries(drafts).map(([id, d]) => {
      const apiMatchId = Number(id);
      if (d.mode === 'EXACT') {
        let predictedWinner: 'home' | 'draw' | 'away' = 'draw';
        if (d.home > d.away) predictedWinner = 'home';
        else if (d.away > d.home) predictedWinner = 'away';
        return {
          apiMatchId,
          mode: 'EXACT' as const,
          predictedHomeScore: d.home,
          predictedAwayScore: d.away,
          predictedWinner,
        };
      }
      const predictedWinner = d.winner ?? 'home';
      return {
        apiMatchId,
        mode: 'WINNER' as const,
        predictedWinner,
        predictedHomeScore: d.home,
        predictedAwayScore: d.away,
      };
    });

    if (predictions.length === 0) {
      toast.showError('لا توجد توقعات', 'اختر وضع التوقع لكل مباراة');
      return;
    }

    try {
      await onSave(predictions);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.showSuccess('تم الحفظ', 'تم حفظ توقعاتك لهذه الجولة بنجاح');
    } catch (e: any) {
      toast.showError('تعذر الحفظ', e?.message ?? '');
    }
  }, [apiMode, drafts, onSave, toast]);

  return (
    <View style={{ gap: PG_SPACING.lg }}>
      {!apiMode && (
        <AnimatedTabs tabs={ROUND_TABS} activeKey={roundTab} onChange={setRoundTab} isRTL={isRTL} />
      )}

      <PointsSystemCard isRTL={isRTL} />

      <View style={styles.roundCard}>
        <LinearGradient
          colors={PG_GRADIENTS.roundWash}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.roundHead, row]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roundTitle, { fontFamily: extra, textAlign: align }]}>
              {roundMetaDisplay.title}
            </Text>
            <Text style={[styles.roundSub, { fontFamily: medium, textAlign: align }]}>
              {roundMetaDisplay.sub}
            </Text>
          </View>
          <View style={styles.calBox}>
            <Calendar size={20} color={PG.purpleSoft} />
          </View>
        </View>
      </View>

      {data.map((m) => {
        const apiMatchId = (m as { apiMatchId?: number }).apiMatchId;
        const status = (m as { status?: string }).status;
        const locked = apiMode
          ? status !== 'NS' && status !== 'TBD' && status !== ''
          : roundTab === 'next';
        const finished = apiMode
          ? status === 'FT' || status === 'AET' || status === 'PEN'
          : roundTab === 'results';
        return (
          <MatchPredictionCard
            key={m.id}
            match={m}
            isRTL={isRTL}
            locked={locked}
            finished={finished}
            apiMatchId={apiMatchId}
            initialPrediction={(m as { prediction?: GroupRoundMatch['prediction'] }).prediction}
            onDraftChange={
              apiMatchId
                ? (patch) => handleDraft(apiMatchId, patch)
                : undefined
            }
          />
        );
      })}

      {(apiMode || roundTab === 'current') && (
        <Pressable
          onPress={() => void onSavePress()}
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={PG_GRADIENTS.purple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            <Text style={[styles.saveTxt, { fontFamily: bold }]}>حفظ التوقعات</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────

export function StatsSection({ isRTL }: { isRTL: boolean }) {
  const { medium, bold, extra } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';
  const total = MY_STATS.wins + MY_STATS.draws + MY_STATS.losses;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <View style={{ gap: PG_SPACING.lg }}>
      <GlassCard style={styles.totalCard}>
        <LinearGradient
          colors={['rgba(245,185,66,0.16)', 'rgba(124,58,237,0.08)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.totalLabel, { fontFamily: medium }]}>مجموع نقاطك</Text>
        <AnimatedCounter
          value={MY_STATS.totalPoints}
          style={[styles.totalValue, { fontFamily: extra }]}
        />
        <Text style={[styles.totalSub, { fontFamily: medium }]}>
          من {MY_STATS.predictionsMade} توقع
        </Text>
      </GlassCard>

      <View style={[{ gap: 12 }, row]}>
        <SimpleStatCard value={String(MY_STATS.wins)} label="توقعات صحيحة" color={PG.win} icon={<Award size={22} color={PG.win} />} />
        <SimpleStatCard value={String(MY_STATS.losses)} label="توقعات خاطئة" color={PG.loss} icon={<XIcon size={22} color={PG.loss} />} />
      </View>
      <View style={[{ gap: 12 }, row]}>
        <SimpleStatCard value={`${MY_STATS.accuracy}%`} label="نسبة الدقة" color={PG.info} icon={<Target size={22} color={PG.info} />} />
        <SimpleStatCard value={String(MY_STATS.bestStreak)} label="أطول سلسلة" color={PG.gold} icon={<Flame size={22} color={PG.gold} />} />
      </View>
      <View style={[{ gap: 12 }, row]}>
        <SimpleStatCard value={String(MY_STATS.exactHits)} label="نتائج دقيقة" color={PG.purpleSoft} icon={<Trophy size={22} color={PG.purpleSoft} />} />
        <SimpleStatCard value={String(MY_STATS.currentStreak)} label="السلسلة الحالية" color={PG.goldDeep} icon={<TrendingUp size={22} color={PG.goldDeep} />} />
      </View>

      <GlassCard style={styles.recordCard}>
        <Text style={[styles.recordTitle, { fontFamily: bold, textAlign: align }]}>السجل</Text>
        <View style={styles.recordBar}>
          <View style={[styles.recordSeg, { flex: MY_STATS.wins, backgroundColor: PG.win }]} />
          <View style={[styles.recordSeg, { flex: MY_STATS.draws, backgroundColor: PG.draw }]} />
          <View style={[styles.recordSeg, { flex: MY_STATS.losses, backgroundColor: PG.loss }]} />
        </View>
        <View style={[styles.recordLegend, row]}>
          <Legend color={PG.win} label={`فوز ${pct(MY_STATS.wins)}`} isRTL={isRTL} />
          <Legend color={PG.draw} label={`تعادل ${pct(MY_STATS.draws)}`} isRTL={isRTL} />
          <Legend color={PG.loss} label={`خسارة ${pct(MY_STATS.losses)}`} isRTL={isRTL} />
        </View>
      </GlassCard>
    </View>
  );
}

function Legend({ color, label, isRTL }: { color: string; label: string; isRTL: boolean }) {
  const { medium } = usePGFonts();
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={[styles.legendTxt, { fontFamily: medium }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { alignItems: 'center', justifyContent: 'space-between' },
  sectionHeadLeft: { alignItems: 'center', gap: 8 },
  sectionTitle: { color: PG.text, fontSize: 16 },
  seeAll: { color: PG.purpleSoft, fontSize: 13 },

  simBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: PG_RADII.sm,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.35)',
    alignSelf: 'flex-end',
  },
  simTxt: { color: PG.purpleSoft, fontSize: 12 },

  embeddedWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  fullHeader: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  fullHeaderTitle: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  periodTabs: {
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  periodTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 12,
    color: PG.textMuted,
    backgroundColor: PG.card,
  },
  periodTabActive: {
    backgroundColor: PG.primary,
    color: '#FFFFFF',
  },
  tableHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    color: PG.textMuted,
    flex: 1,
    textAlign: 'center',
  },

  roundCard: {
    borderRadius: PG_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.3)',
    padding: 16,
    overflow: 'hidden',
    gap: 12,
  },
  roundHead: { alignItems: 'center', gap: 12 },
  roundTitle: { color: PG.text, fontSize: 18 },
  roundSub: { color: PG.textSecondary, fontSize: 12, marginTop: 3 },
  calBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)',
  },
  pointsCard: { padding: 14, gap: 12 },
  pointsCardTitle: { color: PG.text, fontSize: 14 },
  pointsCols: { alignItems: 'center', gap: 12 },
  pointsCol: { flex: 1, alignItems: 'center', gap: 8 },
  pointsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsColTitle: { color: PG.textSecondary, fontSize: 11 },
  pointsColValue: { fontSize: 13, marginTop: 1 },
  pointsDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.08)' },

  saveBtn: {
    borderRadius: PG_RADII.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PG.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  saveTxt: { color: '#fff', fontSize: 15 },

  totalCard: { padding: 20, alignItems: 'center', gap: 4 },
  totalLabel: { color: PG.textSecondary, fontSize: 13 },
  totalValue: { color: PG.text, fontSize: 44, padding: 0, textAlign: 'center' },
  totalSub: { color: PG.textMuted, fontSize: 12 },

  recordCard: { padding: 16, gap: 12 },
  recordTitle: { color: PG.text, fontSize: 14 },
  recordBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  recordSeg: { height: 12 },
  recordLegend: { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legendTxt: { color: PG.textSecondary, fontSize: 12 },
});
