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
import * as Haptics from 'expo-haptics';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { getSocialBrandIcon } from './socialBrandIcons';
import { logger } from '../../utils/logger';

interface SocialLink {
  platform: string;
  url: string;
  username?: string;
}

interface ProfileConnectCardProps {
  links: SocialLink[];
  isOwnProfile?: boolean;
  title: string;
  onAddLink?: () => void;
}

const MAX_LINKS = 5;

const ProfileConnectCard = memo(function ProfileConnectCard({
  links,
  isOwnProfile = false,
  title,
  onAddLink,
}: ProfileConnectCardProps) {
  const filled = useMemo(
    () => links.filter((l) => l.url?.trim()),
    [links],
  );

  const plusCount = isOwnProfile
    ? Math.min(MAX_LINKS - filled.length, Math.max(filled.length === 0 ? 3 : 1, 3 - filled.length))
    : 0;

  if (!isOwnProfile && filled.length === 0) return null;

  const openLink = async (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (error) {
      logger.error('Error opening social link', { url, error });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.titleRule} />
      </View>

      <View style={styles.slots}>
        {filled.map((link) => {
          const brand = getSocialBrandIcon(link.platform);
          return (
            <TouchableOpacity
              key={`${link.platform}-${link.url}`}
              style={styles.slot}
              activeOpacity={0.82}
              onPress={() => openLink(link.url)}
            >
              <LinearGradient
                colors={['#170D2B', '#200D44']}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Image
                source={brand.source}
                style={{ width: brand.width, height: brand.height }}
                contentFit="contain"
              />
            </TouchableOpacity>
          );
        })}
        {Array.from({ length: plusCount }).map((_, index) => (
          <TouchableOpacity
            key={`plus-${index}`}
            style={styles.slot}
            activeOpacity={0.82}
            onPress={onAddLink}
          >
            <Ionicons name="add" size={24} color="#9E9E9E" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

export default ProfileConnectCard;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 19,
    marginTop: 24,
    gap: 16,
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
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    height: 62,
    borderRadius: 12,
    backgroundColor: 'rgba(44,39,55,0.3)',
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
