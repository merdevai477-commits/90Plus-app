/**
 * GroupHeroCard — top hero block for the prediction-group home tab.
 *
 * Spatial hierarchy inspired by a challenge-detail reference, styled with the
 * 90Plus purple / gold / glass token set. Replaces the old GroupHeaderCard.
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';
import { Check, Copy, List, Plus, Trophy, Users, X } from 'lucide-react-native';
import React, { useCallback, useId, useState } from 'react';
import {
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { useToast } from '../../contexts/ToastContext';
import { PressableScale } from './atoms';
import { GroupCrest } from './GroupCrest';
import { GroupInviteSheet } from './GroupInviteSheet';
import { StatCard } from './StatCard';
import {
  PG,
  PG_GLOW_PURPLE,
  PG_GRADIENTS,
  PG_RADII,
  PG_SPACING,
  PG_TYPE,
  usePGFonts,
} from './theme';

const AVATAR_SIZE = 56;
const MEMBER_AVATAR = 36;
const VISIBLE_MEMBERS = 4;

const HeroGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const HERO_GLASS_PROPS = isLiquidGlassSupported
  ? { effect: 'clear' as const, interactive: true, tintColor: 'rgba(255,255,255,0.04)' }
  : { intensity: Platform.OS === 'android' ? 18 : 18, tint: 'dark' as const };

export interface GroupHeroMember {
  name: string;
  avatarUrl?: string;
}

export interface GroupHeroCardProps {
  groupName: string;
  avatarUrl?: string;
  memberCount: number;
  createdAt: string;
  inviteCode: string;
  members: GroupHeroMember[];
  accuracyPercent: number;
  totalPredictions: number;
  wins: number;
  losses: number;
  isRTL?: boolean;
  onViewAllMembers?: () => void;
}

function CalendarIcon({ size = 14, color = PG.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function memberInitial(name: string): string {
  return name.trim().charAt(0);
}

function GroupAvatarRing({
  avatarUrl,
  ringGradientId,
}: {
  avatarUrl?: string;
  ringGradientId: string;
}) {
  const inner = AVATAR_SIZE - 6;
  return (
    <View style={styles.avatarOuter}>
      <Svg width={AVATAR_SIZE} height={AVATAR_SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={ringGradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={PG_GRADIENTS.avatarRing[0]} />
            <Stop offset="1" stopColor={PG_GRADIENTS.avatarRing[1]} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={AVATAR_SIZE / 2}
          cy={AVATAR_SIZE / 2}
          r={AVATAR_SIZE / 2 - 1.5}
          stroke={`url(#${ringGradientId})`}
          strokeWidth={3}
          fill="none"
        />
      </Svg>
      <View style={[styles.avatarInner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <GroupCrest size={inner - 4} />
        )}
      </View>
    </View>
  );
}

export function GroupHeroCard({
  groupName,
  avatarUrl,
  memberCount,
  createdAt,
  inviteCode,
  members,
  accuracyPercent,
  totalPredictions,
  wins,
  losses,
  isRTL = I18nManager.isRTL,
  onViewAllMembers,
}: GroupHeroCardProps) {
  const { medium, bold, extra } = usePGFonts();
  const toast = useToast();
  const ringGradientId = useId();
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';
  const overlapMargin = isRTL ? { marginRight: -10 } : { marginLeft: -10 };

  const visibleMembers = members.slice(0, VISIBLE_MEMBERS);
  const overflowCount = Math.max(0, members.length - VISIBLE_MEMBERS);

  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      toast.showSuccess('تم النسخ', 'تم نسخ كود الدعوة');
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* no-op */
    }
  }, [inviteCode, toast]);

  const handleOpenInvite = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setInviteOpen(true);
  }, []);

  return (
    <View style={styles.root}>
      {/* ── Top meta row ── */}
      <Animated.View entering={FadeInDown.duration(400).springify().damping(18)} style={[styles.metaRow, row]}>
        <View style={[styles.dateChip, row]}>
          <CalendarIcon size={13} />
          <Text style={[styles.dateText, { fontFamily: medium }]}>{createdAt}</Text>
        </View>

        <View style={[styles.codeChip, row]}>
          <Text style={[styles.codeText, { fontFamily: bold }]}>{inviteCode}</Text>
          <Pressable
            onPress={handleCopy}
            hitSlop={8}
            style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="نسخ كود الدعوة"
          >
            {copied ? (
              <Check size={15} color={PG.purpleSoft} />
            ) : (
              <Copy size={15} color={PG.purpleSoft} />
            )}
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Hero card (horizontal glass) ── */}
      <Animated.View entering={FadeInDown.delay(50).duration(420).springify().damping(16)}>
        <HeroGlass {...HERO_GLASS_PROPS} style={styles.heroShell}>
          <View style={[styles.heroRow, row]}>
            <GroupAvatarRing avatarUrl={avatarUrl} ringGradientId={ringGradientId} />

            <View style={styles.heroInfo}>
              <Text
                style={[styles.groupName, { fontFamily: extra, textAlign: align }]}
                numberOfLines={1}
              >
                {groupName}
              </Text>
              <View style={[styles.memberLine, row]}>
                <Users size={12} color={PG.textMuted} />
                <Text style={[styles.memberCount, { fontFamily: medium }]}>
                  {memberCount} عضو
                </Text>
              </View>
            </View>

            <PressableScale
              onPress={handleOpenInvite}
              activeScale={0.92}
              style={styles.inviteWrap}
              accessibilityRole="button"
              accessibilityLabel="دعوة أعضاء"
            >
              <LinearGradient
                colors={PG_GRADIENTS.purple}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.plusBtn, PG_GLOW_PURPLE]}
              >
                <Plus size={22} color={PG.text} strokeWidth={2.5} />
              </LinearGradient>
            </PressableScale>
          </View>
        </HeroGlass>
      </Animated.View>

      <GroupInviteSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupName={groupName}
        inviteCode={inviteCode}
        isRTL={isRTL}
      />

      {/* ── Members row ── */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(420).springify().damping(16)}
        style={{ gap: PG_SPACING.sm }}
      >
        <View style={[styles.membersHead, row]}>
          <Text style={[styles.membersTitle, { fontFamily: bold }]}>الأعضاء</Text>
          <Text style={[styles.membersJoined, { fontFamily: medium }]}>
            {memberCount.toLocaleString('ar-EG')} منضم
          </Text>
        </View>

        <View style={[styles.membersRow, row]}>
          <View style={[styles.avatarStack, row]}>
            {visibleMembers.map((m, i) => (
              <View
                key={`${m.name}-${i}`}
                style={[
                  styles.memberBubble,
                  i > 0 && overlapMargin,
                  { zIndex: VISIBLE_MEMBERS - i },
                ]}
              >
                {m.avatarUrl ? (
                  <Image source={{ uri: m.avatarUrl }} style={styles.memberImage} />
                ) : (
                  <Text style={[styles.memberInitial, { fontFamily: bold }]}>
                    {memberInitial(m.name)}
                  </Text>
                )}
              </View>
            ))}
            {overflowCount > 0 && (
              <View style={[styles.memberBubble, styles.overflowBubble, overlapMargin]}>
                <Text style={[styles.overflowTxt, { fontFamily: bold }]}>+{overflowCount}</Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={onViewAllMembers}
            style={({ pressed }) => [styles.viewAllBtn, row, pressed && { opacity: 0.82 }]}
            accessibilityRole="button"
          >
            <Users size={14} color={PG.purpleSoft} />
            <Text style={[styles.viewAllTxt, { fontFamily: medium }]}>عرض الكل</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Stats 2×2 grid ── */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(420).springify().damping(16)}
        style={styles.statsBlock}
      >
        <View style={[styles.statsRow, row]}>
          <StatCard label="دقة التوقعات" accuracyPercent={accuracyPercent} index={0} />
          <StatCard
            label="إجمالي التوقعات"
            value={totalPredictions}
            accentColor={PG.purpleSoft}
            icon={<List size={21} color={PG.purpleSoft} strokeWidth={2.2} />}
            index={1}
          />
        </View>
        <View style={[styles.statsRow, row]}>
          <StatCard
            label="توقعات صحيحة"
            value={wins}
            accentColor={PG.gold}
            icon={<Trophy size={21} color={PG.gold} strokeWidth={2.2} />}
            index={2}
          />
          <StatCard
            label="توقعات خاطئة"
            value={losses}
            accentColor={PG.lossMuted}
            icon={<X size={21} color={PG.lossMuted} strokeWidth={2.2} />}
            index={3}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: PG_SPACING.lg },

  metaRow: { alignItems: 'center', justifyContent: 'space-between' },
  dateChip: { alignItems: 'center', gap: 6 },
  dateText: { color: PG.textMuted, fontSize: PG_TYPE.caption },
  codeChip: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: PG.glassStrong,
    borderRadius: PG_RADII.pill,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  codeText: { color: PG.text, fontSize: PG_TYPE.body, letterSpacing: 1.5 },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.purpleTint,
  },

  heroShell: {
    borderRadius: PG_RADII.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PG.heroGlassBorder,
    backgroundColor: 'rgba(255,255,255,0.00)',
  },
  heroRow: {
    alignItems: 'center',
    gap: PG_SPACING.md,
    paddingVertical: 14,
    paddingHorizontal: PG_SPACING.lg,
  },
  avatarOuter: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.glassStrong,
  },
  avatarImage: { width: '100%', height: '100%' },
  heroInfo: { flex: 1, gap: 4 },
  groupName: { color: PG.text, fontSize: PG_TYPE.title, lineHeight: 22 },
  memberLine: { alignItems: 'center', gap: 5 },
  memberCount: { color: PG.textMuted, fontSize: PG_TYPE.caption },

  inviteWrap: { flexShrink: 0 },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  membersHead: { alignItems: 'center', justifyContent: 'space-between' },
  membersTitle: { color: PG.text, fontSize: PG_TYPE.body },
  membersJoined: { color: PG.gold, fontSize: PG_TYPE.caption },
  membersRow: { alignItems: 'center', justifyContent: 'space-between' },
  avatarStack: { alignItems: 'center' },
  memberBubble: {
    width: MEMBER_AVATAR,
    height: MEMBER_AVATAR,
    borderRadius: MEMBER_AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.memberAvatarBg,
    borderWidth: 2,
    borderColor: PG.bg,
  },
  memberImage: { width: '100%', height: '100%', borderRadius: MEMBER_AVATAR / 2 },
  memberInitial: { color: PG.text, fontSize: 14 },
  overflowBubble: { backgroundColor: PG.glassStrong },
  overflowTxt: { color: PG.textSecondary, fontSize: PG_TYPE.caption },

  viewAllBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: PG_RADII.pill,
    backgroundColor: PG.glass,
    borderWidth: 1,
    borderColor: PG.border,
  },
  viewAllTxt: { color: PG.purpleSoft, fontSize: PG_TYPE.caption },

  statsBlock: {
    gap: PG_SPACING.md,
    marginTop: PG_SPACING.sm,
  },
  statsRow: { gap: PG_SPACING.md },
});
