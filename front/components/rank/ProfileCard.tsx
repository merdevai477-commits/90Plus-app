/**
 * ProfileCard
 *
 * Displays the logged-in user's avatar, display name, level and XP progress
 * on the Rank screen. Tapping the card navigates to the user's own profile.
 *
 * Avatar source priority:
 *   1. R2 avatar from `/api/profile/me` (set when the user uploads in Profile)
 *   2. Clerk imageUrl (Clerk-hosted fallback)
 *   3. Local placeholder asset
 *
 * This mirrors how the Profile screen resolves the avatar so both surfaces
 * always show the same image — the previous implementation only read
 * `useUser().imageUrl`, which returned the Clerk avatar even after the user
 * had uploaded a new one to R2.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from '../../src/i18n';
import { useXp } from '../../contexts/XpContext';
import { useMyProfileBasics } from '../../hooks/useMyProfileBasics';

const ACCENT = '#A855F7';
const PROFILE_PLACEHOLDER = require('../../assets/images/plear 90Plus.png');

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
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  displayName,
  avatarUrl,
  level: levelProp,
  xpInLevel: xpInLevelProp,
  xpForNextLevel: xpSpanProp,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const xpCtx = useXp();
  const { data: profile, refetch: refetchProfile } = useMyProfileBasics();

  // Refresh basics every time the rank tab regains focus so a freshly
  // uploaded avatar shows up immediately without waiting for the React Query
  // staleTime to elapse.
  useFocusEffect(
    useCallback(() => {
      refetchProfile();
    }, [refetchProfile]),
  );

  // Source of truth for level/XP: live XpContext (SSE/poll), then profile,
  // then sane defaults. The bar shows progress *within* the current level —
  // not the absolute lifetime XP — so the label matches the bar.
  const level = levelProp ?? xpCtx.level ?? profile?.level ?? 1;
  const xpInLevel = xpInLevelProp ?? xpCtx.xpInLevel ?? 0;
  const xpForNextLevel = Math.max(1, xpSpanProp ?? xpCtx.xpForNextLevel ?? 290);

  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const rowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

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

  const handlePress = () => {
    router.push('/(tabs)/profile' as never);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t.rank.a11yProfileCard}
      style={({ pressed }) => [s.pressable, pressed && { opacity: 0.85 }]}
    >
      <GlassContainer
        intensity={18}
        tint="dark"
        effect="clear"
        interactive
        style={s.profileCard}
      >
        <View style={s.profileCardOverlay} />

        <View style={[s.profileRow, { flexDirection: rowDirection }]}>
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
            <View style={[s.nameRow, { flexDirection: rowDirection }]}>
              <Text style={s.username} numberOfLines={1}>
                {resolvedName}
              </Text>
            </View>

            <View style={[s.xpRow, { flexDirection: rowDirection }]}>
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
      </GlassContainer>
    </Pressable>
  );
};

export default ProfileCard;

const s = StyleSheet.create({
  pressable: { marginHorizontal: 12, marginTop: 19 },
  profileCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.00)',
    borderWidth: 1,
    borderColor: 'rgba(69, 5, 128, 0.25)',
    overflow: 'hidden',
    zIndex: 1,
  },
  profileCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(80,20,160,0.00)',
    borderRadius: 22,
  },
  profileRow: { alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(124,58,237,0.0)',
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
  nameRow: { alignItems: 'center', gap: 7 },
  username: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  xpRow: { alignItems: 'center', gap: 8, marginTop: 6 },
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  xpBarFill: { height: '100%' },
  xpLabel: { fontSize: 12 },
  xpCur: { color: ACCENT, fontWeight: '900' },
  xpMax: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
});
