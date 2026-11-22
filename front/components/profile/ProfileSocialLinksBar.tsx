import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useProfileTheme } from '../../hooks/useProfileTheme';
import { useTranslation } from '../../src/i18n';
import { PROFILE_ICONS } from './profileV2Assets';
import { getSocialBrandIcon } from './socialBrandIcons';
import { logger } from '../../utils/logger';

export interface ProfileSocialLink {
  platform: string;
  url: string;
  username?: string;
}

interface ProfileSocialLinksBarProps {
  links: ProfileSocialLink[];
}

const ProfileSocialLinksBar = memo(function ProfileSocialLinksBar({
  links,
}: ProfileSocialLinksBarProps) {
  const { colors: C, isDark } = useProfileTheme();
  const { language, t } = useTranslation();
  const isAr = language === 'ar';

  const filledLinks = useMemo(
    () =>
      links
        .filter((l) => typeof l.url === 'string' && l.url.trim().length > 0)
        .slice(0, 8),
    [links],
  );

  const openSocial = useCallback(async (url: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (error) {
      logger.error('Error opening social link from profile bar', { url, error });
    }
  }, []);

  if (!filledLinks.length) return null;

  const label = t.profile.socialLinks || (isAr ? 'روابط التواصل الاجتماعي' : 'Social Links');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: C.profileCard,
          borderColor: C.embossBorder,
          flexDirection: isAr ? 'row-reverse' : 'row',
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={label}
    >
      <View style={[styles.labelSide, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <Image
          source={PROFILE_ICONS.link}
          style={[styles.chainIcon, { tintColor: C.profilePrimary }]}
          contentFit="contain"
        />
        <Text
          style={[
            styles.label,
            {
              color: C.textPrimary,
              textAlign: isAr ? 'right' : 'left',
            },
          ]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.15}
        >
          {label}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: C.divider }]} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.iconsRow,
          { flexDirection: isAr ? 'row-reverse' : 'row' },
        ]}
        style={styles.iconsScroll}
        bounces={false}
      >
        {filledLinks.map((link) => {
          const brand = getSocialBrandIcon(link.platform);
          const useIon = !isDark && brand.lightInvisible && !!brand.ionicon;
          return (
            <TouchableOpacity
              key={`${link.platform}-${link.url}`}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(106,43,217,0.06)',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(106,43,217,0.1)',
                },
              ]}
              onPress={() => openSocial(link.url)}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel={link.platform}
            >
              {useIon ? (
                <Ionicons
                  name={brand.ionicon!}
                  size={16}
                  color={brand.brandColor || C.profilePrimary}
                />
              ) : (
                <Image
                  source={brand.source}
                  style={{
                    width: Math.min(brand.width, 18),
                    height: Math.min(brand.height, 18),
                    ...(!isDark && brand.lightInvisible
                      ? { tintColor: brand.brandColor || C.textPrimary }
                      : null),
                  }}
                  contentFit="contain"
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default ProfileSocialLinksBar;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 10,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
    backgroundColor: ProfileTheme.colors.profileCard,
    shadowColor: '#1E0844',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  labelSide: {
    flexShrink: 1,
    alignItems: 'center',
    gap: 8,
    maxWidth: 148,
  },
  chainIcon: {
    width: 18,
    height: 18,
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    minHeight: 28,
  },
  iconsScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  iconsRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
