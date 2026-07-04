/**
 * Reusable UI parts for the "ملك التوقعات" prediction-groups feature.
 * All styling is derived from the 90Plus design tokens so it matches the app.
 */

import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  Lock,
  Star,
  Trophy,
  Users,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useAppFont } from '../../utils/fontSetup';
import {
  GLASS_BORDER_TOP,
  GLASS_CARD,
  GOLD_PRIMARY,
  GRADIENT_CTA_PURPLE,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_SM,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/tokens';
import type { GroupMember, PredictionMatch, RankedGroup, Team } from './data';

const MEDAL_COLORS = ['#F5C518', '#C7CCD1', '#CD7F32'];

// ─── Crest placeholder ────────────────────────────────────────────────────────
export function Crest({ team, size = 40 }: { team: Team; size?: number }) {
  const font = useAppFont(800);
  return (
    <LinearGradient
      colors={team.crest}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        pt.crest,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text
        style={[pt.crestTxt, { fontFamily: font, fontSize: size * 0.28 }]}
        numberOfLines={1}
      >
        {team.short}
      </Text>
    </LinearGradient>
  );
}

// ─── Segmented tabs ───────────────────────────────────────────────────────────
export function SegTabs({
  tabs,
  active,
  onChange,
  isRTL,
  scroll,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
  isRTL: boolean;
  scroll?: boolean;
}) {
  const fontBold = useAppFont(700);
  const ordered = isRTL ? [...tabs].reverse() : tabs;
  return (
    <View style={[pt.segWrap, scroll && { flexWrap: 'nowrap' }]}>
      {ordered.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              pt.segItem,
              isActive && pt.segItemActive,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                pt.segTxt,
                { fontFamily: fontBold },
                isActive && pt.segTxtActive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Member (standings) row ───────────────────────────────────────────────────
export function MemberRow({
  member,
  isRTL,
  showSubtitle,
}: {
  member: GroupMember;
  isRTL: boolean;
  showSubtitle?: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const medal = member.rank <= 3 ? MEDAL_COLORS[member.rank - 1] : null;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <View style={[pt.memberRow, row, member.isMe && pt.memberRowMe]}>
      <View
        style={[
          pt.rankBadge,
          medal
            ? { backgroundColor: medal }
            : { backgroundColor: 'rgba(255,255,255,0.08)' },
        ]}
      >
        <Text
          style={[
            pt.rankBadgeTxt,
            { fontFamily: fontBold, color: medal ? '#0A0612' : TEXT_SECONDARY },
          ]}
        >
          {member.rank}
        </Text>
      </View>
      <LinearGradient
        colors={member.isMe ? GRADIENT_CTA_PURPLE : ['#7C3AED', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={pt.avatar}
      >
        <Text style={[pt.avatarTxt, { fontFamily: fontBold }]}>
          {member.name.charAt(0)}
        </Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            pt.memberName,
            { fontFamily: fontSemi, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {member.name}
          {member.isMe ? '  (أنت)' : ''}
        </Text>
        {showSubtitle ? (
          <Text
            style={[
              pt.memberSub,
              { textAlign: isRTL ? 'right' : 'left' },
            ]}
            numberOfLines={1}
          >
            {member.correct} توقع صحيح
          </Text>
        ) : null}
      </View>
      <View style={[pt.pointsPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={[pt.pointsNum, { fontFamily: fontBold }]}>{member.points}</Text>
        <Text style={pt.pointsLbl}>نقطة</Text>
      </View>
    </View>
  );
}

// ─── Ranked group row (top groups) ────────────────────────────────────────────
export function GroupRow({
  group,
  isRTL,
  highlight,
}: {
  group: RankedGroup;
  isRTL: boolean;
  highlight?: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const medal = group.rank <= 3 ? MEDAL_COLORS[group.rank - 1] : null;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <View style={[pt.memberRow, row, highlight && pt.memberRowMe]}>
      <View
        style={[
          pt.rankBadge,
          medal
            ? { backgroundColor: medal }
            : { backgroundColor: 'rgba(255,255,255,0.08)' },
        ]}
      >
        <Text
          style={[
            pt.rankBadgeTxt,
            { fontFamily: fontBold, color: medal ? '#0A0612' : TEXT_SECONDARY },
          ]}
        >
          {group.rank}
        </Text>
      </View>
      <View style={pt.groupIcon}>
        <Trophy size={18} color={PURPLE_SOFT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[pt.memberName, { fontFamily: fontSemi, textAlign: isRTL ? 'right' : 'left' }]}
          numberOfLines={1}
        >
          {group.name}
          {highlight ? '  (مجموعتك)' : ''}
        </Text>
        <Text style={[pt.memberSub, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
          {group.members} عضو
        </Text>
      </View>
      <View style={[pt.pointsPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={[pt.pointsNum, { fontFamily: fontBold }]}>{group.points}</Text>
        <Text style={pt.pointsLbl}>نقطة</Text>
      </View>
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
export function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  const fontExtra = useAppFont(800);
  return (
    <View style={pt.statCard}>
      <View style={[pt.statIcon, { backgroundColor: color + '26' }]}>{icon}</View>
      <Text style={[pt.statValue, { fontFamily: fontExtra }]}>{value}</Text>
      <Text style={pt.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ─── Points-system card ───────────────────────────────────────────────────────
export function PointsSystemCard({ isRTL }: { isRTL: boolean }) {
  const fontBold = useAppFont(700);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <View style={pt.pointsCard}>
      <Text
        style={[pt.pointsCardTitle, { fontFamily: fontBold, textAlign: isRTL ? 'right' : 'left' }]}
      >
        نظام النقاط
      </Text>
      <View style={[pt.pointsCardRow, row]}>
        <View style={[pt.pointsChip, row]}>
          <Star size={14} color={PURPLE_SOFT} />
          <Text style={pt.pointsChipTxt}>توقع الفائز أو التعادل</Text>
        </View>
        <View style={pt.pointsValueBox}>
          <Text style={[pt.pointsValueTxt, { fontFamily: fontBold, color: PURPLE_SOFT }]}>
            1 نقطة
          </Text>
        </View>
      </View>
      <View style={[pt.pointsCardRow, row]}>
        <View style={[pt.pointsChip, row]}>
          <Trophy size={14} color={GOLD_PRIMARY} />
          <Text style={pt.pointsChipTxt}>توقع النتيجة الدقيقة</Text>
        </View>
        <View style={[pt.pointsValueBox, { backgroundColor: 'rgba(245,197,24,0.14)' }]}>
          <Text style={[pt.pointsValueTxt, { fontFamily: fontBold, color: GOLD_PRIMARY }]}>
            3 نقاط
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Group header card ────────────────────────────────────────────────────────
export function GroupHeaderCard({
  isRTL,
  onCopy,
  onInvite,
  copied,
}: {
  isRTL: boolean;
  onCopy: () => void;
  onInvite: () => void;
  copied: boolean;
}) {
  const fontExtra = useAppFont(800);
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <View style={pt.headerCard}>
      <LinearGradient
        colors={['rgba(124,58,237,0.22)', 'rgba(59,130,246,0.06)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[pt.headerTop, row]}>
        <View style={pt.crestBig}>
          <LinearGradient
            colors={GRADIENT_CTA_PURPLE}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={pt.crestBigInner}
          >
            <Trophy size={30} color="#fff" />
          </LinearGradient>
          <View style={pt.crownBadge}>
            <Crown size={14} color="#0A0612" fill={GOLD_PRIMARY} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[pt.groupName, { fontFamily: fontExtra, textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            شلة الكورة
          </Text>
          <View style={[pt.badgeRow, row]}>
            <View style={[pt.privateBadge, row]}>
              <Lock size={11} color={PURPLE_SOFT} />
              <Text style={pt.privateTxt}>مجموعة خاصة</Text>
            </View>
            <View style={[pt.membersBadge, row]}>
              <Users size={11} color={TEXT_MUTED} />
              <Text style={pt.membersTxt}>20 عضو</Text>
            </View>
          </View>
          <Text style={[pt.createdTxt, { textAlign: isRTL ? 'right' : 'left' }]}>
            أنشئت في 20 مايو 2024
          </Text>
        </View>
      </View>

      <View style={[pt.inviteRow, row]}>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [pt.codeChip, row, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={[pt.codeLabel, { textAlign: isRTL ? 'right' : 'left' }]}>كود الدعوة</Text>
            <Text style={[pt.codeValue, { fontFamily: fontBold, textAlign: isRTL ? 'right' : 'left' }]}>
              90PLUS123
            </Text>
          </View>
          {copied ? <Check size={18} color="#22C55E" /> : <Copy size={18} color={PURPLE_SOFT} />}
        </Pressable>
        <Pressable
          onPress={onInvite}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={GRADIENT_CTA_PURPLE}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[pt.inviteBtn, row]}
          >
            <Users size={16} color="#fff" />
            <Text style={[pt.inviteBtnTxt, { fontFamily: fontBold }]}>دعوة أصدقاء</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Match prediction card ────────────────────────────────────────────────────
type ScoreTarget = 'winner' | 'exact';

export function MatchPredictionCard({
  match,
  isRTL,
  locked,
  finished,
}: {
  match: PredictionMatch;
  isRTL: boolean;
  locked?: boolean;
  finished?: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontExtra = useAppFont(800);
  const fontSemi = useAppFont(600);
  const [home, setHome] = useState(finished ? match.result?.home ?? 0 : 1);
  const [away, setAway] = useState(finished ? match.result?.away ?? 0 : 1);
  const [target, setTarget] = useState<ScoreTarget>('winner');
  const [starred, setStarred] = useState(false);

  const clamp = (n: number) => Math.max(0, Math.min(20, n));
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const renderTeam = (team: Team) => (
    <View style={pt.teamBlock}>
      <Crest team={team} size={44} />
      <Text style={[pt.teamName, { fontFamily: fontSemi }]} numberOfLines={1}>
        {team.name}
      </Text>
    </View>
  );

  const Stepper = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <View style={pt.stepper}>
      <Pressable
        onPress={() => onChange(clamp(value + 1))}
        disabled={locked || finished}
        hitSlop={8}
        style={({ pressed }) => [pt.stepBtn, pressed && { opacity: 0.6 }]}
      >
        <ChevronUp size={18} color={locked || finished ? TEXT_MUTED : PURPLE_SOFT} />
      </Pressable>
      <Text style={[pt.stepValue, { fontFamily: fontExtra }]}>{value}</Text>
      <Pressable
        onPress={() => onChange(clamp(value - 1))}
        disabled={locked || finished}
        hitSlop={8}
        style={({ pressed }) => [pt.stepBtn, pressed && { opacity: 0.6 }]}
      >
        <ChevronDown size={18} color={locked || finished ? TEXT_MUTED : PURPLE_SOFT} />
      </Pressable>
    </View>
  );

  return (
    <View style={pt.matchCard}>
      {/* header: teams + kickoff */}
      <View style={[pt.matchHeader, row]}>
        {renderTeam(match.home)}
        <View style={pt.kickoff}>
          {finished ? (
            <>
              <Text style={[pt.scoreFinal, { fontFamily: fontExtra }]}>
                {match.result?.home} - {match.result?.away}
              </Text>
              <Text style={pt.kickoffDay}>{match.day}</Text>
            </>
          ) : (
            <>
              <Text style={pt.kickoffDay}>{match.day}</Text>
              <Text style={[pt.kickoffTime, { fontFamily: fontBold }]}>{match.time}</Text>
            </>
          )}
        </View>
        {renderTeam(match.away)}
      </View>

      {!finished && (
        <>
          <Text style={pt.predictLabel}>توقع النتيجة</Text>
          <View style={[pt.scoreRow, row]}>
            <Stepper value={home} onChange={setHome} />
            <Text style={[pt.scoreDash, { fontFamily: fontBold }]}>-</Text>
            <Stepper value={away} onChange={setAway} />
          </View>
        </>
      )}

      {/* bottom actions */}
      <View style={[pt.actionsRow, row]}>
        {finished ? (
          <View style={[pt.earnedBadge, row]}>
            <Check size={14} color="#22C55E" />
            <Text style={[pt.earnedTxt, { fontFamily: fontBold }]}>+3 نقاط</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setStarred((v) => !v)}
              hitSlop={8}
              style={({ pressed }) => [pt.starBtn, pressed && { opacity: 0.7 }]}
            >
              <Star
                size={20}
                color={GOLD_PRIMARY}
                fill={starred ? GOLD_PRIMARY : 'transparent'}
              />
            </Pressable>
            <Pressable
              onPress={() => setTarget('exact')}
              disabled={locked}
              style={[pt.targetChip, target === 'exact' && pt.targetChipGold]}
            >
              <Text
                style={[
                  pt.targetChipTxt,
                  { fontFamily: fontSemi },
                  target === 'exact' && { color: GOLD_PRIMARY },
                ]}
                numberOfLines={1}
              >
                نتيجة دقيقة (3)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTarget('winner')}
              disabled={locked}
              style={[pt.targetChip, target === 'winner' && pt.targetChipActive]}
            >
              <Text
                style={[
                  pt.targetChipTxt,
                  { fontFamily: fontSemi },
                  target === 'winner' && { color: PURPLE_SOFT },
                ]}
                numberOfLines={1}
              >
                فائز أو تعادل (1)
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {locked && (
        <View style={pt.lockedOverlay}>
          <Lock size={16} color={TEXT_MUTED} />
          <Text style={pt.lockedTxt}>تفتح قريباً</Text>
        </View>
      )}
    </View>
  );
}

const pt = StyleSheet.create({
  crest: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  crestTxt: { color: '#fff', letterSpacing: 0.5 },

  segWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS_MD,
    padding: 4,
    gap: 4,
  },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: RADIUS_SM, alignItems: 'center', justifyContent: 'center' },
  segItemActive: { backgroundColor: 'rgba(124,58,237,0.85)' },
  segTxt: { color: TEXT_MUTED, fontSize: 12.5 },
  segTxtActive: { color: '#fff' },

  memberRow: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: GLASS_CARD,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  memberRowMe: {
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderColor: 'rgba(167,139,250,0.55)',
  },
  rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankBadgeTxt: { fontSize: 13 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 16 },
  groupIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.16)',
  },
  memberName: { color: TEXT_PRIMARY, fontSize: 15 },
  memberSub: { color: TEXT_MUTED, fontSize: 11.5, marginTop: 2 },
  pointsPill: { alignItems: 'center', gap: 4 },
  pointsNum: { color: GOLD_PRIMARY, fontSize: 16 },
  pointsLbl: { color: TEXT_MUTED, fontSize: 11 },

  statCard: {
    flex: 1,
    backgroundColor: GLASS_CARD,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: GLASS_BORDER_TOP,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: TEXT_PRIMARY, fontSize: 24 },
  statLabel: { color: TEXT_MUTED, fontSize: 12 },

  pointsCard: {
    backgroundColor: GLASS_CARD,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: GLASS_BORDER_TOP,
    padding: 14,
    gap: 10,
  },
  pointsCardTitle: { color: TEXT_PRIMARY, fontSize: 14 },
  pointsCardRow: { alignItems: 'center', justifyContent: 'space-between' },
  pointsChip: { alignItems: 'center', gap: 8 },
  pointsChipTxt: { color: TEXT_SECONDARY, fontSize: 13 },
  pointsValueBox: {
    backgroundColor: 'rgba(124,58,237,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pointsValueTxt: { fontSize: 12 },

  headerCard: {
    backgroundColor: GLASS_CARD,
    borderRadius: RADIUS_LG + 4,
    borderWidth: 1,
    borderColor: GLASS_BORDER_TOP,
    padding: 16,
    gap: 16,
    overflow: 'hidden',
  },
  headerTop: { alignItems: 'center', gap: 14 },
  crestBig: { width: 64, height: 64 },
  crestBigInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  crownBadge: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    left: 20,
  },
  groupName: { color: TEXT_PRIMARY, fontSize: 20 },
  badgeRow: { alignItems: 'center', gap: 8, marginTop: 6 },
  privateBadge: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124,58,237,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  privateTxt: { color: PURPLE_SOFT, fontSize: 11 },
  membersBadge: { alignItems: 'center', gap: 4 },
  membersTxt: { color: TEXT_MUTED, fontSize: 11 },
  createdTxt: { color: TEXT_MUTED, fontSize: 11.5, marginTop: 6 },

  inviteRow: { alignItems: 'center', gap: 10 },
  codeChip: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS_MD,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeLabel: { color: TEXT_MUTED, fontSize: 10 },
  codeValue: { color: TEXT_PRIMARY, fontSize: 16, letterSpacing: 1 },
  inviteBtn: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
  },
  inviteBtnTxt: { color: '#fff', fontSize: 13 },

  matchCard: {
    backgroundColor: GLASS_CARD,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: GLASS_BORDER_TOP,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  matchHeader: { alignItems: 'center', justifyContent: 'space-between' },
  teamBlock: { alignItems: 'center', gap: 6, width: 82 },
  teamName: { color: TEXT_PRIMARY, fontSize: 12, textAlign: 'center' },
  kickoff: { alignItems: 'center', gap: 3, flex: 1 },
  kickoffDay: { color: TEXT_MUTED, fontSize: 11 },
  kickoffTime: { color: TEXT_PRIMARY, fontSize: 15 },
  scoreFinal: { color: TEXT_PRIMARY, fontSize: 22 },
  predictLabel: { color: TEXT_MUTED, fontSize: 11, textAlign: 'center' },
  scoreRow: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepper: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS_MD,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  stepBtn: { paddingVertical: 2 },
  stepValue: { color: TEXT_PRIMARY, fontSize: 24, minWidth: 24, textAlign: 'center' },
  scoreDash: { color: TEXT_MUTED, fontSize: 20 },
  actionsRow: { alignItems: 'center', gap: 8 },
  starBtn: { padding: 4 },
  targetChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  targetChipActive: {
    backgroundColor: 'rgba(124,58,237,0.16)',
    borderColor: PURPLE_PRIMARY,
  },
  targetChipGold: {
    backgroundColor: 'rgba(245,197,24,0.14)',
    borderColor: GOLD_PRIMARY,
  },
  targetChipTxt: { color: TEXT_SECONDARY, fontSize: 11.5 },
  earnedBadge: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  earnedTxt: { color: '#22C55E', fontSize: 12 },
  lockedOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  lockedTxt: { color: TEXT_MUTED, fontSize: 11 },
});
