/**
 * GroupScreenHeader — centered avatar, name, invite row.
 */

import * as Haptics from 'expo-haptics';
import {
  Calendar,
  Crown,
  Lock,
  LogOut,
  Settings,
  Users,
} from 'lucide-react-native';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { FeatureInfoModal } from '../common/FeatureInfoModal';
import { useTranslation } from '../../src/i18n';
import { GroupAvatar } from './GroupAvatar';
import { GroupConfirmDialog } from './GroupConfirmDialog';
import { GroupEditSheet } from './GroupEditSheet';
import { GroupInviteSheet } from './GroupInviteSheet';
import { LiquidGlassInviteCard } from './LiquidGlassInviteCard';
import { buildGroupJoinShareUrl } from '../../services/predictionGroups.service';
import { PG, usePGFonts } from './theme';

export type GroupHeaderInfo = {
  id: string;
  name: string;
  code: string;
  membersCount: number;
  createdAt: string;
  tagline: string;
  isPrivate: boolean;
  avatarUrl?: string | null;
};

export type GroupScreenHeaderHandle = {
  openInfo: () => void;
  share: () => void;
  shareMessage: string;
};

export const GroupScreenHeader = forwardRef<
  GroupScreenHeaderHandle,
  {
    group: GroupHeaderInfo;
    isRTL: boolean;
    isAdmin?: boolean;
    showProfile?: boolean;
    memberUserIds?: string[];
    onSaveGroup?: (name?: string, avatarUrl?: string | null) => Promise<unknown>;
    onInviteUser?: (userId: string) => Promise<void>;
    onLeaveGroup?: () => Promise<unknown>;
    onDeleteGroup?: () => Promise<unknown>;
  }
>(function GroupScreenHeader(
  {
    group,
    isRTL,
    showProfile = true,
    isAdmin = false,
    memberUserIds = [],
    onSaveGroup,
    onInviteUser,
    onLeaveGroup,
    onDeleteGroup,
  },
  ref,
) {
  const { medium, extra } = usePGFonts();
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState(group.name);
  const [groupImage, setGroupImage] = useState<string | null>(group.avatarUrl ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const shareMessage = `انضم لمجموعة "${groupName}" على 90Plus!\n${buildGroupJoinShareUrl(group.code)}`;

  useEffect(() => {
    setGroupName(group.name);
    setGroupImage(group.avatarUrl ?? null);
  }, [group.name, group.avatarUrl]);

  const openEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditOpen(true);
  }, []);

  const handleSave = useCallback(
    async (name: string, imageUri: string | null) => {
      setGroupName(name);
      setGroupImage(imageUri);
      if (onSaveGroup) {
        await onSaveGroup(name, imageUri);
      }
    },
    [onSaveGroup],
  );

  const handleQuickLeave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLeaveConfirmOpen(true);
  }, []);

  const runQuickLeave = useCallback(async () => {
    setLeaveBusy(true);
    try {
      await onLeaveGroup?.();
      setLeaveConfirmOpen(false);
    } finally {
      setLeaveBusy(false);
    }
  }, [onLeaveGroup]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({ message: shareMessage });
    } catch {
      /* user dismissed */
    }
  }, [shareMessage]);

  const openInfo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInfoOpen(true);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openInfo,
      share: handleShare,
      shareMessage,
    }),
    [openInfo, handleShare, shareMessage],
  );

  return (
    <>
      {showProfile ? (
        <View style={styles.wrap}>
          <View style={styles.identity}>
            <GroupAvatar imageUri={groupImage} size={80} />
            <View style={[styles.nameRow, row]}>
              <Text style={[styles.groupName, { fontFamily: extra }]} numberOfLines={1}>
                {groupName}
              </Text>
              {isAdmin ? (
                <Pressable
                  onPress={openEdit}
                  hitSlop={8}
                  style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="إعدادات المجموعة"
                >
                  <Settings size={14} color={PG.primaryLight} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleQuickLeave}
                  hitSlop={8}
                  style={({ pressed }) => [styles.leaveChip, row, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="خروج من المجموعة"
                >
                  <LogOut size={11} color={PG.textMuted} />
                  <Text style={[styles.leaveChipTxt, { fontFamily: medium }]}>خروج</Text>
                </Pressable>
              )}
            </View>
            <View style={[styles.privacyRow, row]}>
              <Text style={[styles.privacyText, { fontFamily: medium }]}>{group.tagline}</Text>
              {group.isPrivate && <Lock size={12} color={PG.textMuted} />}
            </View>
          </View>

          <View style={[styles.metaRow, row]}>
            <View style={[styles.metaItem, row]}>
              <Users size={14} color={PG.textMuted} />
              <Text style={[styles.metaText, { fontFamily: medium }]}>
                {group.membersCount} عضو
              </Text>
            </View>
            <View style={[styles.metaItem, row]}>
              <Calendar size={14} color={PG.textMuted} />
              <Text style={[styles.metaText, { fontFamily: medium }]}>{group.createdAt}</Text>
            </View>
          </View>

          <LiquidGlassInviteCard
            code={group.code}
            isRTL={isRTL}
            onInvite={() => setInviteOpen(true)}
          />
        </View>
      ) : null}

      <GroupEditSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        groupId={group.id}
        groupName={groupName}
        groupImage={groupImage}
        onSave={handleSave}
        onLeaveGroup={onLeaveGroup}
        onDeleteGroup={isAdmin ? onDeleteGroup : undefined}
        isRTL={isRTL}
        isAdmin={isAdmin}
      />

      <GroupInviteSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupName={groupName}
        inviteCode={group.code}
        isRTL={isRTL}
        excludeUserIds={memberUserIds}
        onInviteUser={onInviteUser}
      />

      <FeatureInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        icon={<Crown size={30} color="#d8b4fe" />}
        title={t.predictionGroupsInfo.title}
        bullets={[
          t.predictionGroupsInfo.rule1,
          t.predictionGroupsInfo.rule2,
          t.predictionGroupsInfo.rule3,
        ]}
        hype={t.predictionGroupsInfo.hype}
        gotItLabel={t.predictionGroupsInfo.gotIt}
      />

      <GroupConfirmDialog
        visible={leaveConfirmOpen}
        title="الخروج من المجموعة؟"
        message="لن تظهر في ترتيب المجموعة بعد الخروج."
        confirmLabel="خروج"
        destructive
        loading={leaveBusy}
        isRTL={isRTL}
        onConfirm={() => void runQuickLeave()}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
    marginBottom: 8,
  },
  identity: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  nameRow: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  groupName: {
    fontSize: 22,
    lineHeight: 30,
    color: PG.text,
    maxWidth: 220,
    textAlign: 'center',
    includeFontPadding: false,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  leaveChip: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  leaveChipTxt: {
    fontSize: 11,
    lineHeight: 15,
    color: PG.textMuted,
    includeFontPadding: false,
  },
  privacyRow: {
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 17,
    color: PG.textMuted,
    includeFontPadding: false,
  },
  metaRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
  },
  metaItem: {
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 17,
    color: PG.textMuted,
    includeFontPadding: false,
  },
});
