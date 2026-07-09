/**
 * Leaderboard row — premium treatment for podium (top 3) positions.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { GroupMember } from './data';
import { HomeRankBadge } from './HomeRankBadge';
import { PG, usePGFonts } from './theme';
import { useTranslation } from '../../src/i18n';

const PODIUM: Record<number, { bg: [string, string]; border: string; glow: string; avatar: number }> = {
  1: {
    bg: ['rgba(245,185,66,0.14)', 'rgba(245,185,66,0.03)'],
    border: 'rgba(245,185,66,0.35)',
    glow: '#F5B942',
    avatar: 42,
  },
  2: {
    bg: ['rgba(203,213,225,0.12)', 'rgba(203,213,225,0.02)'],
    border: 'rgba(203,213,225,0.28)',
    glow: '#CBD5E1',
    avatar: 40,
  },
  3: {
    bg: ['rgba(234,88,12,0.12)', 'rgba(234,88,12,0.02)'],
    border: 'rgba(253,186,116,0.3)',
    glow: '#EA580C',
    avatar: 40,
  },
};

export function HomeLeaderboardRow({
  member,
  isRTL,
  onPress,
  onLongPress,
}: {
  member: GroupMember;
  isRTL: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { bold, extra, medium } = usePGFonts();
  const { t } = useTranslation();
  const lb = t.predictionGroups.leaderboard;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const isMe = member.isMe;
  const podium = PODIUM[member.rank];
  const avatarSize = podium?.avatar ?? 36;

  const glow = podium
    ? Platform.select({
        ios: {
          shadowColor: podium.glow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
        default: {},
      })
    : undefined;

  const content = (
    <>
      <HomeRankBadge rank={member.rank} />
      <Image
        source={{ uri: member.avatar }}
        style={[
          styles.avatar,
          { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
          podium && { borderWidth: 2, borderColor: podium.border },
        ]}
        contentFit="cover"
      />
      <View style={[styles.nameCol, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.nameRow, row]}>
          <Text
            style={[
              styles.name,
              { fontFamily: bold, textAlign: isRTL ? 'right' : 'left' },
              podium && { fontSize: 15 },
              isMe && !podium && { color: PG.primaryLight },
              member.rank === 1 && { color: '#FDE68A' },
            ]}
            numberOfLines={1}
          >
            {member.name}
          </Text>
          {member.isAdmin ? (
            <View style={[styles.adminChip, row]}>
              <Crown size={10} color={PG.gold} fill={PG.gold} />
              <Text style={[styles.adminLabel, { fontFamily: medium }]}>{lb.admin}</Text>
            </View>
          ) : null}
        </View>
        {(member.totalPoints ?? 0) > 0 || member.correct > 0 ? (
          <Text style={[styles.metaLine, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
            {member.correct > 0 ? lb.correctCount.replace('{count}', String(member.correct)) : ''}
            {member.correct > 0 && (member.totalPoints ?? 0) > 0 ? ' · ' : ''}
            {(member.totalPoints ?? 0) > 0 ? `${member.totalPoints} ${lb.xp}` : ''}
          </Text>
        ) : null}
      </View>
      {(member.totalPoints ?? 0) > 0 ? (
        <View style={styles.pointsCol}>
          <Text
            style={[
              styles.points,
              { fontFamily: extra },
              podium && { fontSize: 16 },
              member.rank === 1 && { color: '#FDE68A' },
            ]}
          >
            {member.totalPoints}
          </Text>
          <Text style={[styles.xpLabel, { fontFamily: medium }]}>{lb.xp}</Text>
        </View>
      ) : (
        <Text style={[styles.emptyPoints, { fontFamily: medium }]} numberOfLines={2}>
          {lb.emptyNudge}
        </Text>
      )}
    </>
  );

  if (podium) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress}>
        <View style={[glow, styles.podiumShell]}>
          <LinearGradient
            colors={podium.bg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.row, row, styles.podiumRow, { borderColor: podium.border }]}
          >
            {content}
          </LinearGradient>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress}>
      <View style={[styles.row, row, isMe && styles.meRow]}>{content}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  podiumShell: {
    marginBottom: 8,
    borderRadius: 14,
  },
  podiumRow: {
    borderWidth: 1,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  meRow: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  avatar: {
    backgroundColor: PG.cardElevated,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 14,
    color: PG.text,
    flexShrink: 1,
  },
  adminChip: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(245,185,66,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,185,66,0.35)',
  },
  adminLabel: {
    fontSize: 9,
    color: PG.gold,
    letterSpacing: 0.2,
  },
  points: {
    fontSize: 14,
    color: PG.text,
    lineHeight: 18,
  },
  pointsCol: {
    alignItems: 'center',
    minWidth: 44,
  },
  xpLabel: {
    fontSize: 9,
    color: PG.textMuted,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  metaLine: {
    fontSize: 10,
    color: PG.textMuted,
    lineHeight: 14,
    marginTop: 2,
  },
  emptyPoints: {
    fontSize: 10,
    color: PG.textMuted,
    maxWidth: 88,
    textAlign: 'center',
    lineHeight: 14,
  },
});
