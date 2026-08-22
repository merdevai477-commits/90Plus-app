/**
 * Group hero card — name, photo, stats, invite code.
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Copy, LogOut, Settings, Users } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { GroupAvatar } from './GroupAvatar';
import { PG, PG_RADII, usePGFonts } from './theme';

export function PredictionsCupHero({
  isRTL,
  name,
  avatarUrl,
  membersCount,
  matchesCount,
  inviteCode,
  isOwner,
  onInvite,
  onSettings,
  onLeave,
}: {
  isRTL: boolean;
  name: string;
  avatarUrl?: string | null;
  membersCount: number;
  matchesCount: number;
  inviteCode: string;
  isOwner?: boolean;
  onInvite: () => void;
  onSettings?: () => void;
  onLeave?: () => void;
}) {
  const { medium, extra } = usePGFonts();
  const { t } = useTranslation();
  const cup = t.predictionGroups.cup;
  const common = t.predictionGroups.common;
  const toast = useToast();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  const copy = useCallback(async () => {
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess(common.copiedTitle, common.copiedInvite);
  }, [common.copiedInvite, common.copiedTitle, inviteCode, toast]);

  return (
    <LinearGradient
      colors={['#1A0B2E', '#0B0414', PG.card]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={[styles.top, row]}>
        <View style={[styles.copy, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.title, { fontFamily: extra, textAlign: align }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.sub, { fontFamily: medium, textAlign: align }]}>{cup.subtitle}</Text>
          <View style={[styles.stats, row]}>
            <View style={[styles.stat, row]}>
              <Users size={14} color={PG.primaryLight} />
              <Text style={[styles.statTxt, { fontFamily: medium }]}>
                {common.members.replace('{count}', String(membersCount))}
              </Text>
            </View>
            <View style={[styles.stat, row]}>
              <Calendar size={14} color={PG.primaryLight} />
              <Text style={[styles.statTxt, { fontFamily: medium }]}>
                {cup.dailyMatches.replace('{count}', String(matchesCount))}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              void copy();
              onInvite();
            }}
            style={[styles.codeBox, row]}
          >
            <Text style={[styles.code, { fontFamily: extra }]}>{inviteCode}</Text>
            <Copy size={14} color={PG.primaryLight} />
          </Pressable>
        </View>
        <GroupAvatar imageUri={avatarUrl ?? null} size={88} />
      </View>
      <View style={[styles.actions, row]}>
        {isOwner && onSettings ? (
          <Pressable onPress={onSettings} style={styles.iconBtn} accessibilityLabel={common.settings}>
            <Settings size={16} color={PG.primaryLight} />
          </Pressable>
        ) : null}
        {onLeave ? (
          <Pressable onPress={onLeave} style={styles.iconBtn} accessibilityLabel={common.leaveGroup}>
            <LogOut size={16} color={PG.primaryLight} />
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.border,
    padding: 16,
    overflow: 'hidden',
  },
  top: { alignItems: 'center', gap: 10 },
  copy: { flex: 1, gap: 6 },
  title: { color: PG.text, fontSize: 22 },
  sub: { color: PG.textSecondary, fontSize: 13 },
  stats: { gap: 12, marginTop: 4, flexWrap: 'wrap' },
  stat: { alignItems: 'center', gap: 6 },
  statTxt: { color: PG.textSecondary, fontSize: 12 },
  codeBox: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PG.borderBright,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  code: { color: PG.primaryLight, fontSize: 13, letterSpacing: 0.6 },
  actions: { justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.16)',
  },
});
