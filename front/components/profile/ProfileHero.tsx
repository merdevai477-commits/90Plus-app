import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
  PixelRatio,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { PROFILE_STADIUM_COVER, PROFILE_ICONS } from './profileV2Assets';
import VerifiedBadge from './VerifiedBadge';
import DeveloperBadge from './DeveloperBadge';
import { formatProfileStat } from './formatProfileStat';
import { isMeaningfulCountryFlag } from '../../utils/countryDisplay';
import { getCountryFlagUri } from '../../utils/countryFlagUri';

const COVER_HEIGHT = 420;
const AVATAR_SIZE = 101;
const OVERLAY_PADDING_X = 8;
const ROW_GAP = 6;
const WING_GAP = 4;
const LEVEL_CHIP_WIDTH = 74;
const SIDE_SLOT_WIDTH = 58;
const ENERGY_CHIP_WIDTH = 68;
const WING_WIDTH = Math.max(LEVEL_CHIP_WIDTH + SIDE_SLOT_WIDTH, SIDE_SLOT_WIDTH + ENERGY_CHIP_WIDTH) + WING_GAP;
// Full-size identity row needs ~395pt; iPhones are 375–393pt wide, so the row scales down to fit.
const ROW_DESIGN_WIDTH = WING_WIDTH * 2 + AVATAR_SIZE + ROW_GAP * 2;
// The social metric card overlaps the hero bottom by 72pt (see ProfileMetricStrip socialCard).
const HERO_BOTTOM_SPACE = 100;

function buildScaledStyles(scale: number) {
  const px = (n: number) => PixelRatio.roundToNearestPixel(n * scale);
  return {
    scale,
    avatarSize: px(AVATAR_SIZE),
    rowGap: px(ROW_GAP),
    wingGap: px(WING_GAP),
    levelChip: { width: px(LEVEL_CHIP_WIDTH), height: px(75), gap: px(10) },
    levelPill: { width: px(58), height: px(24), paddingHorizontal: px(10) },
    lvlWord: { fontSize: px(10) },
    lvlNum: { fontSize: px(14) },
    xpTrack: { width: px(56) },
    xpCaption: { fontSize: px(8) },
    sideSlot: { width: px(SIDE_SLOT_WIDTH), height: px(77) },
    flagImage: { width: px(41), height: px(23) },
    clubLogo: { width: px(27), height: px(48) },
    slotCaption: { fontSize: px(9) },
    emptySlotLabel: { fontSize: px(10) },
    addIcon: px(24),
    energyChip: { width: px(ENERGY_CHIP_WIDTH), height: px(60) },
    energyIcon: { width: px(20), height: px(20) },
    energyValue: { fontSize: px(13) },
    energyLine: { width: px(49) },
    energyLabel: { fontSize: px(11) },
    editBadge: { width: px(26), height: px(26), borderRadius: px(13) },
    editIcon: Math.max(10, px(12)),
    cameraIcon: px(36),
  };
}

type ScaledStyles = ReturnType<typeof buildScaledStyles>;

export interface ProfileHeroProps {
  topInset: number;
  avatarUri?: string | null;
  name: string;
  username: string;
  isVerified?: boolean;
  isDeveloper?: boolean;
  isOwnProfile?: boolean;
  level: number;
  xp: number;
  nextLevelXp: number;
  progressPct: number;
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
  chooseCountryLabel: string;
  addClubLabel: string;
  energyLabel: string;
  /** Optional CTA under the name (e.g. Follow on public profiles). */
  actionBelowName?: React.ReactNode;
}

const ProfileHero = memo(function ProfileHero({
  topInset,
  avatarUri,
  name,
  username,
  isVerified = false,
  isDeveloper = false,
  isOwnProfile = false,
  level,
  xp,
  nextLevelXp,
  progressPct,
  energyValue,
  countryFlag,
  countryLabel,
  clubLogo,
  clubName,
  isAvatarUploading = false,
  onAvatarPress,
  onCountryPress,
  onClubPress,
  onSharePress,
  onSettingsPress,
  onMorePress,
  onBackPress,
  onLevelPress,
  onEnergyPress,
  chooseCountryLabel,
  addClubLabel,
  energyLabel,
  actionBelowName,
}: ProfileHeroProps) {
  const { width: windowWidth } = useWindowDimensions();
  const sz = useMemo(() => {
    const available = windowWidth - OVERLAY_PADDING_X * 2 - 4;
    return buildScaledStyles(Math.max(0.75, Math.min(1, available / ROW_DESIGN_WIDTH)));
  }, [windowWidth]);
  const avatarSize = sz.avatarSize;
  const hasCountry = isMeaningfulCountryFlag(countryFlag) || !!countryLabel?.trim();
  const hasClub = !!(clubLogo || clubName?.trim());
  const fillPct = Math.max(0, Math.min(1, progressPct > 1 ? progressPct / 100 : progressPct));
  const countryFlagUri = getCountryFlagUri(countryLabel || '', countryFlag, 80);
  const minHeight = actionBelowName ? COVER_HEIGHT + 72 : COVER_HEIGHT;

  return (
    <View style={[styles.wrap, { minHeight }]} testID="profile-hero">
      <View style={styles.coverHit} pointerEvents="none" testID="profile-cover">
        <Image
          source={PROFILE_STADIUM_COVER}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
        />
        <LinearGradient
          colors={['rgba(75,14,133,0)', 'rgba(3,3,3,0.38)', 'rgba(3,3,3,0.92)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.overlay, { paddingTop: topInset + 8 }]} pointerEvents="box-none">
        <View style={styles.nav}>
          {onBackPress ? (
            <TouchableOpacity onPress={onBackPress} hitSlop={10} style={styles.navIcon}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.navIcon} />
          )}
          <View style={styles.navRight}>
            {onSharePress ? (
              <TouchableOpacity
                onPress={onSharePress}
                activeOpacity={0.8}
                style={styles.navCircleBtn}
                accessibilityRole="button"
                accessibilityLabel="Share profile"
              >
                <View style={styles.navCircleIcon}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : null}
            {onSettingsPress ? (
              <TouchableOpacity
                onPress={onSettingsPress}
                activeOpacity={0.8}
                style={styles.navCircleBtn}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <View style={styles.navCircleIcon}>
                  <Ionicons name="settings-outline" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : null}
            {onMorePress ? (
              <TouchableOpacity
                onPress={onMorePress}
                activeOpacity={0.8}
                style={styles.navCircleBtn}
                accessibilityRole="button"
              >
                <View style={styles.navCircleIcon}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={[styles.identityRow, { gap: sz.rowGap }]}>
          <View style={[styles.identityWing, { gap: sz.wingGap }]}>
            <TouchableOpacity
              style={[styles.levelChip, sz.levelChip]}
              onPress={onLevelPress}
              disabled={!onLevelPress}
              activeOpacity={0.85}
            >
              <View style={[styles.levelPill, sz.levelPill]}>
                <Text style={[styles.lvlWord, sz.lvlWord]} allowFontScaling={false}>LVL</Text>
                <Text style={[styles.lvlNum, sz.lvlNum]} allowFontScaling={false}>{level}</Text>
              </View>
              <View style={styles.xpBlock}>
                <View style={[styles.xpTrack, sz.xpTrack]}>
                  <LinearGradient
                    colors={['#5E2990', '#A047F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.xpFill, { width: `${Math.round(fillPct * 100)}%` }]}
                  />
                </View>
                <Text
                  style={[styles.xpCaption, sz.xpCaption]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  allowFontScaling={false}
                >
                  {formatProfileStat(xp)} / {formatProfileStat(nextLevelXp)} XP
                </Text>
              </View>
            </TouchableOpacity>

            <SideSlot
              emptyLabel={chooseCountryLabel}
              filled={hasCountry}
              editable={isOwnProfile}
              onPress={onCountryPress}
              sz={sz}
            >
              {hasCountry ? (
                <>
                  {countryFlagUri ? (
                    <Image
                      source={{ uri: countryFlagUri }}
                      style={sz.flagImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.flag}>{countryFlag?.trim() || '🏳️'}</Text>
                  )}
                  {!!countryLabel?.trim() && (
                    <Text
                      style={[styles.slotCaption, sz.slotCaption]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      allowFontScaling={false}
                    >
                      {countryLabel}
                    </Text>
                  )}
                </>
              ) : null}
            </SideSlot>
          </View>

          <TouchableOpacity
            style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}
            onPress={onAvatarPress}
            activeOpacity={0.9}
            disabled={!onAvatarPress}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { width: avatarSize, height: avatarSize, borderRadius: avatarSize }]}>
                <Ionicons name="camera-outline" size={sz.cameraIcon} color="rgba(216,174,255,0.85)" />
              </View>
            )}
            <LinearGradient
              colors={['rgba(74,7,138,0.18)', 'rgba(19,2,36,0.18)']}
              style={[styles.avatarSheen, { borderRadius: avatarSize }]}
            />
            {isOwnProfile && (
              <LinearGradient
                colors={['rgba(126,21,226,0.92)', 'rgba(69,11,124,0.92)']}
                style={[styles.editBadge, sz.editBadge]}
              >
                <Ionicons name="pencil" size={sz.editIcon} color="#fff" />
              </LinearGradient>
            )}
            {isAvatarUploading && (
              <View style={styles.avatarBusy}>
                <ActivityIndicator color="#D8AEFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.identityWing, styles.identityWingEnd, { gap: sz.wingGap }]}>
            <SideSlot
              emptyLabel={addClubLabel}
              filled={hasClub}
              editable={isOwnProfile}
              onPress={onClubPress}
              sz={sz}
            >
              {hasClub ? (
                <>
                  {clubLogo ? (
                    <Image
                      source={{ uri: clubLogo } as ImageSourcePropType}
                      style={sz.clubLogo}
                      contentFit="contain"
                    />
                  ) : (
                    <Ionicons name="football-outline" size={22} color="#D8AEFF" />
                  )}
                  {!!clubName?.trim() && (
                    <Text
                      style={[styles.slotCaption, sz.slotCaption]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      allowFontScaling={false}
                    >
                      {clubName}
                    </Text>
                  )}
                </>
              ) : null}
            </SideSlot>

            {energyValue != null ? (
              <TouchableOpacity
                style={[styles.energyChip, sz.energyChip]}
                onPress={onEnergyPress}
                disabled={!onEnergyPress}
                activeOpacity={0.85}
              >
                <View style={styles.energyRow}>
                  <Image source={PROFILE_ICONS.energy} style={sz.energyIcon} />
                  <Text
                    style={[styles.energyValue, sz.energyValue]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    allowFontScaling={false}
                  >
                    {formatProfileStat(energyValue)}
                  </Text>
                </View>
                <Image
                  source={PROFILE_ICONS.energyLine}
                  style={[styles.energyLine, sz.energyLine]}
                  contentFit="fill"
                />
                <Text
                  style={[styles.energyLabel, sz.energyLabel]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  allowFontScaling={false}
                >
                  {energyLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={styles.nameBlock}
          onPress={onMorePress}
          disabled={!onMorePress || !isOwnProfile}
          activeOpacity={onMorePress && isOwnProfile ? 0.75 : 1}
          accessibilityRole={onMorePress && isOwnProfile ? 'button' : undefined}
        >
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {name}
            </Text>
            {isVerified && <VerifiedBadge size={18} />}
            {isDeveloper && <DeveloperBadge size={18} />}
          </View>
          <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            @{username}
          </Text>
        </TouchableOpacity>

        {actionBelowName ? <View style={styles.actionBelowName}>{actionBelowName}</View> : null}
      </View>
    </View>
  );
});

function SideSlot({
  emptyLabel,
  filled,
  editable,
  onPress,
  sz,
  children,
}: {
  emptyLabel: string;
  filled: boolean;
  editable: boolean;
  onPress?: () => void;
  sz: ScaledStyles;
  children: React.ReactNode;
}) {
  if (!filled && !editable) return null;
  return (
    <TouchableOpacity
      style={[styles.sideSlot, sz.sideSlot, filled ? styles.sideSlotFilled : styles.sideSlotEmpty]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      {filled ? (
        children
      ) : (
        <>
          <Ionicons name="add" size={sz.addIcon} color="#9E9E9E" />
          <Text
            style={[styles.emptySlotLabel, sz.emptySlotLabel]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            allowFontScaling={false}
          >
            {emptyLabel}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default ProfileHero;

const styles = StyleSheet.create({
  wrap: {
    minHeight: COVER_HEIGHT,
    backgroundColor: ProfileTheme.colors.profileBg,
  },
  coverHit: {
    ...StyleSheet.absoluteFillObject,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    flexGrow: 1,
    paddingHorizontal: OVERLAY_PADDING_X,
    paddingBottom: HERO_BOTTOM_SPACE,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 55,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navCircleBtn: {
    width: 37,
    height: 37,
    borderRadius: 40,
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(0,0,0,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCircleIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  navIcon: {
    width: 37,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  identityWing: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: WING_GAP,
  },
  identityWingEnd: {
    justifyContent: 'flex-end',
  },
  levelChip: {
    width: 74,
    height: 75,
    borderRadius: 11,
    backgroundColor: ProfileTheme.colors.profileChip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 24,
    backgroundColor: '#010602',
    borderWidth: 0.5,
    borderColor: '#64497E',
    borderRadius: 42,
    paddingHorizontal: 10,
    gap: 3,
  },
  lvlWord: {
    color: '#A855F7',
    fontSize: 10,
    fontWeight: '600',
  },
  lvlNum: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  xpBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
  },
  xpTrack: {
    width: 56,
    height: 6,
    borderRadius: 53,
    backgroundColor: '#4A474E',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 53,
  },
  xpCaption: {
    color: '#C8C8C8',
    fontSize: 8,
    fontWeight: '500',
  },
  sideSlot: {
    width: 58,
    height: 77,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sideSlotFilled: {
    backgroundColor: ProfileTheme.colors.profileFilledChip,
    gap: 9,
  },
  sideSlotEmpty: {
    backgroundColor: ProfileTheme.colors.profileEmptyChip,
    gap: 6,
  },
  slotSpacer: {
    width: 0,
    height: 0,
  },
  flag: {
    fontSize: 22,
    lineHeight: 26,
  },
  slotCaption: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySlotLabel: {
    color: '#9E9E9E',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 118,
    borderWidth: 4,
    borderColor: ProfileTheme.colors.avatarRing,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(44,39,55,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 118,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 118,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyChip: {
    width: 68,
    height: 60,
    flexShrink: 0,
    borderRadius: 11,
    backgroundColor: ProfileTheme.colors.profileChip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  energySpacer: {
    width: 0,
    height: 0,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 21,
  },
  energyValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  energyLine: {
    width: 49,
    height: 1,
  },
  energyLabel: {
    color: '#8C8C8C',
    fontSize: 11,
  },
  nameBlock: {
    alignItems: 'center',
    marginTop: 14,
  },
  actionBelowName: {
    marginTop: 14,
    paddingHorizontal: 10,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '90%',
  },
  name: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  handle: {
    color: ProfileTheme.colors.profileHandle,
    fontSize: 18,
    marginTop: 6,
  },
});
