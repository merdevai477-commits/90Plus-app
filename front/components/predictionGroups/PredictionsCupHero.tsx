/**
 * Group hero card — Figma 477:2766 cup banner.
 */

import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut, Settings } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { PG, usePGFonts } from './theme';

const CUP_TROPHY = require('../../assets/images/prediction-groups/cup-trophy-frame.png');
const ICON_COPY = require('../../assets/images/prediction-groups/icon-copy.svg');
const ICON_USERS = require('../../assets/images/prediction-groups/icon-users-sm.svg');
const ICON_SCHEDULE = require('../../assets/images/prediction-groups/icon-schedule.svg');

export function PredictionsCupHero({
  isRTL,
  name: _name,
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
  const { medium, bold } = usePGFonts();
  const { t, direction } = useTranslation();
  const cup = t.predictionGroups.cup;
  const common = t.predictionGroups.common;
  const toast = useToast();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? ('right' as const) : ('left' as const);

  const copy = useCallback(async () => {
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.showSuccess(common.copiedTitle, common.copiedInvite);
  }, [common.copiedInvite, common.copiedTitle, inviteCode, toast]);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(35,9,59,0.94)', 'rgba(0,0,0,0.94)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, row]}>
        <View style={[styles.copy, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text
            style={[styles.title, { fontFamily: bold, textAlign: align, writingDirection: direction }]}
            numberOfLines={2}
          >
            {cup.title}
          </Text>
          <Text
            style={[styles.sub, { fontFamily: medium, textAlign: align, writingDirection: direction }]}
          >
            {cup.subtitle}
          </Text>
          <View style={[styles.stats, row]}>
            <View style={[styles.stat, row]}>
              <Text style={[styles.statTxt, { fontFamily: medium }]}>
                {common.members.replace('{count}', String(membersCount))}
              </Text>
              <Image source={ICON_USERS} style={styles.metaIcon} contentFit="contain" transition={0} />
            </View>
            <View style={[styles.stat, row]}>
              <Text style={[styles.statTxt, { fontFamily: medium }]}>
                {cup.dailyMatches.replace('{count}', String(matchesCount))}
              </Text>
              <Image
                source={ICON_SCHEDULE}
                style={styles.metaIcon}
                contentFit="contain"
                transition={0}
              />
            </View>
          </View>
          <Pressable
            onPress={() => {
              void copy();
              onInvite();
            }}
            style={[styles.codeBox, row]}
          >
            <Text style={[styles.code, { fontFamily: medium }]}>{inviteCode}</Text>
            <Image source={ICON_COPY} style={styles.copyIcon} contentFit="contain" transition={0} />
          </Pressable>
        </View>
        <View style={styles.artWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.art} contentFit="cover" />
          ) : (
            <Image source={CUP_TROPHY} style={styles.art} contentFit="contain" />
          )}
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    height: 194,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190,143,236,0.65)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 19,
    paddingVertical: 10,
    gap: 10,
  },
  copy: { flex: 1, gap: 8, minWidth: 0 },
  title: { color: '#fff', fontSize: 20 },
  sub: { color: '#B5B5B5', fontSize: 12 },
  stats: { gap: 17, marginTop: 2, flexWrap: 'wrap' },
  stat: { alignItems: 'center', gap: 4 },
  statTxt: { color: '#5D5D5D', fontSize: 11 },
  metaIcon: { width: 14, height: 14 },
  codeBox: {
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    height: 29,
    paddingHorizontal: 16,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#53198A',
    backgroundColor: 'rgba(7,4,13,0.9)',
  },
  code: { color: '#B673F5', fontSize: 11 },
  copyIcon: { width: 12, height: 12 },
  artWrap: {
    width: 135,
    height: 138,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: '100%', height: '100%' },
  actions: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    justifyContent: 'flex-start',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.16)',
  },
});
