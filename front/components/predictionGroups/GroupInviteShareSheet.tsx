/**
 * Invitation share card — Figma 469:1650.
 * Handles long invite codes (e.g. 90PLUS…) without overflow.
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
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import GradientText from '../ShareWin/components/GradientText';
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
] as const;

const CODE_GRADIENT = ['#9338EA', '#3A0C66'] as const;
const BOX_GRADIENT = ['#0C051A', '#07040D'] as const;

/** Visual spacing for the code chip — never breaks layout on long codes. */
function formatInviteCodeDisplay(raw: string): string {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return '';

  // Short codes (Figma mock): letter-spaced "7 C X 3 K 2 L"
  if (cleaned.length <= 8) {
    return cleaned.split('').join(' ');
  }

  // 90PLUS… codes: keep brand prefix, chunk the rest
  if (cleaned.startsWith('90PLUS') && cleaned.length > 6) {
    const rest = cleaned.slice(6);
    const chunks: string[] = [];
    for (let i = 0; i < rest.length; i += 4) {
      chunks.push(rest.slice(i, i + 4));
    }
    return ['90PLUS', ...chunks].join(' ');
  }

  // Generic long: groups of 4
  const chunks: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    chunks.push(cleaned.slice(i, i + 4));
  }
  return chunks.join(' ');
}

function codeFontSize(charCount: number): number {
  if (charCount <= 7) return 39;
  if (charCount <= 10) return 28;
  if (charCount <= 14) return 22;
  return 18;
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
  const { bold, medium, regular } = usePGFonts();
  const { t, isRTL, direction } = useTranslation();
  const { height: windowH } = useWindowDimensions();
  const inv = t.predictionGroups.inviteSheet;
  const common = t.predictionGroups.common;
  const hdr = t.predictionGroups.header;
  const toast = useToast();

  const cleanedCode = useMemo(
    () => inviteCode.replace(/\s+/g, '').toUpperCase(),
    [inviteCode],
  );
  const displayCode = useMemo(
    () => formatInviteCodeDisplay(cleanedCode),
    [cleanedCode],
  );
  const codeSize = codeFontSize(cleanedCode.length);
  const url = buildGroupJoinShareUrl(cleanedCode || inviteCode);
  const message = hdr.shareMessage
    .replace('{name}', groupName)
    .replace('{url}', url);

  const row: { flexDirection: 'row' | 'row-reverse' } = {
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  const copyCode = useCallback(async () => {
    await Clipboard.setStringAsync(cleanedCode || inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess(common.copiedTitle, common.copiedInvite);
  }, [cleanedCode, common.copiedInvite, common.copiedTitle, inviteCode, toast]);

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

  const maxCardH = Math.min(585, windowH * 0.88);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.cardWrap, { maxHeight: maxCardH }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={BOX_GRADIENT}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.card}
          >
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollInner}
            >
              {/* Invite code */}
              <View style={styles.section}>
                <Text
                  style={[styles.heading, { fontFamily: bold, writingDirection: direction }]}
                >
                  {inv.codeTitle ?? common.inviteCode}
                </Text>

                <View style={styles.codeBox}>
                  <LinearGradient
                    colors={BOX_GRADIENT}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.codeInsetGlow} pointerEvents="none" />
                  <GradientText
                    colors={CODE_GRADIENT}
                    style={[
                      styles.code,
                      {
                        fontFamily: bold,
                        fontSize: codeSize,
                        lineHeight: codeSize + 6,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {displayCode}
                  </GradientText>
                </View>

                <Pressable
                  onPress={() => void copyCode()}
                  style={[styles.copyBtn, row]}
                  accessibilityRole="button"
                  accessibilityLabel={common.copyCodeBtn}
                >
                  <LinearGradient
                    colors={BOX_GRADIENT}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text
                    style={[
                      styles.copyTxt,
                      { fontFamily: medium, writingDirection: direction },
                    ]}
                  >
                    {common.copyCodeBtn}
                  </Text>
                  <Image
                    source={ICON_COPY}
                    style={styles.copyIcon}
                    contentFit="contain"
                    transition={0}
                  />
                </Pressable>
              </View>

              {/* Link + social */}
              <View style={styles.block}>
                <View style={styles.section}>
                  <Text
                    style={[styles.heading, { fontFamily: bold, writingDirection: direction }]}
                  >
                    {inv.orShareLink}
                  </Text>
                  <Pressable
                    onPress={() => void copyLink()}
                    style={[styles.linkBox, row]}
                    accessibilityRole="button"
                    accessibilityLabel={common.copiedLink}
                  >
                    <LinearGradient
                      colors={BOX_GRADIENT}
                      start={{ x: 0.5, y: 1 }}
                      end={{ x: 0.5, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text
                      style={[
                        styles.linkTxt,
                        {
                          fontFamily: regular ?? medium,
                          textAlign: isRTL ? 'right' : 'left',
                          writingDirection: 'ltr',
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {url}
                    </Text>
                    <Image
                      source={ICON_COPY}
                      style={styles.copyIcon}
                      contentFit="contain"
                      transition={0}
                    />
                  </Pressable>
                </View>

                <View style={styles.section}>
                  <Text
                    style={[styles.heading, { fontFamily: bold, writingDirection: direction }]}
                  >
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
                        <LinearGradient
                          colors={BOX_GRADIENT}
                          start={{ x: 0.5, y: 1 }}
                          end={{ x: 0.5, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <Image
                          source={s.icon}
                          style={styles.socialIcon}
                          contentFit="contain"
                          transition={0}
                        />
                        <Text
                          style={[styles.socialLabel, { fontFamily: bold }]}
                          numberOfLines={1}
                        >
                          {labels[s.id]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Pressable onPress={onClose} style={styles.later} hitSlop={12}>
                <Text
                  style={[styles.laterTxt, { fontFamily: bold, writingDirection: direction }]}
                >
                  {common.later}
                </Text>
              </Pressable>
            </ScrollView>
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
    overflow: 'hidden',
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
    overflow: 'hidden',
  },
  scrollInner: {
    paddingHorizontal: 40,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 36,
  },
  section: {
    width: '100%',
    maxWidth: 335,
    gap: 12,
    alignItems: 'center',
  },
  block: {
    width: '100%',
    maxWidth: 335,
    gap: 18,
  },
  heading: {
    color: '#E2E2E2',
    fontSize: 19,
    textAlign: 'center',
  },
  codeBox: {
    width: '100%',
    minHeight: 77,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    opacity: 0.95,
  },
  codeInsetGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    // RN can't do inset box-shadow; slight overlay approximates Figma glow.
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(168,85,247,0.18)',
  },
  code: {
    color: '#9338EA',
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.27)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
    paddingHorizontal: 4,
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
    overflow: 'hidden',
    opacity: 0.95,
  },
  copyTxt: { color: '#E2E2E2', fontSize: 18 },
  copyIcon: { width: 24, height: 24 },
  linkBox: {
    width: '100%',
    height: 58,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
    overflow: 'hidden',
    opacity: 0.95,
  },
  linkTxt: {
    flex: 1,
    minWidth: 0,
    color: '#E2E2E2',
    fontSize: 15,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: 90,
    gap: 9,
  },
  social: {
    flex: 1,
    maxWidth: 75,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  socialIcon: { width: 38, height: 38 },
  socialLabel: {
    color: '#D2D2D2',
    fontSize: 11,
    textAlign: 'center',
  },
  later: { alignItems: 'center', paddingTop: 4 },
  laterTxt: {
    color: PG.primary,
    fontSize: 21,
    textDecorationLine: 'underline',
  },
});
