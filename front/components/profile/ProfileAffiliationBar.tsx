import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
  useWindowDimensions,
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Fixed visual order (same in AR/EN): Club | Country | Level
 * These slots are structural — do not RTL-flip the row.
 */
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
  const { width } = useWindowDimensions();
  const scale = clamp(width / 390, 0.88, 1.05);
  const padH = Math.round(clamp(width * 0.035, 10, 16));
  const marginH = Math.round(clamp(width * 0.045, 12, 20));
  const levelSize = Math.round(14 * scale);
  const labelSize = Math.round(13 * scale);
  const captionSize = Math.round(10 * scale);
  const flagW = Math.round(28 * scale);
  const flagH = Math.round(19 * scale);
  const clubSize = Math.round(28 * scale);

  const fillPct = Math.max(0, Math.min(1, progressPct > 1 ? progressPct / 100 : progressPct));
  const hasCountry = isMeaningfulCountryFlag(countryFlag) || !!countryLabel?.trim();
  const hasClub = !!(clubLogo || clubName?.trim());
  const countryFlagUri = getCountryFlagUri(countryLabel || '', countryFlag, 160);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: C.profileCard,
          borderColor: C.embossBorder,
          shadowColor: C.embossShadow,
          marginHorizontal: marginH,
          paddingHorizontal: padH,
        },
      ]}
      testID="profile-affiliation-bar"
    >
      {/* Club — fixed left */}
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
                style={{ width: clubSize, height: clubSize }}
                contentFit="contain"
              />
            ) : (
              <Ionicons name="football-outline" size={Math.round(20 * scale)} color={C.profilePrimary} />
            )}
            <Text
              style={[styles.clubName, { color: C.textPrimary, fontSize: labelSize }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.15}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {clubName}
            </Text>
          </>
        ) : (
          <Text
            style={[styles.emptyLabel, { color: C.profileMuted, fontSize: captionSize }]}
            numberOfLines={2}
            maxFontSizeMultiplier={1.1}
          >
            {isOwnProfile ? addClubLabel : '—'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: C.divider }]} />

      {/* Country — fixed center */}
      <TouchableOpacity
        style={styles.countryBlock}
        onPress={onCountryPress}
        disabled={!onCountryPress}
        activeOpacity={0.85}
      >
        {hasCountry ? (
          <>
            {countryFlagUri ? (
              <View
                style={[
                  styles.flagFrame,
                  {
                    width: flagW,
                    height: flagH,
                    borderColor: C.embossBorder,
                  },
                ]}
              >
                <Image
                  source={{ uri: countryFlagUri }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="contain"
                  accessibilityLabel={countryLabel || 'flag'}
                />
              </View>
            ) : (
              <Text style={[styles.flagEmoji, { fontSize: Math.round(16 * scale) }]}>
                {countryFlag?.trim() || '🏳️'}
              </Text>
            )}
            <Text
              style={[styles.countryLabel, { color: C.textPrimary, fontSize: labelSize }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.15}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {countryLabel?.trim() || '—'}
            </Text>
          </>
        ) : (
          <Text
            style={[styles.emptyLabel, { color: C.profileMuted, fontSize: captionSize }]}
            numberOfLines={2}
            maxFontSizeMultiplier={1.1}
          >
            {isOwnProfile ? chooseCountryLabel : '—'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: C.divider }]} />

      {/* Level — fixed right */}
      <TouchableOpacity
        style={styles.levelBlock}
        onPress={onLevelPress}
        disabled={!onLevelPress}
        activeOpacity={0.85}
      >
        <Text
          style={[styles.levelLabel, { color: C.textPrimary, fontSize: levelSize }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.15}
          allowFontScaling={false}
        >
          LVL {level}
        </Text>
        <View style={[styles.xpTrack, { backgroundColor: C.xpTrack }]}>
          <View
            style={[
              styles.xpFill,
              {
                width: `${Math.round(fillPct * 100)}%`,
                backgroundColor: C.profilePrimary,
              },
            ]}
          />
        </View>
        <Text
          style={[styles.xpCaption, { color: C.profileMuted, fontSize: captionSize }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          XP {formatProfileStat(xp)} / {formatProfileStat(nextLevelXp)}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export default ProfileAffiliationBar;

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: ProfileTheme.colors.profileCard,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(106,43,217,0.12)',
    shadowColor: '#1E0844',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    // Locked LTR slot order: Club | Country | Level (AR + EN).
    flexDirection: 'row',
  },
  levelBlock: {
    flex: 1.15,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-end',
  },
  levelLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontWeight: '700',
    width: '100%',
    textAlign: 'right',
  },
  xpTrack: {
    width: '100%',
    maxWidth: 108,
    height: 7,
    borderRadius: 9,
    backgroundColor: ProfileTheme.colors.xpTrack,
    overflow: 'hidden',
    alignSelf: 'flex-end',
  },
  xpFill: {
    height: '100%',
    borderRadius: 9,
    backgroundColor: ProfileTheme.colors.profilePrimary,
    alignSelf: 'flex-start',
  },
  xpCaption: {
    color: '#85809A',
    fontWeight: '400',
    width: '100%',
    textAlign: 'right',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: ProfileTheme.colors.divider,
    flexShrink: 0,
  },
  countryBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  countryLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  flagFrame: {
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.04)',
    flexShrink: 0,
  },
  flagEmoji: {
    fontSize: 16,
  },
  clubBlock: {
    flex: 1.1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  clubName: {
    flexShrink: 1,
    minWidth: 0,
    color: ProfileTheme.colors.textPrimary,
    fontWeight: '600',
    textAlign: 'left',
  },
  emptyLabel: {
    color: ProfileTheme.colors.profileMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
});
