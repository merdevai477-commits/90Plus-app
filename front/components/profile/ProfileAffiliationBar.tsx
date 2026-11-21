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
import { useProfileTheme } from '../../hooks/useProfileTheme';
import { useTranslation } from '../../src/i18n';
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
  const { colors: C } = useProfileTheme();
  const { language } = useTranslation();
  const isAr = language === 'ar';
  const fillPct = Math.max(0, Math.min(1, progressPct > 1 ? progressPct / 100 : progressPct));
  const hasCountry = isMeaningfulCountryFlag(countryFlag) || !!countryLabel?.trim();
  const hasClub = !!(clubLogo || clubName?.trim());
  const countryFlagUri = getCountryFlagUri(countryLabel || '', countryFlag, 80);

  return (
    <View
      style={[
        styles.wrap,
        isAr ? styles.wrapRtl : styles.wrapLtr,
        {
          backgroundColor: C.profileCard,
          borderColor: C.embossBorder,
          shadowColor: C.embossShadow,
        },
      ]}
      testID="profile-affiliation-bar"
    >
      <TouchableOpacity
        style={[styles.levelBlock, isAr && styles.alignEnd]}
        onPress={onLevelPress}
        disabled={!onLevelPress}
        activeOpacity={0.85}
      >
        <Text style={[styles.levelLabel, { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' }]}>
          LVL {level}
        </Text>
        <View style={[styles.xpTrack, { backgroundColor: C.xpTrack }]}>
          <View
            style={[
              styles.xpFill,
              {
                width: `${Math.round(fillPct * 100)}%`,
                backgroundColor: C.profilePrimary,
                alignSelf: isAr ? 'flex-end' : 'flex-start',
              },
            ]}
          />
        </View>
        <Text
          style={[styles.xpCaption, { color: C.profileMuted, textAlign: isAr ? 'right' : 'left' }]}
          numberOfLines={1}
        >
          XP {formatProfileStat(xp)} / {formatProfileStat(nextLevelXp)}
        </Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: C.divider }]} />

      <TouchableOpacity
        style={[styles.countryBlock, isAr ? styles.rowReverse : styles.rowForward]}
        onPress={onCountryPress}
        disabled={!onCountryPress}
        activeOpacity={0.85}
      >
        {hasCountry ? (
          <>
            <Text
              style={[styles.countryLabel, { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' }]}
              numberOfLines={1}
            >
              {countryLabel?.trim() || '—'}
            </Text>
            {countryFlagUri ? (
              <Image source={{ uri: countryFlagUri }} style={styles.flag} contentFit="cover" />
            ) : (
              <Text style={styles.flagEmoji}>{countryFlag?.trim() || '🏳️'}</Text>
            )}
          </>
        ) : (
          <Text style={[styles.emptyLabel, { color: C.profileMuted }]} numberOfLines={2}>
            {isOwnProfile ? chooseCountryLabel : '—'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: C.divider }]} />

      <TouchableOpacity
        style={[styles.clubBlock, isAr ? styles.rowReverse : styles.rowForward]}
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
              <Ionicons name="football-outline" size={22} color={C.profilePrimary} />
            )}
            <Text
              style={[styles.clubName, { color: C.textPrimary, textAlign: isAr ? 'right' : 'left' }]}
              numberOfLines={2}
            >
              {clubName}
            </Text>
          </>
        ) : (
          <Text style={[styles.emptyLabel, { color: C.profileMuted }]} numberOfLines={2}>
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
    marginTop: 10,
    minHeight: 76,
    borderRadius: 20,
    backgroundColor: ProfileTheme.colors.profileCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(106,43,217,0.12)',
    shadowColor: '#1E0844',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  wrapRtl: {
    flexDirection: 'row-reverse',
  },
  wrapLtr: {
    flexDirection: 'row',
  },
  levelBlock: {
    width: 105,
    gap: 3,
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  levelLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    width: 96,
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
    width: 105,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: ProfileTheme.colors.divider,
  },
  countryBlock: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 110,
    flexShrink: 1,
  },
  rowForward: {
    flexDirection: 'row',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  countryLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
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
    alignItems: 'center',
    gap: 6,
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
