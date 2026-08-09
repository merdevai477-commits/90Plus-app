/**
 * "شارك الان واربح" card — Figma node 163:154.
 *
 * Referral link + copy button, the four channel tiles, and the XP hint.
 * Channel handling follows the convention already used by reels/ReelItem:
 * try the app's own share URL, fall back to the OS share sheet, and only
 * record the share once it actually went out.
 */

import React, { memo, useCallback } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { buildReferralSharePayload } from '../../../constants/shareLinks';
import { useTranslation } from '../../../src/i18n';
import type { ShareChannel } from '../../../hooks/useShareWin';
import { logger } from '../../../utils/logger';
import { SW_ASSET } from '../assets';
import { compactLink } from '../data';
import { SW_GRADIENT, useShareWinStyles } from '../styles';
import GradientText from './GradientText';

interface ShareCardProps {
  referralCode: string;
  referralLink: string;
  onCopyLink: () => void;
  /** The channel's own app opened — record the share for that channel. */
  onShared: (channel: ShareChannel) => void;
  /** No channel intent available — hand off to the OS share sheet. */
  onFallbackShare: (channel: ShareChannel) => void;
}

const ShareCard = memo(function ShareCard({
  referralCode,
  referralLink,
  onCopyLink,
  onShared,
  onFallbackShare,
}: ShareCardProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s } = metrics;

  /**
   * Open a channel's native composer with the referral message. Anything that
   * isn't installed (or doesn't accept pre-filled text, like Instagram and
   * Snapchat) falls through to the OS share sheet.
   */
  const shareVia = useCallback(
    async (channel: ShareChannel, schemeUrl: string | null) => {
      if (schemeUrl) {
        try {
          if (await Linking.canOpenURL(schemeUrl)) {
            await Linking.openURL(schemeUrl);
            onShared(channel);
            return;
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
      icon: SW_ASSET.facebook,
      scheme: `fb://share?u=${encodeURIComponent(referralLink)}`,
    },
    {
      id: 'instagram',
      label: copy.channelInstagram,
      icon: SW_ASSET.instagram,
      // Instagram has no text-share intent — always the OS sheet.
      scheme: null,
    },
    {
      id: 'whatsapp',
      label: copy.channelWhatsapp,
      icon: SW_ASSET.whatsapp,
      scheme: `whatsapp://send?text=${encodeURIComponent(
        buildReferralSharePayload(referralCode, language === 'ar' ? 'ar' : 'en').message,
      )}`,
    },
    {
      id: 'snapchat',
      label: copy.channelSnapchat,
      icon: SW_ASSET.snapchat,
      // Snapchat's creative kit needs a native SDK — OS sheet instead.
      scheme: null,
    },
  ];

  return (
    <View style={[sw.card, sw.shareCard]}>
      <View style={sw.shareHeader}>
        <View style={sw.shareTitleRow}>
          <Text style={sw.cardTitle} accessibilityRole="header">
            {copy.shareCardTitle}
          </Text>
          <Image
            source={SW_ASSET.linkDiagonal}
            style={{ width: s(24), height: s(24) }}
            contentFit="contain"
            transition={0}
          />
        </View>
        <Text style={sw.cardSubtitle}>{copy.shareCardSubtitle}</Text>
      </View>

      <View style={sw.shareBody}>
        {/* Referral link + copy */}
        <Pressable
          style={sw.linkRow}
          onPress={onCopyLink}
          accessibilityRole="button"
          accessibilityLabel={`${copy.shareCardSubtitle}: ${referralLink}`}
        >
          <Text style={sw.linkText} numberOfLines={1}>
            {compactLink(referralLink)}
          </Text>
          <Image
            source={SW_ASSET.copy}
            style={{ width: s(24), height: s(24) }}
            contentFit="contain"
            transition={0}
          />
        </Pressable>

        {/* Channel tiles */}
        <View style={sw.socialsRow}>
          {channels.map((channel) => (
            <Pressable
              key={channel.id}
              style={sw.socialTile}
              onPress={() => void shareVia(channel.id, channel.scheme)}
              accessibilityRole="button"
              accessibilityLabel={channel.label}
            >
              <LinearGradient
                colors={SW_GRADIENT.tile}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <Image
                source={channel.icon}
                style={sw.socialIcon}
                contentFit="contain"
                transition={0}
              />
              <Text style={sw.socialLabel}>{channel.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* "كل صديق يسجل من رابطك يمنحك XP" */}
        <View style={sw.hintRow}>
          {/* Two runs, not nested Text — a masked gradient is a View and
              cannot live inside <Text>. They sit flush, as one sentence. */}
          <View style={sw.hintTextRun}>
            <Text style={sw.hintText} numberOfLines={1}>
              {copy.referralHintLead}
            </Text>
            <GradientText colors={SW_GRADIENT.purpleText} style={sw.hintText}>
              {copy.referralHintXp}
            </GradientText>
          </View>
          <Image
            source={SW_ASSET.gift}
            style={{ width: s(24), height: s(24) }}
            contentFit="contain"
            transition={0}
          />
        </View>
      </View>
    </View>
  );
});

export default ShareCard;
