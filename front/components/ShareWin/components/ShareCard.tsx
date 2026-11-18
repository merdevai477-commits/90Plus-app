/**
 * Invite & Share card — Figma Frame123 nodes 2022:6546 / 2022:6583.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { buildReferralSharePayload } from '../../../constants/shareLinks';
import { useTranslation } from '../../../src/i18n';
import type { ShareChannel } from '../../../hooks/useShareWin';
import { confirmExternalShare } from '../../../utils/confirmExternalShare';
import { logger } from '../../../utils/logger';
import { SW_ASSET } from '../assets';
import { compactLink } from '../data';
import { useShareWinStyles } from '../styles';

interface ShareCardProps {
  referralCode: string;
  referralLink: string;
  onCopyLink: () => void;
  onShared: (channel: ShareChannel) => void;
  onFallbackShare: (channel: ShareChannel) => void;
}

const ShareCard = memo(function ShareCard({
  referralCode,
  referralLink,
  onCopyLink,
  onShared,
  onFallbackShare,
}: ShareCardProps) {
  const { metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s, f } = metrics;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          width: '100%',
          gap: s(16),
        },
        card: {
          width: '100%',
          borderRadius: s(22),
          backgroundColor: theme.pale,
          padding: s(10),
          gap: s(13),
          alignItems: 'center',
          overflow: 'hidden',
          shadowColor: '#6A2BD9',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: theme.isDark ? 0.2 : 0.12,
          shadowRadius: 7,
          elevation: 4,
        },
        cardTexture: {
          ...StyleSheet.absoluteFillObject,
          opacity: 0.2,
        },
        title: {
          fontSize: f(14),
          fontWeight: '700',
          color: theme.ink,
          textAlign: 'center',
          width: '100%',
        },
        linkRow: {
          width: '100%',
          height: s(44),
          borderRadius: s(14),
          backgroundColor: theme.card,
          // Figma: link icon left, copy button right (URL stays LTR)
          flexDirection: 'row',
          alignItems: 'center',
          padding: s(6),
          gap: s(8),
          zIndex: 1,
        },
        linkText: {
          flex: 1,
          fontSize: f(10.5),
          fontWeight: '600',
          color: theme.ink,
        },
        copyBtn: {
          width: s(42),
          height: s(32),
          borderRadius: s(11),
          backgroundColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#6A2BD9',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.22,
          shadowRadius: 7,
          elevation: 3,
        },
        socials: {
          width: '100%',
          flexDirection: 'row',
          gap: s(6),
          height: s(62),
        },
        socialTile: {
          flex: 1,
          height: s(62),
          borderRadius: s(14),
          backgroundColor: theme.card,
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(1),
          padding: s(4),
          shadowColor: '#4B1FA3',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.isDark ? 0.2 : 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        socialIcon: {
          width: s(30),
          height: s(30),
        },
        socialLabel: {
          fontSize: f(9.5),
          fontWeight: '600',
          color: theme.ink,
          textAlign: 'center',
        },
        hint: {
          width: '100%',
          borderRadius: s(12),
          backgroundColor: theme.hintBg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: s(17),
          paddingVertical: s(11),
          gap: s(12),
        },
        hintText: {
          flex: 1,
          fontSize: f(12),
          fontWeight: '600',
          color: theme.dark,
          textAlign: 'right',
          lineHeight: f(18),
        },
        bullet: {
          width: s(8),
          height: s(8),
        },
      }),
    [f, s, theme],
  );

  const shareVia = useCallback(
    async (channel: ShareChannel, schemeUrl: string | null) => {
      if (schemeUrl) {
        try {
          if (await Linking.canOpenURL(schemeUrl)) {
            await Linking.openURL(schemeUrl);
            if (await confirmExternalShare(undefined, ['background'])) {
              onShared(channel);
              return;
            }
          }
        } catch (error) {
          logger.debug(`[ShareWin] ${channel} scheme unavailable:`, error);
        }
      }
      onFallbackShare(channel);
    },
    [onFallbackShare, onShared],
  );

  const channels: {
    id: ShareChannel;
    label: string;
    icon: number;
    scheme: string | null;
  }[] = [
    {
      id: 'facebook',
      label: copy.channelFacebook,
      icon: SW_ASSET.facebookV2,
      scheme: `fb://share?u=${encodeURIComponent(referralLink)}`,
    },
    {
      id: 'instagram',
      label: copy.channelInstagram,
      icon: SW_ASSET.instagramV2,
      scheme: null,
    },
    {
      id: 'whatsapp',
      label: copy.channelWhatsapp,
      icon: SW_ASSET.whatsappV2,
      scheme: `whatsapp://send?text=${encodeURIComponent(
        buildReferralSharePayload(referralCode, language === 'ar' ? 'ar' : 'en').message,
      )}`,
    },
    {
      id: 'snapchat',
      label: copy.channelSnapchat,
      icon: SW_ASSET.snapchatV2,
      scheme: null,
    },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Image
          source={SW_ASSET.shareCardTexture}
          style={styles.cardTexture}
          contentFit="cover"
          transition={0}
        />
        <Text style={[styles.title, { zIndex: 1 }]}>{copy.shareCardSubtitle}</Text>

        <Pressable
          style={styles.linkRow}
          onPress={onCopyLink}
          accessibilityRole="button"
          accessibilityLabel={`${copy.shareCardSubtitle}: ${referralLink}`}
        >
          <Image
            source={SW_ASSET.linkV2}
            style={{ width: s(20), height: s(20) }}
            contentFit="contain"
            transition={0}
          />
          <Text style={styles.linkText} numberOfLines={1}>
            {compactLink(referralLink, 42)}
          </Text>
          <View style={styles.copyBtn}>
            <Image
              source={SW_ASSET.copyV2}
              style={{ width: s(20), height: s(20) }}
              contentFit="contain"
              transition={0}
            />
          </View>
        </Pressable>

        <View style={[styles.socials, { zIndex: 1 }]}>
          {channels.map((channel) => (
            <Pressable
              key={channel.id}
              style={styles.socialTile}
              onPress={() => void shareVia(channel.id, channel.scheme)}
              accessibilityRole="button"
              accessibilityLabel={channel.label}
            >
              <Image
                source={channel.icon}
                style={styles.socialIcon}
                contentFit="contain"
                transition={0}
              />
              <Text style={styles.socialLabel}>{channel.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>{copy.referralHintFull}</Text>
        <Image
          source={SW_ASSET.statusBullet}
          style={styles.bullet}
          contentFit="contain"
          transition={0}
        />
      </View>
    </View>
  );
});

export default ShareCard;
