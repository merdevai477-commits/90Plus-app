/**
 * Invitation share card — matches the invite-code mockup:
 * code, copy, link, social apps, 90Plus footer, Later.
 */

import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Copy } from 'lucide-react-native';
import React, { useCallback } from 'react';
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

import { SW_ASSET } from '../ShareWin/assets';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { buildGroupJoinShareUrl } from '../../services/predictionGroups.service';
import { PG, PG_GLOW_PURPLE, usePGFonts } from './theme';

const SOCIAL = [
  { id: 'facebook' as const, icon: SW_ASSET.facebook },
  { id: 'instagram' as const, icon: SW_ASSET.instagram },
  { id: 'whatsapp' as const, icon: SW_ASSET.whatsapp },
  { id: 'snapchat' as const, icon: SW_ASSET.snapchat },
];

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
  const { extra, medium } = usePGFonts();
  const { t, isRTL } = useTranslation();
  const inv = t.predictionGroups.inviteSheet;
  const common = t.predictionGroups.common;
  const hdr = t.predictionGroups.header;
  const toast = useToast();
  const url = buildGroupJoinShareUrl(inviteCode);
  const message = hdr.shareMessage.replace('{name}', groupName).replace('{url}', url);
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
            colors={['#1A0B2E', '#0B0414', '#050208']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.card}
          >
            <Text style={[styles.heading, { fontFamily: extra }]}>{inv.codeTitle}</Text>

            <View style={styles.codeBox}>
              <Text style={[styles.code, { fontFamily: extra }]}>{inviteCode}</Text>
            </View>

            <Pressable onPress={() => void copyCode()} style={[styles.copyBtn, row]}>
              <Copy size={16} color={PG.primaryLight} />
              <Text style={[styles.copyTxt, { fontFamily: medium }]}>{common.copyCodeBtn}</Text>
            </Pressable>

            <Text style={[styles.heading, { fontFamily: extra, marginTop: 6 }]}>{inv.orShareLink}</Text>
            <Pressable onPress={() => void copyLink()} style={[styles.linkBox, row]}>
              <Text
                style={[styles.linkTxt, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}
                numberOfLines={1}
              >
                {url}
              </Text>
              <Copy size={16} color={PG.primaryLight} />
            </Pressable>

            <Text style={[styles.heading, { fontFamily: extra, marginTop: 6 }]}>{inv.shareVia}</Text>
            <View style={styles.socialRow}>
              {SOCIAL.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => void shareTo(s.id)}
                  style={styles.social}
                  accessibilityRole="button"
                  accessibilityLabel={labels[s.id]}
                >
                  <View style={styles.socialIconWrap}>
                    <Image source={s.icon} style={styles.socialIcon} contentFit="contain" />
                  </View>
                  <Text style={[styles.socialLabel, { fontFamily: medium }]}>{labels[s.id]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.brand, { fontFamily: medium }]}>{inv.fromBrand}</Text>

            <Pressable onPress={onClose} style={styles.later} hitSlop={10}>
              <Text style={[styles.laterTxt, { fontFamily: extra }]}>{common.later}</Text>
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
    paddingHorizontal: 22,
  },
  cardWrap: {
    borderRadius: 28,
    ...PG_GLOW_PURPLE,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: PG.borderBright,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 12,
    overflow: 'hidden',
  },
  heading: {
    color: PG.text,
    fontSize: 17,
    textAlign: 'center',
  },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PG.borderBright,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(12, 4, 28, 0.92)',
  },
  code: {
    color: PG.primaryLight,
    fontSize: 26,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  copyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PG.borderBright,
    backgroundColor: 'transparent',
  },
  copyTxt: { color: PG.text, fontSize: 15 },
  linkBox: {
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PG.borderBright,
    backgroundColor: 'rgba(12, 4, 28, 0.92)',
  },
  linkTxt: { flex: 1, color: PG.text, fontSize: 12 },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  social: { flex: 1, alignItems: 'center', gap: 8 },
  socialIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PG.borderBright,
    backgroundColor: 'rgba(12, 4, 28, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: { width: 32, height: 32 },
  socialLabel: { color: PG.text, fontSize: 11, textAlign: 'center' },
  brand: {
    color: PG.primaryLight,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  later: { alignItems: 'center', paddingTop: 2 },
  laterTxt: {
    color: PG.primary,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

