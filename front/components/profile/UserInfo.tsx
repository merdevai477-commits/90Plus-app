import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Flame } from 'lucide-react-native';
import { ProfileTheme } from '../../constants/ProfileTheme';
import VerifiedBadge from './VerifiedBadge';
import DeveloperBadge from './DeveloperBadge';
import { resolveCountryDisplayName, isMeaningfulCountryFlag } from '../../utils/countryDisplay';
import { useTranslation } from '../../src/i18n';

interface UserInfoProps {
  name: string;
  username: string;
  bio?: string;
  location?: string;
  countryFlag?: string;
  team?: string;
  isVerified?: boolean;
  isDeveloper?: boolean;
  onBioLongPress?: () => void;
  onNameLongPress?: () => void;
  clubLogo?: string;
  onEditPress?: () => void;
  onCountryPress?: () => void;
  onClubPress?: () => void;
  consecutiveLoginDays?: number;
  /** When `bio`, only the bio field is shown — name/country/club live on the FIFA card. */
  variant?: 'full' | 'bio';
}

const UserInfo = memo(function UserInfo({
  name,
  username,
  bio,
  location,
  countryFlag,
  team,
  isVerified = false,
  isDeveloper = false,
  onBioLongPress,
  onNameLongPress,
  clubLogo,
  onEditPress,
  onCountryPress,
  onClubPress,
  consecutiveLoginDays = 0,
  variant = 'full',
}: UserInfoProps) {
  const { t, language, isRTL } = useTranslation();
  const preferArabic = language === 'ar';
  const textAlign = isRTL ? 'right' : 'left';

  const displayCountry = resolveCountryDisplayName(location, countryFlag, preferArabic);
  const hasLocation = displayCountry.length > 0;
  const displayFlag = isMeaningfulCountryFlag(countryFlag) ? countryFlag!.trim() : null;
  const hasTeam = !!team?.trim();

  if (variant === 'bio') {
    return (
      <View style={styles.bioOnlyContainer}>
        {(isVerified || isDeveloper || consecutiveLoginDays >= 10) ? (
          <View style={styles.bioBadgesRow}>
            {consecutiveLoginDays >= 10 ? (
              <LinearGradient
                colors={['#FF6B35', '#FF8C42']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.streakBadge}
              >
                <Flame size={12} color="#fff" fill="#fff" strokeWidth={2} />
                <Text style={styles.streakNumber}>{consecutiveLoginDays}</Text>
              </LinearGradient>
            ) : null}
            {isDeveloper ? <DeveloperBadge size={18} /> : null}
            {isVerified && !isDeveloper ? <VerifiedBadge size={18} /> : null}
          </View>
        ) : null}

        <TouchableOpacity
          onLongPress={() => {
            if (onBioLongPress) {
              Vibration.vibrate(50);
              onBioLongPress();
            }
          }}
          onPress={onEditPress}
          activeOpacity={0.7}
          style={styles.bioTouch}
        >
          <Text style={[styles.bio, !bio && styles.bioEmpty, { textAlign }]}>
            {bio?.trim() || t.profile.bioPlaceholder}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onLongPress={() => {
          if (onNameLongPress) {
            Vibration.vibrate(50);
            onNameLongPress();
          }
        }}
        activeOpacity={0.85}
        style={styles.nameBlock}
      >
        <View style={styles.nameRow}>
          <Text style={[styles.name, { textAlign }]} numberOfLines={2}>
            {name}
          </Text>

          {consecutiveLoginDays >= 10 ? (
            <LinearGradient
              colors={['#FF6B35', '#FF8C42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.streakBadge}
              accessibilityLabel={`${consecutiveLoginDays} day streak`}
            >
              <Flame size={12} color="#fff" fill="#fff" strokeWidth={2} />
              <Text style={styles.streakNumber}>{consecutiveLoginDays}</Text>
            </LinearGradient>
          ) : null}

          {isDeveloper ? (
            <View style={styles.badgeWrap}>
              <DeveloperBadge size={20} />
            </View>
          ) : null}
          {isVerified && !isDeveloper ? (
            <View style={styles.badgeWrap}>
              <VerifiedBadge size={20} />
            </View>
          ) : null}
        </View>

        <Text style={[styles.username, { textAlign }]} numberOfLines={1}>
          @{username}
        </Text>
      </TouchableOpacity>

      <View style={styles.metaRow}>
        {onCountryPress ? (
          <TouchableOpacity
            onPress={onCountryPress}
            activeOpacity={0.75}
            style={styles.metaChip}
          >
            {displayFlag ? (
              <Text style={styles.flagEmoji}>{displayFlag}</Text>
            ) : (
              <Ionicons
                name="location-outline"
                size={13}
                color={hasLocation ? ProfileTheme.colors.neonGreen : 'rgba(255,255,255,0.35)'}
              />
            )}
            <Text
              style={[styles.metaText, !hasLocation && styles.metaTextEmpty]}
              numberOfLines={1}
            >
              {hasLocation ? displayCountry : t.profile.chooseCountry}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.metaChip}>
            {displayFlag ? (
              <Text style={styles.flagEmoji}>{displayFlag}</Text>
            ) : (
              <Ionicons
                name="location-outline"
                size={13}
                color={hasLocation ? ProfileTheme.colors.neonGreen : 'rgba(255,255,255,0.35)'}
              />
            )}
            <Text
              style={[styles.metaText, !hasLocation && styles.metaTextEmpty]}
              numberOfLines={1}
            >
              {hasLocation ? displayCountry : t.profile.chooseCountry}
            </Text>
          </View>
        )}

        <View style={styles.metaDivider} />

        {onClubPress ? (
          <TouchableOpacity
            onPress={onClubPress}
            activeOpacity={0.75}
            style={styles.metaChip}
          >
            {clubLogo ? (
              <Image
                source={{ uri: clubLogo }}
                style={styles.clubLogo}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons
                name="football-outline"
                size={13}
                color={hasTeam ? '#A855F7' : 'rgba(255,255,255,0.35)'}
              />
            )}
            <Text
              style={[styles.metaText, !hasTeam && styles.metaTextEmpty]}
              numberOfLines={1}
            >
              {hasTeam ? team : t.profile.chooseClub}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.metaChip}>
            {clubLogo ? (
              <Image
                source={{ uri: clubLogo }}
                style={styles.clubLogo}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons
                name="football-outline"
                size={13}
                color={hasTeam ? '#A855F7' : 'rgba(255,255,255,0.35)'}
              />
            )}
            <Text
              style={[styles.metaText, !hasTeam && styles.metaTextEmpty]}
              numberOfLines={1}
            >
              {hasTeam ? team : t.profile.chooseClub}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onLongPress={() => {
          if (onBioLongPress) {
            Vibration.vibrate(50);
            onBioLongPress();
          }
        }}
        onPress={onEditPress}
        activeOpacity={0.7}
        style={styles.bioTouch}
      >
        <Text style={[styles.bio, !bio && styles.bioEmpty, { textAlign }]}>
          {bio?.trim() || t.profile.bioPlaceholder}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export default UserInfo;

const styles = StyleSheet.create({
  bioOnlyContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    gap: 10,
  },
  bioBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 20,
    gap: 14,
  },
  nameBlock: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  badgeWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  streakNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  username: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.42)',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  metaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 0,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metaText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  metaTextEmpty: {
    color: 'rgba(255,255,255,0.32)',
    fontWeight: '500',
  },
  clubLogo: { width: 15, height: 15 },
  flagEmoji: { fontSize: 13, lineHeight: 15 },
  bioTouch: {
    width: '100%',
  },
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 21,
  },
  bioEmpty: {
    color: 'rgba(255,255,255,0.24)',
  },
});
