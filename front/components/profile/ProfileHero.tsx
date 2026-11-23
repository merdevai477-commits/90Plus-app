import React, { memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useProfileTheme } from '../../hooks/useProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_STADIUM_COVER, PROFILE_AVATAR_PLACEHOLDER } from './profileV2Assets';
import VerifiedBadge from './VerifiedBadge';
import DeveloperBadge from './DeveloperBadge';
import ProfileEliteMarks from './ProfileEliteMarks';
import type { ProfileSocialLink } from './ProfileSocialLinksBar';

export type { ProfileSocialLink };

const COVER_HEIGHT = 222;
const AVATAR_RING = 4;
const SHEET_OVERLAP = 52;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export interface ProfileHeroProps {
  topInset: number;
  avatarUri?: string | null;
  name: string;
  username: string;
  bio?: string | null;
  /** @deprecated Social links render in ProfileSocialLinksBar under metrics. */
  socialLinks?: ProfileSocialLink[];
  isVerified?: boolean;
  isDeveloper?: boolean;
  userId?: string | null;
  isOwnProfile?: boolean;
  /** Kept for callers; affiliation bar renders level/country/club. */
  level?: number;
  xp?: number;
  nextLevelXp?: number;
  progressPct?: number;
  energyValue?: number | null;
  countryFlag?: string | null;
  countryLabel?: string | null;
  clubLogo?: string | null;
  clubName?: string | null;
  isAvatarUploading?: boolean;
  onAvatarPress?: () => void;
  onCountryPress?: () => void;
  onClubPress?: () => void;
  onSharePress?: () => void;
  onSettingsPress?: () => void;
  onMorePress?: () => void;
  onBackPress?: () => void;
  onLevelPress?: () => void;
  onEnergyPress?: () => void;
  onEditPress?: () => void;
  onBioPress?: () => void;
  chooseCountryLabel?: string;
  addClubLabel?: string;
  energyLabel?: string;
  addBioLabel?: string;
  viewAllBioLabel?: string;
  showLessBioLabel?: string;
  /** Optional CTA under the bio (e.g. Follow on public profiles). */
  actionBelowName?: React.ReactNode;
}

const ProfileHero = memo(function ProfileHero({
  topInset,
  avatarUri,
  name,
  username,
  bio,
  isVerified = false,
  isDeveloper = false,
  userId = null,
  isOwnProfile = false,
  isAvatarUploading = false,
  onAvatarPress,
  onSettingsPress,
  onMorePress,
  onBackPress,
  onSharePress,
  onEditPress,
  viewAllBioLabel,
  showLessBioLabel,
  actionBelowName,
}: ProfileHeroProps) {
  const { language, t } = useTranslation();
  const { colors: C } = useProfileTheme();
  const isAr = language === 'ar';
  const { width: windowWidth } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, 456);
  const scale = clamp(windowWidth / 390, 0.86, 1.06);
  const avatarSize = Math.round(clamp(windowWidth < 360 ? 96 : 112, 92, 120) * (windowWidth < 360 ? 1 : scale));
  const avatarOuter = avatarSize + AVATAR_RING * 2;
  const padH = Math.round(clamp(windowWidth * 0.045, 14, 20));
  const nameSize = Math.round(clamp(17 * scale, 15, 19));
  const handleSize = Math.round(clamp(12.5 * scale, 11, 14));
  const [bioExpanded, setBioExpanded] = useState(false);
  const trimmedBio = bio?.trim() ?? '';
  const bioNeedsClamp = trimmedBio.length > 72 || trimmedBio.includes('\n');
  const viewAllLabel = viewAllBioLabel || t.profile.showMore || 'View all';
  const showLessLabel = showLessBioLabel || t.profile.showLess || 'Show less';

  return (
    <View style={[styles.wrap, { backgroundColor: C.profileBg }]} testID="profile-hero">
      <View style={[styles.coverHit, { height: COVER_HEIGHT + 40 }]} pointerEvents="none" testID="profile-cover">
        <Image
          source={PROFILE_STADIUM_COVER}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
        />
        <LinearGradient
          colors={[...C.coverFade]}
          locations={[0.55, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        style={[styles.topBar, styles.rowForward, { paddingTop: topInset + 8, paddingHorizontal: padH }]}
        pointerEvents="box-none"
      >
        {onBackPress ? (
          <TouchableOpacity
            onPress={onBackPress}
            hitSlop={10}
            style={[styles.navCircleBtn, { backgroundColor: C.navBtnBg, shadowColor: C.embossShadow }]}
          >
            <Ionicons name="chevron-back" size={18} color={C.navBtnIcon} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navSpacer} />
        )}
        <View style={[styles.navRight, styles.rowForward]}>
          {onSettingsPress ? (
            <TouchableOpacity
              onPress={onSettingsPress}
              activeOpacity={0.85}
              style={[styles.navCircleBtn, { backgroundColor: C.navBtnBg, shadowColor: C.embossShadow }]}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={18} color={C.navBtnIcon} />
            </TouchableOpacity>
          ) : null}
          {onMorePress ? (
            <TouchableOpacity
              onPress={onMorePress}
              activeOpacity={0.85}
              style={[styles.navCircleBtn, { backgroundColor: C.navBtnBg, shadowColor: C.embossShadow }]}
              accessibilityRole="button"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={C.navBtnIcon} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.sheet,
          {
            width: sheetWidth,
            marginTop: COVER_HEIGHT - SHEET_OVERLAP,
            backgroundColor: C.profileSheet,
          },
        ]}
      >
        <View style={[styles.identityBlock, { paddingHorizontal: padH }]}>
          <View
            style={[
              styles.identityRow,
              isAr ? styles.identityRowRtl : styles.identityRowLtr,
              { marginTop: -(avatarOuter * 0.48), minHeight: avatarOuter },
            ]}
          >
            <View style={[styles.avatarColumn, { width: avatarOuter, height: avatarOuter }]}>
              <TouchableOpacity
                style={[styles.avatarWrap, { width: avatarOuter, height: avatarOuter }]}
                onPress={onAvatarPress}
                activeOpacity={0.9}
                disabled={!onAvatarPress}
                accessibilityRole={onAvatarPress ? 'button' : undefined}
              >
                {avatarUri ? (
                  <View
                    style={[
                      styles.avatarGlow,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                        borderColor: C.avatarRing,
                        shadowColor: C.avatarGlow,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                    />
                  </View>
                ) : (
                  <Image
                    source={PROFILE_AVATAR_PLACEHOLDER}
                    style={{ width: avatarOuter, height: avatarOuter }}
                    contentFit="contain"
                  />
                )}
                {isVerified ? (
                  <View
                    style={[
                      styles.avatarBadge,
                      isAr ? styles.avatarBadgeStart : styles.avatarBadgeEnd,
                    ]}
                    pointerEvents="box-none"
                  >
                    <VerifiedBadge size={Math.round(20 * scale)} />
                  </View>
                ) : null}
                {isAvatarUploading ? (
                  <View style={[styles.avatarBusy, { borderRadius: avatarOuter / 2 }]}>
                    <ActivityIndicator color={C.profilePrimary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={[styles.metaColumn, isAr ? styles.alignEnd : styles.alignStart]}>
              <View style={[styles.nameBlock, isAr ? styles.alignEnd : styles.alignStart]}>
                <View style={[styles.nameRow, isAr ? styles.rowEnd : styles.rowStart]}>
                  <Text
                    style={[
                      styles.name,
                      {
                        textAlign: isAr ? 'right' : 'left',
                        color: C.nameColor,
                        fontSize: nameSize,
                        lineHeight: nameSize + 4,
                      },
                    ]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {name}
                  </Text>
                  {isVerified ? <VerifiedBadge size={Math.round(16 * scale)} /> : null}
                  {isDeveloper ? <DeveloperBadge size={Math.round(16 * scale)} /> : null}
                  <ProfileEliteMarks userId={userId} />
                </View>
                <Text
                  style={[
                    styles.handle,
                    {
                      textAlign: isAr ? 'right' : 'left',
                      color: C.profileHandle,
                      fontSize: handleSize,
                      lineHeight: handleSize + 3,
                    },
                  ]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.1}
                >
                  @{username}
                </Text>
              </View>
            </View>

            {isOwnProfile && onEditPress ? (
              <TouchableOpacity
                style={[
                  styles.editIconBtn,
                  {
                    backgroundColor: C.profilePrimarySoft,
                    borderColor: C.embossBorder,
                  },
                ]}
                onPress={onEditPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t.profile.editProfile}
              >
                <Ionicons name="pencil" size={16} color={C.profilePrimary} />
              </TouchableOpacity>
            ) : !isOwnProfile && onSharePress ? (
              <TouchableOpacity
                style={[
                  styles.editIconBtn,
                  {
                    backgroundColor: C.profilePrimarySoft,
                    borderColor: C.embossBorder,
                  },
                ]}
                onPress={onSharePress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t.profile.shareProfile}
              >
                <Ionicons name="share-social-outline" size={18} color={C.profilePrimary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.editBtnSpacer} />
            )}
          </View>

          {trimmedBio ? (
            <View style={styles.bioWrap}>
              <Text
                style={[styles.bio, { textAlign: isAr ? 'right' : 'left', color: C.bioColor }]}
                numberOfLines={bioExpanded ? undefined : 1}
              >
                {trimmedBio}
              </Text>
              {bioNeedsClamp ? (
                <TouchableOpacity
                  onPress={() => setBioExpanded((v) => !v)}
                  hitSlop={8}
                  style={[styles.bioToggle, isAr ? styles.alignEnd : styles.alignStart]}
                >
                  <Text style={[styles.bioToggleText, { color: C.profilePrimary }]}>
                    {bioExpanded ? showLessLabel : viewAllLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {actionBelowName ? <View style={styles.actionBelowName}>{actionBelowName}</View> : null}
        </View>
      </View>
    </View>
  );
});

export default ProfileHero;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: ProfileTheme.colors.profileBg,
  },
  coverHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowForward: {
    flexDirection: 'row',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  navRight: {
    alignItems: 'center',
    gap: 12,
  },
  navSpacer: {
    width: 36,
    height: 36,
  },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E0844',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sheet: {
    alignSelf: 'center',
    backgroundColor: ProfileTheme.colors.profileSheet,
    borderTopLeftRadius: ProfileTheme.radius.sheet,
    borderTopRightRadius: ProfileTheme.radius.sheet,
    paddingTop: 8,
    paddingBottom: 4,
  },
  identityBlock: {
    gap: 12,
  },
  identityRow: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  identityRowRtl: {
    flexDirection: 'row-reverse',
  },
  identityRowLtr: {
    flexDirection: 'row',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  rowEnd: {
    justifyContent: 'flex-end',
  },
  rowStart: {
    justifyContent: 'flex-start',
  },
  avatarColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    borderWidth: AVATAR_RING,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#6A2BD9',
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.22,
    shadowRadius: Platform.OS === 'ios' ? 12 : 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === 'android' ? 5 : 8,
    backgroundColor: '#FAF5FF',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    zIndex: 2,
  },
  avatarBadgeEnd: {
    right: 2,
  },
  avatarBadgeStart: {
    left: 2,
  },
  metaColumn: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 10,
    justifyContent: 'flex-end',
    gap: 2,
  },
  nameBlock: {
    width: '100%',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
    color: '#000000',
    fontWeight: '700',
  },
  handle: {
    color: ProfileTheme.colors.profileHandle,
    fontWeight: '400',
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
    flexShrink: 0,
  },
  editBtnSpacer: {
    width: 8,
    height: 36,
    marginBottom: 8,
  },
  bioWrap: {
    width: '100%',
    gap: 4,
  },
  bio: {
    color: '#434343',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  bioToggle: {
    alignSelf: 'flex-end',
  },
  bioToggleText: {
    color: ProfileTheme.colors.profilePrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBelowName: {
    width: '100%',
    marginTop: 2,
  },
});
