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
  Target,
  TrendingUp,
  Trophy,
  X as XIcon,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useToast } from '../../contexts/ToastContext';
import { AnimatedCounter } from './AnimatedCounter';
import { AnimatedTabs } from './AnimatedTabs';
import { GlassCard, StatCard } from './atoms';
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
import { LeaderboardRow } from './LeaderboardRow';
import { MatchPredictionCard } from './MatchPredictionCard';
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
            <LeaderboardRow member={m} isRTL={isRTL} animatePoints={false} />
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

// ─── Leaderboard ──────────────────────────────────────────────────────────

function reRank(members: GroupMember[]): GroupMember[] {
  return [...members]
    .sort((a, b) => b.points - a.points)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

export function LeaderboardSection({
  isRTL,
  contentPaddingBottom,
}: {
  isRTL: boolean;
  contentPaddingBottom: number;
}) {
  const { medium, bold } = usePGFonts();
  const [members, setMembers] = useState<GroupMember[]>(() => reRank(MEMBERS));

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

  const header = (
    <View style={{ gap: PG_SPACING.md, paddingBottom: PG_SPACING.md }}>
      <View style={[styles.sectionHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.sectionHeadLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Trophy size={18} color={PG.gold} />
          <Text style={[styles.sectionTitle, { fontFamily: bold }]}>الترتيب الكامل</Text>
        </View>
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
  { key: 'next', label: 'القادمة' },
  { key: 'current', label: 'الحالية' },
  { key: 'results', label: 'النتائج' },
];

export function PredictionsSection({ isRTL }: { isRTL: boolean }) {
  const { medium, bold, extra } = usePGFonts();
  const toast = useToast();
  const [roundTab, setRoundTab] = useState('current');
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  const data = useMemo(() => {
    if (roundTab === 'next') return NEXT_ROUND;
    if (roundTab === 'results') return RESULTS_ROUND;
    return CURRENT_ROUND;
  }, [roundTab]);

  const roundMeta = useMemo(() => {
    if (roundTab === 'results')
      return { title: 'الجولة 11', sub: 'نتائج الجولة السابقة' };
    if (roundTab === 'next')
      return { title: 'الجولة 13', sub: 'تفتح بعد انتهاء الجولة الحالية' };
    return { title: 'الجولة 12', sub: 'أكمل توقعاتك قبل انطلاق المباريات' };
  }, [roundTab]);

  const onSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess('تم الحفظ', 'تم حفظ توقعاتك لهذه الجولة بنجاح');
  }, [toast]);

  return (
    <View style={{ gap: PG_SPACING.lg }}>
      <AnimatedTabs tabs={ROUND_TABS} activeKey={roundTab} onChange={setRoundTab} isRTL={isRTL} />

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
              {roundMeta.title}
            </Text>
            <Text style={[styles.roundSub, { fontFamily: medium, textAlign: align }]}>
              {roundMeta.sub}
            </Text>
          </View>
          <View style={styles.calBox}>
            <Calendar size={20} color={PG.purpleSoft} />
          </View>
        </View>
        <View style={[styles.pointsSystem, row]}>
          <Text style={[styles.pointsSystemTxt, { fontFamily: medium }]}>
            فائز/تعادل = نقطة · نتيجة دقيقة = 3 نقاط
          </Text>
        </View>
      </View>

      {data.map((m) => (
        <MatchPredictionCard
          key={m.id}
          match={m}
          isRTL={isRTL}
          locked={roundTab === 'next'}
          finished={roundTab === 'results'}
        />
      ))}

      {roundTab === 'current' && (
        <Pressable
          onPress={onSave}
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
        <StatCard value={String(MY_STATS.wins)} label="توقعات صحيحة" color={PG.win} icon={<Award size={22} color={PG.win} />} />
        <StatCard value={String(MY_STATS.losses)} label="توقعات خاطئة" color={PG.loss} icon={<XIcon size={22} color={PG.loss} />} />
      </View>
      <View style={[{ gap: 12 }, row]}>
        <StatCard value={`${MY_STATS.accuracy}%`} label="نسبة الدقة" color={PG.info} icon={<Target size={22} color={PG.info} />} />
        <StatCard value={String(MY_STATS.bestStreak)} label="أطول سلسلة" color={PG.gold} icon={<Flame size={22} color={PG.gold} />} />
      </View>
      <View style={[{ gap: 12 }, row]}>
        <StatCard value={String(MY_STATS.exactHits)} label="نتائج دقيقة" color={PG.purpleSoft} icon={<Trophy size={22} color={PG.purpleSoft} />} />
        <StatCard value={String(MY_STATS.currentStreak)} label="السلسلة الحالية" color="#F97316" icon={<TrendingUp size={22} color="#F97316" />} />
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
  },
  simTxt: { color: PG.purpleSoft, fontSize: 12 },

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
  pointsSystem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  pointsSystemTxt: { color: PG.textMuted, fontSize: 12 },

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
