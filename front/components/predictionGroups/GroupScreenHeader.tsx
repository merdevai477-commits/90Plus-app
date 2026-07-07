/**
 * Header — centered avatar, name below, invite row. Fixed top bar is separate
 * (`GroupFixedTopBar` in prediction-groups).
 */

import * as Haptics from 'expo-haptics';
import {
  Calendar,
  Crown,
  Lock,
  Pencil,
  Users,
} from 'lucide-react-native';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { FeatureInfoModal } from '../common/FeatureInfoModal';
import { useTranslation } from '../../src/i18n';
import { GroupAvatar } from './GroupAvatar';
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
    onSaveGroup?: (name?: string, avatarUrl?: string | null) => Promise<unknown>;
    onInviteUser?: (userId: string) => Promise<void>;
  }
>(function GroupScreenHeader(
  { group, isRTL, showProfile = true, isAdmin = false, onSaveGroup, onInviteUser },
  ref,
) {
  const { medium, extra } = usePGFonts();
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState(group.name);
  const [groupImage, setGroupImage] = useState<string | null>(group.avatarUrl ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
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
                  accessibilityLabel="تعديل المجموعة"
                >
                  <Pencil size={14} color={PG.primaryLight} />
                </Pressable>
              ) : null}
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
        groupName={groupName}
        groupImage={groupImage}
        onSave={handleSave}
        isRTL={isRTL}
        isAdmin={isAdmin}
      />

      <GroupInviteSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupName={groupName}
        inviteCode={group.code}
        isRTL={isRTL}
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
    color: PG.text,
    maxWidth: 260,
    textAlign: 'center',
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
  privacyRow: {
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    fontSize: 12,
    color: PG.textMuted,
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
    color: PG.textMuted,
  },
});
