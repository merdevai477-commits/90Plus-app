import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
  Dimensions,
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

const COVER_HEIGHT = 420;
const AVATAR_SIZE = 101;

export interface ProfileHeroProps {
  topInset: number;
  coverUri?: string | null;
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
  onCoverPress?: () => void;
  onAvatarPress?: () => void;
  onCountryPress?: () => void;
  onClubPress?: () => void;
  onSharePress?: () => void;
  onMorePress?: () => void;
  onBackPress?: () => void;
  onLevelPress?: () => void;
  onEnergyPress?: () => void;
  chooseCountryLabel: string;
  addClubLabel: string;
  energyLabel: string;
}

const ProfileHero = memo(function ProfileHero({
  topInset,
  coverUri,
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
  onCoverPress,
  onAvatarPress,
  onCountryPress,
  onClubPress,
  onSharePress,
  onMorePress,
  onBackPress,
  onLevelPress,
  onEnergyPress,
  chooseCountryLabel,
  addClubLabel,
  energyLabel,
}: ProfileHeroProps) {
  const compact = Dimensions.get('window').width < 380;
  const avatarSize = compact ? 84 : AVATAR_SIZE;
  const hasCountry = isMeaningfulCountryFlag(countryFlag) || !!countryLabel?.trim();
  const hasClub = !!(clubLogo || clubName?.trim());
  const fillPct = Math.max(0, Math.min(1, progressPct > 1 ? progressPct / 100 : progressPct));

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.96}
        onPress={onCoverPress}
        disabled={!onCoverPress}
        style={styles.coverHit}
      >
        <Image
          source={coverUri ? { uri: coverUri } : PROFILE_STADIUM_COVER}
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
      </TouchableOpacity>

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
              >
                <View style={styles.navCircleIcon}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
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

        <View style={styles.identityRow}>
          <TouchableOpacity
            style={styles.levelChip}
            onPress={onLevelPress}
            disabled={!onLevelPress}
            activeOpacity={0.85}
          >
            <View style={styles.levelPill}>
              <Text style={styles.lvlWord}>LVL</Text>
              <Text style={styles.lvlNum}>{level}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.round(fillPct * 100)}%` }]} />
            </View>
            <Text style={styles.xpCaption} numberOfLines={1}>
              {formatProfileStat(xp)} / {formatProfileStat(nextLevelXp)} XP
            </Text>
          </TouchableOpacity>

          <SideSlot
            emptyLabel={chooseCountryLabel}
            filled={hasCountry}
            editable={isOwnProfile}
            onPress={onCountryPress}
          >
            {hasCountry ? (
              <>
                <Text style={styles.flag}>{countryFlag?.trim() || '🏳️'}</Text>
                {!!countryLabel?.trim() && (
                  <Text style={styles.slotCaption} numberOfLines={1}>
                    {countryLabel}
                  </Text>
                )}
              </>
            ) : null}
          </SideSlot>

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
                <Ionicons name="camera-outline" size={compact ? 28 : 36} color="rgba(216,174,255,0.85)" />
              </View>
            )}
            <LinearGradient
              colors={['rgba(74,7,138,0.18)', 'rgba(19,2,36,0.18)']}
              style={[styles.avatarSheen, { borderRadius: avatarSize }]}
            />
            {isOwnProfile && (
              <LinearGradient
                colors={['rgba(126,21,226,0.92)', 'rgba(69,11,124,0.92)']}
                style={styles.editBadge}
              >
                <Ionicons name="pencil" size={12} color="#fff" />
              </LinearGradient>
            )}
            {isAvatarUploading && (
              <View style={styles.avatarBusy}>
                <ActivityIndicator color="#D8AEFF" />
              </View>
            )}
          </TouchableOpacity>

          <SideSlot
            emptyLabel={addClubLabel}
            filled={hasClub}
            editable={isOwnProfile}
            onPress={onClubPress}
          >
            {hasClub ? (
              <>
                {clubLogo ? (
                  <Image
                    source={{ uri: clubLogo } as ImageSourcePropType}
                    style={styles.clubLogo}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons name="football-outline" size={22} color="#D8AEFF" />
                )}
                {!!clubName?.trim() && (
                  <Text style={styles.slotCaption} numberOfLines={1}>
                    {clubName}
                  </Text>
                )}
              </>
            ) : null}
          </SideSlot>

          {energyValue != null ? (
            <TouchableOpacity
              style={styles.energyChip}
              onPress={onEnergyPress}
              disabled={!onEnergyPress}
              activeOpacity={0.85}
            >
              <View style={styles.energyRow}>
                <Image source={PROFILE_ICONS.energy} style={styles.energyIcon} />
                <Text style={styles.energyValue}>{formatProfileStat(energyValue)}</Text>
              </View>
              <View style={styles.energyLine} />
              <Text style={styles.energyLabel}>{energyLabel}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.energySpacer} />
          )}
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {isVerified && <VerifiedBadge size={18} />}
            {isDeveloper && <DeveloperBadge size={18} />}
          </View>
          <Text style={styles.handle} numberOfLines={1}>
            @{username}
          </Text>
        </View>
      </View>
    </View>
  );
});

function SideSlot({
  emptyLabel,
  filled,
  editable,
  onPress,
  children,
}: {
  emptyLabel: string;
  filled: boolean;
  editable: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  if (!filled && !editable) return <View style={styles.slotSpacer} />;
  return (
    <TouchableOpacity
      style={styles.sideSlot}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      {filled ? (
        children
      ) : (
        <>
          <Ionicons name="add" size={24} color="#9E9E9E" />
          <Text style={styles.emptySlotLabel} numberOfLines={2}>
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
    height: COVER_HEIGHT,
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
    flex: 1,
    paddingHorizontal: 12,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
    justifyContent: 'space-between',
    gap: 2,
  },
  levelChip: {
    width: 78,
    height: 75,
    borderRadius: 11,
    backgroundColor: ProfileTheme.colors.profileChip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: '#010602',
    borderWidth: 0.5,
    borderColor: '#64497E',
    borderRadius: 42,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  xpTrack: {
    width: 64,
    height: 6,
    borderRadius: 53,
    backgroundColor: '#4A474E',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 53,
    backgroundColor: '#A047F6',
  },
  xpCaption: {
    color: '#C8C8C8',
    fontSize: 8,
    fontWeight: '500',
  },
  sideSlot: {
    width: 62,
    height: 77,
    borderRadius: 11,
    backgroundColor: ProfileTheme.colors.profileEmptyChip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  slotSpacer: {
    width: 62,
    height: 77,
  },
  flag: {
    fontSize: 22,
    lineHeight: 26,
  },
  clubLogo: {
    width: 28,
    height: 40,
  },
  slotCaption: {
    color: '#9E9E9E',
    fontSize: 10,
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
    width: 77,
    height: 60,
    borderRadius: 11,
    backgroundColor: ProfileTheme.colors.profileChip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  energySpacer: {
    width: 77,
    height: 60,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  energyIcon: {
    width: 20,
    height: 20,
  },
  energyValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  energyLine: {
    width: 49,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  energyLabel: {
    color: '#8C8C8C',
    fontSize: 12,
  },
  nameBlock: {
    alignItems: 'center',
    marginTop: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '90%',
  },
  name: {
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
