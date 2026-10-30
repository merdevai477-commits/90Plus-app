/**
 * ProfileCard
 *
 * Displays the logged-in user's avatar, display name, level and XP progress
 * on the Rank screen. Tapping the card navigates to the user's own profile.
 *
 * Surface uses LiquidWaterSurface (native Liquid Glass on iOS 26+, Skia
 * water-glass + BlurTarget frost on Android) so the hero art behind the card
 * shows through as real liquid glass — not a flat purple panel.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LiquidWaterSurface } from '../chat/LiquidWaterSurface';
import { useTranslation } from '../../src/i18n';
import { useXp } from '../../contexts/XpContext';
import { useMyProfileBasics } from '../../hooks/useMyProfileBasics';
import { useUserRank } from '../../hooks/useUserRank';

const ACCENT = '#A855F7';
const CARD_RADIUS = 22;
/** Translucent purple — light enough that frosted hero art stays visible. */
const CARD_TINT = 'rgba(36, 14, 68, 0.38)';
const PROFILE_PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

export interface ProfileCardProps {
  /** Optional override for the user's display name. */
  displayName?: string | null;
  /** Optional avatar url override (e.g. screenshot mode). */
  avatarUrl?: string | null;
  /** User level override (falls back to XpContext). */
  level?: number;
  /** XP earned inside the current level (override). */
  xpInLevel?: number;
  /** Total XP span needed to clear the current level (override). */
  xpForNextLevel?: number;
  /** Android blur target (BlurTargetView wrapping the hero art). */
  blurTarget?: React.RefObject<View | null>;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  displayName,
  avatarUrl,
  level: levelProp,
  xpInLevel: xpInLevelProp,
  xpForNextLevel: xpSpanProp,
  blurTarget,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const xpCtx = useXp();
  const { data: profile, refetch: refetchProfile } = useMyProfileBasics();
  const { rankData } = useUserRank();

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
    }, [refetchProfile]),
  );

  const level = levelProp ?? xpCtx.level ?? profile?.level ?? 1;
  const xpInLevel = xpInLevelProp ?? xpCtx.xpInLevel ?? 0;
  const xpForNextLevel = Math.max(1, xpSpanProp ?? xpCtx.xpForNextLevel ?? 100);

  const resolvedName: string =
    (displayName && displayName.trim()) ||
    (profile?.displayName && profile.displayName.trim()) ||
    (profile?.username && profile.username.trim()) ||
    t.rank.competitions.title;

  const remoteAvatar: string | null =
    (avatarUrl && avatarUrl.trim()) ||
    (profile?.avatar && profile.avatar.trim()) ||
    null;

  const xpPct = useMemo(() => {
    if (xpForNextLevel <= 0) return 0;
    const ratio = xpInLevel / xpForNextLevel;
    if (ratio < 0) return 0;
    if (ratio > 1) return 100;
    return ratio * 100;
  }, [xpInLevel, xpForNextLevel]);

  const rankLabel = useMemo(() => {
    const global = rankData?.globalXpRank;
    if (global != null) {
      return `${t.rank.yourRank}: #${global}`;
    }
    return t.rank.rankNotRanked;
  }, [rankData?.globalXpRank, t]);

  const handlePress = () => {
    router.push('/(tabs)/profile' as never);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t.rank.a11yProfileCard}
      style={({ pressed }) => [s.pressable, pressed && { opacity: 0.92 }]}
    >
      <LiquidWaterSurface
        radius={CARD_RADIUS}
        tint={CARD_TINT}
        glow={[0.72, 0.48, 1]}
        strength={0.34}
        scale={2.4}
        sheen={0.85}
        blurTarget={blurTarget}
        style={s.card}
      >
        <View style={s.profileRow}>
          <View style={s.avatarWrap}>
            <Image
              source={remoteAvatar ? { uri: remoteAvatar } : PROFILE_PLACEHOLDER}
              placeholder={PROFILE_PLACEHOLDER}
              style={s.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              recyclingKey={remoteAvatar ?? 'placeholder'}
            />
            <View style={s.avatarRing} />
          </View>

          <View style={s.profileInfo}>
            <View style={s.nameRow}>
              <Text style={s.username} numberOfLines={1}>
                {resolvedName}
              </Text>
            </View>
            <Text style={s.rankLabel} numberOfLines={1}>
              {rankLabel}
            </Text>

            <View style={s.xpRow}>
              <View style={s.lvlBadge}>
                <Text style={s.lvlTxt}>
                  {t.rank.levelPrefix} {level}
                </Text>
              </View>
              <View style={s.xpBarBg}>
                <LinearGradient
                  colors={['#7C3AED', ACCENT]}
                  style={[s.xpBarFill, { width: `${xpPct}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={s.xpLabel}>
                <Text style={s.xpCur}>{xpInLevel}</Text>
                <Text style={s.xpMax}>
                  {' '}
                  / {xpForNextLevel} {t.rank.xpSuffix}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </LiquidWaterSurface>
    </Pressable>
  );
};

export default ProfileCard;

const s = StyleSheet.create({
  pressable: { marginHorizontal: 12, marginTop: 19 },
  card: {
    padding: 18,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  avatarRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2.5,
    borderColor: ACCENT,
  },
  profileInfo: { flex: 1, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  username: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  rankLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lvlBadge: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lvlTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  xpBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  xpBarFill: { height: '100%' },
  xpLabel: { fontSize: 12 },
  xpCur: { color: ACCENT, fontWeight: '900' },
  xpMax: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
});
