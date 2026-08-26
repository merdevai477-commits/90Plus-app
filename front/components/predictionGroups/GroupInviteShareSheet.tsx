/**
 * Invitation share card — Figma 469:1650.
 */

import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { buildGroupJoinShareUrl } from '../../services/predictionGroups.service';
import { PG, usePGFonts } from './theme';

const ICON_COPY = require('../../assets/images/prediction-groups/icon-copy.svg');
const SOCIAL = [
  {
    id: 'facebook' as const,
    icon: require('../../assets/images/prediction-groups/social-facebook.svg'),
  },
  {
    id: 'instagram' as const,
    icon: require('../../assets/images/prediction-groups/social-instagram.svg'),
  },
  {
    id: 'whatsapp' as const,
    icon: require('../../assets/images/prediction-groups/social-whatsapp.svg'),
  },
  {
    id: 'snapchat' as const,
    icon: require('../../assets/images/prediction-groups/social-snapchat.svg'),
  },
];

function formatInviteCodeDisplay(code: string): string {
  const cleaned = code.replace(/\s+/g, '');
  return cleaned.split('').join(' ');
}

export function GroupInviteShareSheet({
  visible,
  groupName,
  inviteCode,
  onClose,
}: {
  visible: boolean;
  groupName: string;
  inviteCode: string;
  onClose: () => void;
  onInviteUsers?: () => void;
}) {
  const { bold, medium } = usePGFonts();
  const { t, isRTL, direction } = useTranslation();
  const inv = t.predictionGroups.inviteSheet;
  const common = t.predictionGroups.common;
  const hdr = t.predictionGroups.header;
  const toast = useToast();
  const url = buildGroupJoinShareUrl(inviteCode);
  const message = hdr.shareMessage.replace('{name}', groupName).replace('{url}', url);
  const displayCode = useMemo(() => formatInviteCodeDisplay(inviteCode), [inviteCode]);
  const row: { flexDirection: 'row' | 'row-reverse' } = {
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  const copyCode = useCallback(async () => {
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess(common.copiedTitle, common.copiedInvite);
  }, [common.copiedInvite, common.copiedTitle, inviteCode, toast]);

  const copyLink = useCallback(async () => {
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess(common.copiedTitle, common.copiedLink);
  }, [common.copiedLink, common.copiedTitle, toast, url]);

  const shareTo = useCallback(
    async (app: (typeof SOCIAL)[number]['id']) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        if (app === 'whatsapp') {
          await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
          return;
        }
        if (app === 'facebook') {
          const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
          if (await Linking.canOpenURL(fb)) {
            await Linking.openURL(fb);
            return;
          }
        }
        await Share.share(Platform.OS === 'ios' ? { url, message } : { message });
      } catch {
        await Share.share({ message });
      }
    },
    [message, url],
  );

  const labels: Record<(typeof SOCIAL)[number]['id'], string> = {
    facebook: inv.facebook,
    instagram: inv.instagram,
    whatsapp: inv.whatsapp,
    snapchat: inv.snapchat,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#0C051A', '#07040D']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.card}
          >
            <View style={styles.section}>
              <Text style={[styles.heading, { fontFamily: bold, writingDirection: direction }]}>
                {inv.codeTitle}
              </Text>
              <LinearGradient
                colors={['#0C051A', '#07040D']}
                style={styles.codeBox}
              >
                <Text style={[styles.code, { fontFamily: bold }]}>{displayCode}</Text>
              </LinearGradient>
              <Pressable onPress={() => void copyCode()} style={[styles.copyBtn, row]}>
                <Text style={[styles.copyTxt, { fontFamily: medium, writingDirection: direction }]}>
                  {common.copyCodeBtn}
                </Text>
                <Image source={ICON_COPY} style={styles.copyIcon} contentFit="contain" transition={0} />
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={[styles.heading, { fontFamily: bold, writingDirection: direction }]}>
                {inv.orShareLink}
              </Text>
              <Pressable onPress={() => void copyLink()} style={[styles.linkBox, row]}>
                <Text
                  style={[
                    styles.linkTxt,
                    {
                      fontFamily: medium,
                      textAlign: isRTL ? 'right' : 'left',
                      writingDirection: direction,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {url}
                </Text>
                <Image source={ICON_COPY} style={styles.copyIcon} contentFit="contain" transition={0} />
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={[styles.heading, { fontFamily: bold, writingDirection: direction }]}>
                {inv.shareVia}
              </Text>
              <View style={styles.socialRow}>
                {SOCIAL.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => void shareTo(s.id)}
                    style={styles.social}
                    accessibilityRole="button"
                    accessibilityLabel={labels[s.id]}
                  >
                    <Image source={s.icon} style={styles.socialIcon} contentFit="contain" transition={0} />
                    <Text style={[styles.socialLabel, { fontFamily: bold }]}>{labels[s.id]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.later} hitSlop={10}>
              <Text style={[styles.laterTxt, { fontFamily: bold, writingDirection: direction }]}>
                {common.later}
              </Text>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cardWrap: {
    borderRadius: 32,
    shadowColor: 'rgba(90,18,158,0.36)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 16,
  },
  card: {
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,10,144,0.62)',
    paddingHorizontal: 40,
    paddingVertical: 40,
    gap: 36,
    overflow: 'hidden',
    alignItems: 'center',
  },
  section: { width: '100%', gap: 12, alignItems: 'center' },
  heading: {
    color: '#E2E2E2',
    fontSize: 19,
    textAlign: 'center',
  },
  codeBox: {
    width: '100%',
    height: 77,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95,
  },
  code: {
    color: '#9338EA',
    fontSize: 32,
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.27)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  copyBtn: {
    width: '100%',
    height: 57,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
    backgroundColor: 'rgba(12,5,26,0.8)',
  },
  copyTxt: { color: '#E2E2E2', fontSize: 18 },
  copyIcon: { width: 24, height: 24 },
  linkBox: {
    width: '100%',
    height: 58,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
    backgroundColor: 'rgba(12,5,26,0.8)',
  },
  linkTxt: { flex: 1, color: '#E2E2E2', fontSize: 14 },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: 90,
    gap: 9,
  },
  social: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(12,5,26,0.9)',
    paddingVertical: 10,
  },
  socialIcon: { width: 38, height: 38 },
  socialLabel: { color: '#D2D2D2', fontSize: 12, textAlign: 'center' },
  later: { alignItems: 'center', paddingTop: 4 },
  laterTxt: {
    color: PG.primary,
    fontSize: 21,
    textDecorationLine: 'underline',
  },
});
