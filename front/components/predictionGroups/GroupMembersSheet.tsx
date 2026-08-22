/**
 * Bottom sheet — full group leaderboard (opened from "عرض الكل").
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React, { useCallback } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import type { GroupMember } from './data';
import { HomeLeaderboardRow } from './HomeLeaderboardRow';
import { PurpleTrophyIcon } from './PurpleTrophyIcon';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

const SheetGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const SHEET_GLASS_PROPS = isLiquidGlassSupported
  ? { effect: 'regular' as const, tintColor: 'rgba(15,5,25,0.99)' }
  : { intensity: Platform.OS === 'android' ? 40 : 30, tint: 'dark' as const };

export interface GroupMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  isRTL?: boolean;
  members: GroupMember[];
  isOwner?: boolean;
  onKickMember?: (userId: string) => Promise<void>;
}

export function GroupMembersSheet({
  visible,
  onClose,
  isRTL = false,
  members,
  isOwner,
  onKickMember,
}: GroupMembersSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { medium, extra } = usePGFonts();
  const { t } = useTranslation();
  const lb = t.predictionGroups.leaderboard;
  const ms = t.predictionGroups.membersSheet;
  const common = t.predictionGroups.common;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const textAlign = isRTL ? 'right' : 'left';

  const confirmKick = useCallback(
    (member: GroupMember) => {
      if (!member.userId || !onKickMember || member.isMe) return;
      Alert.alert(ms.kickTitle, ms.kickMessage.replace('{name}', member.name), [
        { text: common.cancel, style: 'cancel' },
        {
          text: ms.kickConfirm,
          style: 'destructive',
          onPress: () => {
            void onKickMember(member.userId!).then(() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            });
          },
        },
      ]);
    },
    [common.cancel, ms.kickConfirm, ms.kickMessage, ms.kickTitle, onKickMember],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <SheetBlurBackdrop onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <SheetGlass {...SHEET_GLASS_PROPS} style={styles.sheetGlass}>
            <LinearGradient
              colors={['rgba(124,58,237,0.14)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            <View style={styles.handle} />

            <View style={[styles.header, row]}>
              <View style={[styles.titleRow, row]}>
                <PurpleTrophyIcon size={34} />
                <Text style={[styles.title, { fontFamily: extra, textAlign }]}>{lb.title}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                <X size={20} color={PG.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.sub, { fontFamily: medium, textAlign }]}>
              {lb.memberCount.replace('{count}', String(members.length))}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              bounces={false}
            >
              {members.map((member) => (
                <HomeLeaderboardRow
                  key={member.userId ?? member.name}
                  member={member}
                  isRTL={isRTL}
                  onPress={
                    member.username
                      ? () => {
                          onClose();
                          router.push(`/user/${member.username}` as never);
                        }
                      : undefined
                  }
                  onLongPress={
                    isOwner && member.userId && !member.isMe
                      ? () => confirmKick(member)
                      : undefined
                  }
                />
              ))}
            </ScrollView>
          </SheetGlass>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  sheetGlass: {
    borderRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.heroGlassBorder,
    overflow: 'hidden',
    paddingHorizontal: PG_SPACING.lg,
    paddingTop: PG_SPACING.sm,
    paddingBottom: PG_SPACING.md,
    maxHeight: '82%',
    backgroundColor: PG.card,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PG.border,
    marginBottom: PG_SPACING.md,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: { color: PG.text, fontSize: PG_TYPE.title },
  sub: {
    color: PG.textMuted,
    fontSize: PG_TYPE.caption,
    marginBottom: PG_SPACING.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.glassStrong,
  },
  list: {
    gap: 2,
    paddingBottom: PG_SPACING.sm,
  },
});
