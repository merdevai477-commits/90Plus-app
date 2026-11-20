import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { formatProfileStat } from './formatProfileStat';
import { isMeaningfulCountryFlag } from '../../utils/countryDisplay';
import { getCountryFlagUri } from '../../utils/countryFlagUri';

export interface ProfileAffiliationBarProps {
  level: number;
  xp: number;
  nextLevelXp: number;
  progressPct: number;
  countryFlag?: string | null;
  countryLabel?: string | null;
  clubLogo?: string | null;
  clubName?: string | null;
  isOwnProfile?: boolean;
  onLevelPress?: () => void;
  onCountryPress?: () => void;
  onClubPress?: () => void;
  chooseCountryLabel: string;
  addClubLabel: string;
}

const ProfileAffiliationBar = memo(function ProfileAffiliationBar({
  level,
  xp,
  nextLevelXp,
  progressPct,
  countryFlag,
  countryLabel,
  clubLogo,
  clubName,
  isOwnProfile = false,
  onLevelPress,
  onCountryPress,
  onClubPress,
  chooseCountryLabel,
  addClubLabel,
}: ProfileAffiliationBarProps) {
  const fillPct = Math.max(0, Math.min(1, progressPct > 1 ? progressPct / 100 : progressPct));
  const hasCountry = isMeaningfulCountryFlag(countryFlag) || !!countryLabel?.trim();
  const hasClub = !!(clubLogo || clubName?.trim());
  const countryFlagUri = getCountryFlagUri(countryLabel || '', countryFlag, 80);

  return (
    <View style={styles.wrap} testID="profile-affiliation-bar">
      <TouchableOpacity
        style={styles.levelBlock}
        onPress={onLevelPress}
        disabled={!onLevelPress}
        activeOpacity={0.85}
      >
        <View style={styles.levelHeader}>
          <Ionicons name="chevron-back" size={14} color={ProfileTheme.colors.textPrimary} />
          <Text style={styles.levelLabel}>LVL {level}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.round(fillPct * 100)}%` }]} />
        </View>
        <Text style={styles.xpCaption} numberOfLines={1}>
          XP {formatProfileStat(xp)} / {formatProfileStat(nextLevelXp)}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.countryBlock}
        onPress={onCountryPress}
        disabled={!onCountryPress}
        activeOpacity={0.85}
      >
        {hasCountry ? (
          <>
            <Text style={styles.countryLabel} numberOfLines={1}>
              {countryLabel?.trim() || '—'}
            </Text>
            {countryFlagUri ? (
              <Image source={{ uri: countryFlagUri }} style={styles.flag} contentFit="cover" />
            ) : (
              <Text style={styles.flagEmoji}>{countryFlag?.trim() || '🏳️'}</Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyLabel} numberOfLines={2}>
            {isOwnProfile ? chooseCountryLabel : '—'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.clubBlock}
        onPress={onClubPress}
        disabled={!onClubPress}
        activeOpacity={0.85}
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
              <Ionicons name="football-outline" size={22} color={ProfileTheme.colors.profilePrimary} />
            )}
            <Text style={styles.clubName} numberOfLines={2}>
              {clubName}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyLabel} numberOfLines={2}>
            {isOwnProfile ? addClubLabel : '—'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

export default ProfileAffiliationBar;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 76,
    borderRadius: 20,
    backgroundColor: ProfileTheme.colors.profileCard,
    paddingLeft: 14,
    paddingRight: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelBlock: {
    width: 105,
    gap: 3,
    alignItems: 'flex-start',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  levelLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: 88,
  },
  xpTrack: {
    width: 96,
    height: 7,
    borderRadius: 9,
    backgroundColor: ProfileTheme.colors.xpTrack,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 9,
    backgroundColor: ProfileTheme.colors.profilePrimary,
  },
  xpCaption: {
    color: '#85809A',
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    width: 105,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: ProfileTheme.colors.divider,
  },
  countryBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 96,
  },
  countryLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  flag: {
    width: 21,
    height: 21,
    borderRadius: 3,
  },
  flagEmoji: {
    fontSize: 16,
  },
  clubBlock: {
    width: 123,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  clubLogo: {
    width: 31,
    height: 32,
  },
  clubName: {
    flex: 1,
    color: ProfileTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyLabel: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
