import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { PROFILE_ICONS } from './profileV2Assets';
import { logger } from '../../utils/logger';
import { toastManager } from '../../services/toastManager';

interface SocialLink {
  platform: string;
  url: string;
  username?: string;
}

export type ConnectSlotId = 'whatsapp' | 'instagram' | 'tiktok';

interface ProfileConnectCardProps {
  links: SocialLink[];
  email?: string | null;
  isOwnProfile?: boolean;
  title: string;
  emailCopiedTitle: string;
  emailCopiedMessage: string;
  onAddLink?: (platform: ConnectSlotId) => void;
}

const SLOTS: Array<{
  id: ConnectSlotId;
  icon: number;
  width: number;
  height: number;
}> = [
  { id: 'whatsapp', icon: PROFILE_ICONS.whatsapp, width: 33, height: 37 },
  { id: 'instagram', icon: PROFILE_ICONS.instagram, width: 33, height: 33 },
  { id: 'tiktok', icon: PROFILE_ICONS.tiktok, width: 30, height: 33 },
];

const ProfileConnectCard = memo(function ProfileConnectCard({
  links,
  email,
  isOwnProfile = false,
  title,
  emailCopiedTitle,
  emailCopiedMessage,
  onAddLink,
}: ProfileConnectCardProps) {
  const byPlatform = useMemo(() => {
    const map: Record<string, SocialLink> = {};
    for (const link of links) {
      map[link.platform.toLowerCase()] = link;
    }
    return map;
  }, [links]);

  const hasEmail = !!email?.trim();
  const hasAnySlot = SLOTS.some((s) => byPlatform[s.id]);
  const hasExtraLinks = links.some(
    (l) => !SLOTS.some((s) => s.id === l.platform.toLowerCase()),
  );
  if (!isOwnProfile && !hasAnySlot && !hasExtraLinks && !hasEmail) return null;

  const openLink = async (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (error) {
      logger.error('Error opening social link', { url, error });
    }
  };

  const copyEmail = async () => {
    if (!email) return;
    await Clipboard.setStringAsync(email);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toastManager.showSuccess(emailCopiedTitle, emailCopiedMessage);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.titleRule} />
      </View>

      <View style={styles.body}>
        <View style={styles.slots}>
          {SLOTS.map((slot) => {
            const link = byPlatform[slot.id];
            return (
              <TouchableOpacity
                key={slot.id}
                style={styles.slot}
                activeOpacity={0.82}
                onPress={() => {
                  if (link) openLink(link.url);
                  else onAddLink?.(slot.id);
                }}
                disabled={!link && !isOwnProfile}
              >
                {link ? (
                  <LinearGradient
                    colors={['#170D2B', '#200D44']}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                {link ? (
                  <Image
                    source={slot.icon}
                    style={{ width: slot.width, height: slot.height }}
                    contentFit="contain"
                  />
                ) : isOwnProfile ? (
                  <Ionicons name="add" size={24} color="#9E9E9E" />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {hasEmail && (
          <TouchableOpacity style={styles.emailRow} onPress={copyEmail} activeOpacity={0.85}>
            <LinearGradient
              colors={['#170D2B', '#200D44']}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.emailLeft}>
              <Image source={PROFILE_ICONS.email} style={styles.emailIcon} contentFit="contain" />
              <Text style={styles.emailText} numberOfLines={1}>
                {email}
              </Text>
            </View>
            <Image source={PROFILE_ICONS.copy} style={styles.copyIcon} contentFit="contain" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default ProfileConnectCard;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 19,
    marginTop: 24,
    gap: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  titleRule: {
    width: 2,
    height: 20,
    borderRadius: 2,
    backgroundColor: ProfileTheme.colors.profilePrimary,
  },
  body: {
    width: '100%',
    gap: 16,
  },
  slots: {
    flexDirection: 'row',
    gap: 8,
  },
  slot: {
    flex: 1,
    height: 62,
    borderRadius: 12,
    backgroundColor: 'rgba(44,39,55,0.3)',
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emailRow: {
    height: 55,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  emailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  emailIcon: {
    width: 27,
    height: 29,
  },
  emailText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  copyIcon: {
    width: 20,
    height: 20,
  },
});
