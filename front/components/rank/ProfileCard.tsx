/**
 * ProfileCard
 *
 * Displays the logged-in user's avatar, display name, level and XP progress
 * on the Rank screen. Tapping the card navigates to the user's own profile.
 *
 * Level/XP are intentionally placeholder values (Lv. 1, 0/100) until the
 * scoring system is defined. They are exposed as props so swapping to real
 * data later is a one-line change.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import React, { useMemo } from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';
const PROFILE_PLACEHOLDER = require('../../assets/images/plear 90Plus.png');

export interface ProfileCardProps {
  /** Optional override for the user's display name. */
  displayName?: string | null;
  /** Optional avatar url override (Cloudflare R2). */
  avatarUrl?: string | null;
  /** User level. Placeholder until scoring system is finalized. */
  level?: number;
  /** Current XP toward the next level. */
  xp?: number;
  /** XP required to reach the next level. */
  xpToNextLevel?: number;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  displayName,
  avatarUrl,
  level = 1,
  xp = 0,
  xpToNextLevel = 100,
}) => {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslation();

  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;
  const rowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

  const resolvedName: string =
    (displayName && displayName.trim()) ||
    (user?.fullName && user.fullName.trim()) ||
    user?.username ||
    user?.firstName ||
    t.rank.competitions.title;

  const remoteAvatar: string | null =
    (avatarUrl && avatarUrl.trim()) || user?.imageUrl || null;

  const xpPct = useMemo(() => {
    if (!xpToNextLevel || xpToNextLevel <= 0) return 0;
    const ratio = xp / xpToNextLevel;
    if (ratio < 0) return 0;
    if (ratio > 1) return 100;
    return ratio * 100;
  }, [xp, xpToNextLevel]);

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
                <Text style={s.xpCur}>{xp}</Text>
                <Text style={s.xpMax}>
                  {' '}
                  / {xpToNextLevel} {t.rank.xpSuffix}
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
