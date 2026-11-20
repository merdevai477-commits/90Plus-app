import React, { memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
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
import { getSocialBrandIcon } from './socialBrandIcons';
import { logger } from '../../utils/logger';

const COVER_HEIGHT = 222;
const AVATAR_SIZE = 129;
const AVATAR_GLOW_SIZE = 154;
const SHEET_OVERLAP = 48;

export interface ProfileSocialLink {
  platform: string;
  url: string;
  username?: string;
}

export interface ProfileHeroProps {
  topInset: number;
  avatarUri?: string | null;
  name: string;
  username: string;
  bio?: string | null;
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
  socialLinks = [],
  isVerified = false,
  isDeveloper = false,
  userId = null,
  isOwnProfile = false,
  isAvatarUploading = false,
  onAvatarPress,
  onSettingsPress,
  onMorePress,
  onBackPress,
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
  const [bioExpanded, setBioExpanded] = useState(false);
  const filledLinks = useMemo(
    () => socialLinks.filter((l) => !!l.url?.trim()).slice(0, 3),
    [socialLinks],
  );
  const trimmedBio = bio?.trim() ?? '';
  const bioNeedsClamp = trimmedBio.length > 72 || trimmedBio.includes('\n');
  const viewAllLabel = viewAllBioLabel || t.profile.showMore || 'View all';
  const showLessLabel = showLessBioLabel || t.profile.showLess || 'Show less';

  const openSocial = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (error) {
      logger.error('Error opening social link from profile hero', { url, error });
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: C.profileBg }]} testID="profile-hero">
      <View style={styles.coverHit} pointerEvents="none" testID="profile-cover">
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

      <View style={[styles.topBar, { paddingTop: topInset + 8 }]} pointerEvents="box-none">
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
        <View style={styles.navRight}>
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
        <View style={styles.identityBlock}>
          <View style={[styles.identityRow, isAr ? styles.identityRowRtl : styles.identityRowLtr]}>
            <View style={styles.avatarColumn}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={onAvatarPress}
                activeOpacity={0.9}
                disabled={!onAvatarPress}
                accessibilityRole={onAvatarPress ? 'button' : undefined}
              >
                {avatarUri ? (
                  <View
                    style={[
                      styles.avatarGlow,
                      { borderColor: C.avatarRing, shadowColor: C.avatarGlow },
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
                    style={styles.avatarPlaceholder}
                    contentFit="contain"
                  />
                )}
                {isAvatarUploading ? (
                  <View style={styles.avatarBusy}>
                    <ActivityIndicator color={C.profilePrimary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={[styles.metaColumn, isAr ? styles.alignEnd : styles.alignStart]}>
              <View style={[styles.nameBlock, isAr ? styles.alignEnd : styles.alignStart]}>
                <View style={[styles.nameRow, isAr ? styles.rowEnd : styles.rowStart]}>
                  <Text
                    style={[styles.name, { textAlign: isAr ? 'right' : 'left', color: C.nameColor }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.2}
                  >
                    {name}
                  </Text>
                  {isVerified ? <VerifiedBadge size={16} /> : null}
                  {isDeveloper ? <DeveloperBadge size={16} /> : null}
                  <ProfileEliteMarks userId={userId} />
                </View>
                <Text
                  style={[styles.handle, { textAlign: isAr ? 'right' : 'left', color: C.profileHandle }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  @{username}
                </Text>
              </View>

              {filledLinks.length > 0 ? (
                <View style={styles.socialRow}>
                  {filledLinks.map((link) => {
                    const brand = getSocialBrandIcon(link.platform);
                    return (
                      <TouchableOpacity
                        key={`${link.platform}-${link.url}`}
                        style={styles.socialBtn}
                        onPress={() => openSocial(link.url)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={brand.source}
                          style={{ width: brand.width, height: brand.height }}
                          contentFit="contain"
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {isOwnProfile && onEditPress ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={onEditPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="pencil" size={20} color={C.profilePrimary} />
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
                  style={styles.bioToggle}
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
    height: COVER_HEIGHT + 40,
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navRight: {
    flexDirection: 'row',
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
    paddingHorizontal: 20,
    gap: 10,
  },
  identityRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: -56,
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
    width: AVATAR_GLOW_SIZE,
    height: AVATAR_GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: AVATAR_GLOW_SIZE,
    height: AVATAR_GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#6A2BD9',
    shadowOpacity: 0.46,
    shadowRadius: 12.4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    backgroundColor: '#FAF5FF',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: AVATAR_GLOW_SIZE,
    height: AVATAR_GLOW_SIZE,
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_GLOW_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaColumn: {
    flex: 1,
    minWidth: 0,
    paddingTop: 70,
    gap: 12,
  },
  nameBlock: {
    width: '100%',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  name: {
    flexShrink: 1,
    color: '#000000',
    fontSize: 20,
    fontWeight: '600',
  },
  handle: {
    color: ProfileTheme.colors.profileHandle,
    fontSize: 12,
    fontWeight: '400',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 70,
  },
  editBtnSpacer: {
    width: 8,
    marginTop: 70,
  },
  bioWrap: {
    width: '100%',
    gap: 4,
  },
  bio: {
    color: '#434343',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
