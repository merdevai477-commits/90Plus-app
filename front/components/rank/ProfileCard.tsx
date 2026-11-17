/**
 * ProfileCard
 *
 * Displays the logged-in user's avatar, display name, level and XP progress
 * on the Rank screen. Tapping the card navigates to the user's own profile.
 *
 * Surface uses LiquidWaterSurface (native Liquid Glass on iOS 26+, Skia
 * water-glass + BlurTarget frost on Android) so the hero art / page behind
 * the card shows through as real liquid glass — not a flat panel.
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
import { useResolvedAppScheme } from '@/hooks/useResolvedAppScheme';
import { useTranslation } from '../../src/i18n';
import { useXp } from '../../contexts/XpContext';
import { useMyProfileBasics } from '../../hooks/useMyProfileBasics';
import { getRankTheme } from './rankTheme';

const ACCENT = '#A855F7';
const CARD_RADIUS = 22;
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
  /** Optional global rank label (e.g. "#1"). */
  rankLabel?: string | null;
  /** Android blur target (BlurTargetView wrapping the hero art). */
  blurTarget?: React.RefObject<View | null>;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  displayName,
  avatarUrl,
  level: levelProp,
  xpInLevel: xpInLevelProp,
  xpForNextLevel: xpSpanProp,
  rankLabel,
  blurTarget,
}) => {
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getRankTheme(isDark), [isDark]);
  const xpCtx = useXp();
  const { data: profile, refetch: refetchProfile } = useMyProfileBasics();

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

  const handlePress = () => {
    router.push('/(tabs)/profile' as never);
  };

  const row = isRTL ? ('row' as const) : ('row-reverse' as const);
  const alignEnd = isRTL ? ('flex-end' as const) : ('flex-start' as const);
  const textAlign = isRTL ? ('right' as const) : ('left' as const);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t.rank.a11yProfileCard}
      style={({ pressed }) => [s.pressable, pressed && { opacity: 0.92 }]}
    >
      <LiquidWaterSurface
        radius={CARD_RADIUS}
        tint={theme.cardTint}
        glow={theme.cardGlow}
        strength={theme.strength}
        scale={2.4}
        sheen={theme.sheen}
        // Dark keeps native Liquid Glass when supported; light needs explicit frost tint.
        blurIntensity={isDark ? undefined : theme.blurIntensity}
        blurTint={theme.blurTint}
        elevate={isDark ? 'dark' : 'light'}
        blurTarget={blurTarget}
        style={[
          s.card,
          !isDark && {
            borderWidth: 1,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={[s.profileRow, { flexDirection: row }]}>
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
            <View style={[s.avatarRing, { borderColor: theme.levelBadge }]} />
          </View>

          <View style={[s.profileInfo, { alignItems: alignEnd }]}>
            <View style={[s.nameCol, { alignItems: alignEnd }]}>
              <Text style={[s.username, { color: theme.cardText, textAlign }]} numberOfLines={1}>
                {resolvedName}
              </Text>
              {!!rankLabel && (
                <Text style={[s.rankLine, { color: theme.cardMuted, textAlign }]} numberOfLines={1}>
                  {t.rank.yourRank}: {rankLabel}
                </Text>
              )}
            </View>

            <View style={[s.xpRow, { flexDirection: row }]}>
              <View style={[s.lvlBadge, { backgroundColor: theme.levelBadge }]}>
                <Text style={s.lvlTxt}>
                  {t.rank.levelPrefix} {level}
                </Text>
              </View>
              <View style={[s.xpBarBg, { backgroundColor: theme.cardXpTrack }]}>
                <LinearGradient
                  colors={isDark ? ['#7C3AED', ACCENT] : ['#4B1FA3', '#A855F7']}
                  style={[s.xpBarFill, { width: `${xpPct}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={s.xpLabel}>
                <Text style={[s.xpCur, { color: theme.cardXpCur }]}>{xpInLevel}</Text>
                <Text style={[s.xpMax, { color: theme.cardXpMax }]}>
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
  pressable: { marginHorizontal: 12, marginTop: 12 },
  card: {
    padding: 18,
  },
  profileRow: { alignItems: 'center', gap: 14 },
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
  },
  profileInfo: { flex: 1, gap: 10 },
  nameCol: { gap: 2, width: '100%' },
  username: { fontSize: 22, fontWeight: '800', width: '100%' },
  rankLine: { fontSize: 15, fontWeight: '600', width: '100%' },
  xpRow: { alignItems: 'center', gap: 8, marginTop: 4, width: '100%' },
  lvlBadge: {
    borderRadius: 31,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 19,
    justifyContent: 'center',
  },
  lvlTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  xpBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 53,
    overflow: 'hidden',
  },
  xpBarFill: { height: '100%', borderRadius: 53 },
  xpLabel: { fontSize: 12 },
  xpCur: { fontWeight: '800' },
  xpMax: { fontWeight: '700' },
});
