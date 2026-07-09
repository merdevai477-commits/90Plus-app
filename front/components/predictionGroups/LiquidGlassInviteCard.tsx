/**
 * Invite row — glass code pill + copy & invite icons beside it (reference layout).
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, Plus, User } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { PG, usePGFonts } from './theme';

const PILL_RADIUS = 24;
const ROW_HEIGHT = 52;
const ICON_HIT = 44;

export function LiquidGlassInviteCard({
  code,
  isRTL,
  onInvite,
}: {
  code: string;
  isRTL: boolean;
  onInvite: () => void;
}) {
  const { medium, extra } = usePGFonts();
  const { t } = useTranslation();
  const common = t.predictionGroups.common;
  const toast = useToast();
  const textAlign = isRTL ? ('right' as const) : ('left' as const);

  const copyCode = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess(common.copiedTitle, common.copiedInvite);
  }, [code, common.copiedInvite, common.copiedTitle, toast]);

  const openInvite = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onInvite();
  }, [onInvite]);

  return (
    <View style={styles.row}>
      <LiquidGlassSurface borderRadius={PILL_RADIUS} style={styles.codeIsland}>
        <View style={styles.codeInner}>
          <Text
            style={[styles.label, { fontFamily: medium, textAlign }]}
            allowFontScaling={false}
          >
            {common.inviteCode}
          </Text>
          <Text
            style={[styles.code, { fontFamily: extra, textAlign }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
          >
            {code}
          </Text>
        </View>
      </LiquidGlassSurface>

      <View style={styles.iconActions}>
        <Pressable
          onPress={copyCode}
          hitSlop={6}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
          accessibilityRole="button"
          accessibilityLabel={common.copyCodeBtn}
        >
          <Copy size={22} color={PG.primaryLight} strokeWidth={2} />
        </Pressable>

        <Pressable
          onPress={openInvite}
          hitSlop={6}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
          accessibilityRole="button"
          accessibilityLabel={common.inviteMember}
        >
          <View style={styles.inviteIcon}>
            <User size={22} color={PG.primaryLight} strokeWidth={2} />
            <View style={styles.plusBadge}>
              <Plus size={10} color="#fff" strokeWidth={3} />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    gap: 10,
  },
  codeIsland: {
    flex: 1,
    minHeight: ROW_HEIGHT,
    height: ROW_HEIGHT,
    minWidth: 0,
  },
  codeInner: {
    flex: 1,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    color: PG.textMuted,
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  code: {
    fontSize: 15,
    lineHeight: 20,
    color: PG.text,
    letterSpacing: 1.1,
    includeFontPadding: false,
  },
  iconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  iconBtn: {
    width: ICON_HIT,
    height: ICON_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    opacity: 0.75,
  },
  inviteIcon: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -3,
    right: -7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PG.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PG.bg,
  },
});
