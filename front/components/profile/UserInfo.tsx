import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import VerifiedBadge from './VerifiedBadge';
import DeveloperBadge from './DeveloperBadge';
import { logger } from '../../utils/logger';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';

interface SocialLinks {
  instagram?: string;
  twitter?: string;
  facebook?: string;
}

interface UserInfoProps {
  name: string;
  username: string;
  bio?: string;
  location: string;
  team: string;
  isVerified?: boolean;
  isDeveloper?: boolean;
  onBioLongPress?: () => void;
  onNameLongPress?: () => void;
  clubLogo?: string;
  onEditPress?: () => void;
  socials?: SocialLinks;
  consecutiveLoginDays?: number;
}

const UserInfo = memo(function UserInfo({
  name,
  username,
  bio,
  location,
  team,
  isVerified = false,
  isDeveloper = false,
  onBioLongPress,
  onNameLongPress,
  clubLogo,
  onEditPress,
  socials,
  consecutiveLoginDays = 0,
}: UserInfoProps) {
  const handleSocialPress = (url: string) => {
    Linking.openURL(url).catch(err =>
      logger.error("Couldn't open social link", { url, error: err })
    );
  };

  const hasSocials =
    socials && (socials.instagram || socials.twitter || socials.facebook);

  return (
    <View style={styles.container}>
      {/* ── Name row ─────────────────────────────────────────────── */}
      <TouchableOpacity
        onLongPress={() => {
          if (onNameLongPress) {
            Vibration.vibrate(50);
            onNameLongPress();
          }
        }}
        activeOpacity={0.8}
      >
        <View style={styles.nameRow}>
          {/* Gradient name text */}
          <Text style={styles.name}>{name}</Text>

          {/* Fire streak badge */}
          {consecutiveLoginDays >= 10 && (
            <LinearGradient
              colors={['#FF6B35', '#FF8C42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.streakBadge}
            >
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNumber}>{consecutiveLoginDays}</Text>
            </LinearGradient>
          )}

          {isDeveloper && (
            <View style={styles.badgeWrap}>
              <DeveloperBadge size={22} />
            </View>
          )}
          {isVerified && !isDeveloper && (
            <View style={styles.badgeWrap}>
              <VerifiedBadge size={22} />
            </View>
          )}

          {/* Edit pencil */}
          <TouchableOpacity
            onPress={onEditPress}
            style={styles.editBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {(() => {
              const EditGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
              const editProps = isLiquidGlassSupported
                ? { effect: 'clear' as const, interactive: true }
                : { intensity: 50, tint: 'dark' as const };
              return (
                <EditGlass {...(editProps as any)} style={styles.editBtnBlur}>
                  <Ionicons name="pencil" size={13} color="rgba(255,255,255,0.85)" />
                </EditGlass>
              );
            })()}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Username */}
      <Text style={styles.username}>@{username}</Text>

      {/* ── Location + Club pills ─────────────────────────────────── */}
      <View style={styles.pillsRow}>
        <TouchableOpacity
          style={[
            styles.pill,
            location && location.trim() !== '' && styles.pillActive,
          ]}
          onPress={onEditPress}
          activeOpacity={0.7}
        >
          <Ionicons
            name="location-outline"
            size={14}
            color={
              location && location.trim() !== ''
                ? ProfileTheme.colors.neonGreen
                : 'rgba(255,255,255,0.4)'
            }
          />
          <Text
            style={[
              styles.pillText,
              (!location || location.trim() === '') && styles.pillTextEmpty,
            ]}
            numberOfLines={1}
          >
            {location && location.trim() !== '' ? location : 'اختر بلدك'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, team && styles.pillActive]}
          onPress={onEditPress}
          activeOpacity={0.7}
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
              size={14}
              color={team ? ProfileTheme.colors.gold : 'rgba(255,255,255,0.4)'}
            />
          )}
          <Text
            style={[styles.pillText, !team && styles.pillTextEmpty]}
            numberOfLines={1}
          >
            {team || 'اختر ناديك'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Bio ──────────────────────────────────────────────────── */}
      <TouchableOpacity
        onLongPress={() => {
          if (onBioLongPress) {
            Vibration.vibrate(50);
            onBioLongPress();
          }
        }}
        onPress={onEditPress}
        activeOpacity={0.7}
        style={styles.bioTouchable}
      >
        <Text style={[styles.bio, !bio && styles.bioEmpty]}>
          {bio || 'أضف نبذة عنك...'}
        </Text>
      </TouchableOpacity>

      {/* ── Social icons ─────────────────────────────────────────── */}
      {hasSocials && (
        <View style={styles.socialsRow}>
          {socials?.instagram && (
            <TouchableOpacity
              onPress={() => handleSocialPress(socials.instagram!)}
              style={styles.socialBtn}
            >
              <LinearGradient
                colors={['#833AB4', '#FD1D1D', '#FCAF45']}
                style={styles.socialGrad}
              >
                <FontAwesome name="instagram" size={15} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          {socials?.twitter && (
            <TouchableOpacity
              onPress={() => handleSocialPress(socials.twitter!)}
              style={styles.socialBtn}
            >
              <View style={[styles.socialGrad, { backgroundColor: '#000' }]}>
                <FontAwesome name="twitter" size={15} color="#1DA1F2" />
              </View>
            </TouchableOpacity>
          )}
          {socials?.facebook && (
            <TouchableOpacity
              onPress={() => handleSocialPress(socials.facebook!)}
              style={styles.socialBtn}
            >
              <View style={[styles.socialGrad, { backgroundColor: '#1877F2' }]}>
                <FontAwesome name="facebook" size={15} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

export default UserInfo;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },

  /* Name */
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(255,255,255,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  badgeWrap: { justifyContent: 'center', alignItems: 'center' },

  /* Edit button */
  editBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  editBtnBlur: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  /* Streak */
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 3,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  streakEmoji: { fontSize: 14 },
  streakNumber: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Username */
  username: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
    letterSpacing: 0.8,
  },

  /* Pills */
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
  pillTextEmpty: {
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  clubLogo: { width: 16, height: 16 },

  /* Bio */
  bioTouchable: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 14,
    maxWidth: '92%',
  },
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    textAlign: 'center',
  },
  bioEmpty: {
    color: 'rgba(255,255,255,0.28)',
    fontStyle: 'italic',
  },

  /* Socials */
  socialsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  socialBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
  },
  socialGrad: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
