import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileTheme } from '../../constants/ProfileTheme';
import * as Haptics from 'expo-haptics';
import { logger } from '../../utils/logger';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useTranslation } from '../../src/i18n';

interface SocialIconConfig {
  icon: keyof typeof FontAwesome.glyphMap | keyof typeof Ionicons.glyphMap;
  iconLibrary: 'FontAwesome' | 'Ionicons';
  colors: readonly [string, string];
}

const SOCIAL_ICONS: Record<string, SocialIconConfig> = {
  instagram: {
    icon: 'instagram',
    iconLibrary: 'FontAwesome',
    colors: ['#833AB4', '#FD1D1D'],
  },
  twitter: {
    icon: 'twitter',
    iconLibrary: 'FontAwesome',
    colors: ['#1DA1F2', '#0d8ecf'],
  },
  tiktok: {
    icon: 'musical-notes',
    iconLibrary: 'Ionicons',
    colors: ['#010101', '#69C9D0'],
  },
  youtube: {
    icon: 'youtube-play',
    iconLibrary: 'FontAwesome',
    colors: ['#FF0000', '#cc0000'],
  },
  facebook: {
    icon: 'facebook',
    iconLibrary: 'FontAwesome',
    colors: ['#1877F2', '#0d5dbf'],
  },
  snapchat: {
    icon: 'snapchat',
    iconLibrary: 'FontAwesome',
    colors: ['#FFFC00', '#e6e300'],
  },
  linkedin: {
    icon: 'linkedin',
    iconLibrary: 'FontAwesome',
    colors: ['#0A66C2', '#084d94'],
  },
  website: {
    icon: 'globe',
    iconLibrary: 'Ionicons',
    colors: ['#22c55e', '#16a34a'],
  },
};

interface SocialLink {
  platform: string;
  url: string;
  username?: string;
}

interface SocialLinksSectionProps {
  links: SocialLink[];
  isOwnProfile?: boolean;
  onEditPress?: () => void;
}

export default function SocialLinksSection({
  links,
  isOwnProfile = false,
  onEditPress,
}: SocialLinksSectionProps) {
  const { t } = useTranslation();

  const handleLinkPress = async (link: SocialLink) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const canOpen = await Linking.canOpenURL(link.url);
      if (canOpen) await Linking.openURL(link.url);
    } catch (error) {
      logger.error('Error opening social link', { url: link.url, error });
    }
  };

  if (links.length === 0 && !isOwnProfile) return null;

  return (
    <View style={styles.container}>
      {links.length > 0 ? (
        <View style={styles.row}>
          {links.map((link, index) => {
            const social =
              SOCIAL_ICONS[link.platform.toLowerCase()] ?? SOCIAL_ICONS.website;
            const IconComp =
              social.iconLibrary === 'FontAwesome' ? FontAwesome : Ionicons;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleLinkPress(link)}
                activeOpacity={0.75}
                style={styles.iconWrap}
              >
                <LinearGradient
                  colors={social.colors}
                  style={styles.iconGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <IconComp name={social.icon as any} size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {/* Add more button */}
          {isOwnProfile && links.length < 5 && (
            <TouchableOpacity
              style={styles.addWrap}
              onPress={onEditPress}
              activeOpacity={0.7}
            >
              <View style={styles.addInner}>
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.5)" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      ) : isOwnProfile ? (
        (() => {
          const EmptyGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
          const emptyProps = isLiquidGlassSupported
            ? { effect: 'clear' as const, interactive: true }
            : { intensity: 20, tint: 'dark' as const };
          return (
            <TouchableOpacity onPress={onEditPress} activeOpacity={0.8} style={styles.emptyBtnWrap}>
              <EmptyGlass {...(emptyProps as any)} style={StyleSheet.absoluteFill} />
              <Ionicons name="add-circle-outline" size={18} color="rgba(255,255,255,0.6)" />
              <Text style={styles.emptyText}>{t.profile.addSocialLinks}</Text>
            </TouchableOpacity>
          );
        })()
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  iconGrad: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWrap: {},
  addInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emptyBtnWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(255,255,255,0.03)',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    fontWeight: '500',
  },
});
