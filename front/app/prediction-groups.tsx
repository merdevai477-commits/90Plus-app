/**
 * ملك التوقعات — Prediction Groups
 *
 * Opened from the Rank tab ("ملك التوقعات" competition card). A private
 * prediction group where members join by invite code, predict a round of 10
 * matches (winner = 1pt, exact score = 3pts), and compete on group + global
 * leaderboards. UI-only for now (see components/predictionGroups/data.ts).
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  MoreVertical,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../src/i18n';
import { useAppFont, useScreenFont } from '../utils/fontSetup';
import { APP_BG } from '../constants/ui';
import {
  GLASS_BORDER_TOP,
  GLASS_CARD,
  GOLD_PRIMARY,
  GRADIENT_CTA_PURPLE,
  PURPLE_SOFT,
  RADIUS_LG,
  RADIUS_MD,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../constants/tokens';
import {
  CURRENT_ROUND,
  MEMBERS,
  MY_STATS,
  NEXT_ROUND,
  RESULTS_ROUND,
  TOP_GROUPS,
} from '../components/predictionGroups/data';
import {
  GroupHeaderCard,
  GroupRow,
  MatchPredictionCard,
  MemberRow,
  PointsSystemCard,
  SegTabs,
  StatCard,
} from '../components/predictionGroups/parts';

const MAIN_TABS = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'predictions', label: 'التوقعات' },
  { key: 'standings', label: 'الترتيب' },
  { key: 'stats', label: 'الإحصائيات' },
];

const ROUND_TABS = [
  { key: 'current', label: 'الجولة الحالية' },
  { key: 'next', label: 'الجولة القادمة' },
  { key: 'results', label: 'النتائج' },
];

const STANDINGS_FILTERS = [
  { key: 'all', label: 'الترتيب العام' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'week', label: 'هذا الأسبوع' },
];

export default function PredictionGroupsScreen() {
  useScreenFont();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useTranslation();
  const toast = useToast();
  const fontExtra = useAppFont(800);
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);

  const [tab, setTab] = useState('home');
  const [roundTab, setRoundTab] = useState('current');
  const [standingsFilter, setStandingsFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync('90PLUS123');
      setCopied(true);
      toast.showSuccess('تم النسخ', 'تم نسخ كود الدعوة إلى الحافظة');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op */
    }
  }, [toast]);

  const handleInvite = useCallback(async () => {
    try {
      await Share.share({
        message:
          'انضم إلى مجموعة "شلة الكورة" في ملك التوقعات ⚽️\nكود الدعوة: 90PLUS123',
      });
    } catch {
      /* no-op */
    }
  }, []);

  const roundData = useMemo(() => {
    if (roundTab === 'next') return NEXT_ROUND;
    if (roundTab === 'results') return RESULTS_ROUND;
    return CURRENT_ROUND;
  }, [roundTab]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['rgba(124,58,237,0.28)', 'transparent']}
        style={s.ambient}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[s.header, row, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <BackIcon size={24} color="#fff" />
        </Pressable>
        <Text style={[s.headerTitle, { fontFamily: fontExtra }]} numberOfLines={1}>
          ملك التوقعات
        </Text>
        <Pressable
          hitSlop={10}
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <MoreVertical size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
      >
        <GroupHeaderCard
          isRTL={isRTL}
          onCopy={handleCopy}
          onInvite={handleInvite}
          copied={copied}
        />

        <SegTabs tabs={MAIN_TABS} active={tab} onChange={setTab} isRTL={isRTL} />

        {tab === 'home' && (
          <HomeTab isRTL={isRTL} onSeeAll={() => setTab('standings')} />
        )}

        {tab === 'predictions' && (
          <View style={{ gap: 16 }}>
            <SegTabs
              tabs={ROUND_TABS}
              active={roundTab}
              onChange={setRoundTab}
              isRTL={isRTL}
            />
            <PointsSystemCard isRTL={isRTL} />

            <View style={[s.roundHeader, row]}>
              <View style={[{ alignItems: isRTL ? 'flex-end' : 'flex-start' }, { flex: 1 }]}>
                <Text style={[s.roundTitle, { fontFamily: fontExtra }]}>
                  {roundTab === 'results' ? 'الجولة 11' : roundTab === 'next' ? 'الجولة 13' : 'الجولة 12'}
                </Text>
                <Text style={s.roundSub}>
                  {roundTab === 'results'
                    ? 'نتائج الجولة السابقة'
                    : roundTab === 'next'
                    ? 'تفتح بعد انتهاء الجولة الحالية'
                    : 'أكمل توقعاتك قبل بداية المباريات'}
                </Text>
              </View>
              <View style={s.calendarBox}>
                <Calendar size={20} color={PURPLE_SOFT} />
              </View>
            </View>

            {roundData.map((m) => (
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
                onPress={() =>
                  toast.showSuccess('تم الحفظ', 'تم حفظ توقعاتك لهذه الجولة بنجاح')
                }
                style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={GRADIENT_CTA_PURPLE}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.saveBtn}
                >
                  <Text style={[s.saveBtnTxt, { fontFamily: fontBold }]}>حفظ التوقعات</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        )}

        {tab === 'standings' && (
          <View style={{ gap: 16 }}>
            <SegTabs
              tabs={STANDINGS_FILTERS}
              active={standingsFilter}
              onChange={setStandingsFilter}
              isRTL={isRTL}
            />
            <SectionTitle title="ترتيب الأعضاء" isRTL={isRTL} />
            <View style={{ gap: 8 }}>
              {MEMBERS.map((m) => (
                <MemberRow key={m.rank} member={m} isRTL={isRTL} showSubtitle />
              ))}
            </View>
            <SectionTitle title="أفضل 10 مجموعات" isRTL={isRTL} />
            <View style={{ gap: 8 }}>
              {TOP_GROUPS.map((g) => (
                <GroupRow
                  key={g.rank}
                  group={g}
                  isRTL={isRTL}
                  highlight={g.name === 'شلة الكورة'}
                />
              ))}
            </View>
          </View>
        )}

        {tab === 'stats' && <StatsTab isRTL={isRTL} />}
      </ScrollView>
    </View>
  );
}

// ─── Home tab ─────────────────────────────────────────────────────────────────
function HomeTab({ isRTL, onSeeAll }: { isRTL: boolean; onSeeAll: () => void }) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const top5 = MEMBERS.slice(0, 5);
  return (
    <View style={{ gap: 16 }}>
      <View style={[s.sectionHead, row]}>
        <View style={[{ alignItems: 'center', gap: 8 }, row]}>
          <Trophy size={18} color={GOLD_PRIMARY} />
          <Text style={[s.sectionTitle, { fontFamily: fontBold }]}>ترتيب المجموعة</Text>
        </View>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[s.seeAll, { fontFamily: fontSemi }]}>عرض الكل</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        {top5.map((m) => (
          <MemberRow key={m.rank} member={m} isRTL={isRTL} />
        ))}
      </View>

      <View style={s.noteCard}>
        <LinearGradient
          colors={['rgba(124,58,237,0.18)', 'rgba(59,130,246,0.05)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[s.noteTitle, { fontFamily: fontBold, textAlign: isRTL ? 'right' : 'left' }]}>
          أنت في المركز الرابع
        </Text>
        <Text style={[s.noteSub, { textAlign: isRTL ? 'right' : 'left' }]}>
          تفصلك 3 نقاط فقط عن المركز الثالث. أكمل توقعات الجولة 12 لتتقدّم!
        </Text>
      </View>
    </View>
  );
}

// ─── Stats tab ────────────────────────────────────────────────────────────────
function StatsTab({ isRTL }: { isRTL: boolean }) {
  const fontExtra = useAppFont(800);
  const fontBold = useAppFont(700);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const total = MY_STATS.wins + MY_STATS.draws + MY_STATS.losses;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <View style={{ gap: 16 }}>
      <View style={s.totalCard}>
        <LinearGradient
          colors={['rgba(245,197,24,0.16)', 'rgba(124,58,237,0.08)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.totalLabel}>مجموع نقاطك</Text>
        <Text style={[s.totalValue, { fontFamily: fontExtra }]}>{MY_STATS.totalPoints}</Text>
        <Text style={s.totalSub}>من {MY_STATS.predictionsMade} توقع</Text>
      </View>

      <View style={[{ gap: 12 }, row]}>
        <StatCard
          value={String(MY_STATS.wins)}
          label="توقعات صحيحة"
          color="#22C55E"
          icon={<Award size={22} color="#22C55E" />}
        />
        <StatCard
          value={String(MY_STATS.losses)}
          label="توقعات خاطئة"
          color="#EF4444"
          icon={<X size={22} color="#EF4444" />}
        />
      </View>
      <View style={[{ gap: 12 }, row]}>
        <StatCard
          value={`${MY_STATS.accuracy}%`}
          label="نسبة الدقة"
          color="#3B82F6"
          icon={<Target size={22} color="#3B82F6" />}
        />
        <StatCard
          value={String(MY_STATS.bestStreak)}
          label="أطول سلسلة"
          color={GOLD_PRIMARY}
          icon={<Flame size={22} color={GOLD_PRIMARY} />}
        />
      </View>
      <View style={[{ gap: 12 }, row]}>
        <StatCard
          value={String(MY_STATS.exactHits)}
          label="نتائج دقيقة"
          color="#A78BFA"
          icon={<Trophy size={22} color="#A78BFA" />}
        />
        <StatCard
          value={String(MY_STATS.currentStreak)}
          label="السلسلة الحالية"
          color="#F97316"
          icon={<TrendingUp size={22} color="#F97316" />}
        />
      </View>

      {/* record bar */}
      <View style={s.recordCard}>
        <Text style={[s.recordTitle, { fontFamily: fontBold, textAlign: isRTL ? 'right' : 'left' }]}>
          السجل
        </Text>
        <View style={s.recordBar}>
          <View style={[s.recordSeg, { flex: MY_STATS.wins, backgroundColor: '#22C55E' }]} />
          <View style={[s.recordSeg, { flex: MY_STATS.draws, backgroundColor: '#F5C518' }]} />
          <View style={[s.recordSeg, { flex: MY_STATS.losses, backgroundColor: '#EF4444' }]} />
        </View>
        <View style={[s.recordLegend, row]}>
          <RecordLegend color="#22C55E" label={`فوز ${pct(MY_STATS.wins)}`} isRTL={isRTL} />
          <RecordLegend color="#F5C518" label={`تعادل ${pct(MY_STATS.draws)}`} isRTL={isRTL} />
          <RecordLegend color="#EF4444" label={`خسارة ${pct(MY_STATS.losses)}`} isRTL={isRTL} />
        </View>
      </View>
    </View>
  );
}

function RecordLegend({ color, label, isRTL }: { color: string; label: string; isRTL: boolean }) {
  return (
    <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }]}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={s.legendTxt}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, isRTL }: { title: string; isRTL: boolean }) {
  const fontBold = useAppFont(700);
  return (
    <Text style={[s.sectionTitle, { fontFamily: fontBold, textAlign: isRTL ? 'right' : 'left' }]}>
      {title}
    </Text>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BG },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },

  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 19, flex: 1, textAlign: 'center' },

  sectionHead: { alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TEXT_PRIMARY, fontSize: 16 },
  seeAll: { color: PURPLE_SOFT, fontSize: 13 },

  noteCard: {
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    padding: 16,
    overflow: 'hidden',
    gap: 6,
  },
  noteTitle: { color: TEXT_PRIMARY, fontSize: 15 },
  noteSub: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 20 },

  roundHeader: { alignItems: 'center', gap: 12 },
  roundTitle: { color: TEXT_PRIMARY, fontSize: 18 },
  roundSub: { color: TEXT_MUTED, fontSize: 12, marginTop: 3 },
  calendarBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.16)',
  },

  saveBtn: {
    borderRadius: RADIUS_LG,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnTxt: { color: '#fff', fontSize: 15 },

  totalCard: {
    borderRadius: RADIUS_LG + 2,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.3)',
    padding: 20,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  totalLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  totalValue: { color: TEXT_PRIMARY, fontSize: 44 },
  totalSub: { color: TEXT_MUTED, fontSize: 12 },

  recordCard: {
    backgroundColor: GLASS_CARD,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: GLASS_BORDER_TOP,
    padding: 16,
    gap: 12,
  },
  recordTitle: { color: TEXT_PRIMARY, fontSize: 14 },
  recordBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  recordSeg: { height: 12 },
  recordLegend: { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legendTxt: { color: TEXT_SECONDARY, fontSize: 12 },
});
