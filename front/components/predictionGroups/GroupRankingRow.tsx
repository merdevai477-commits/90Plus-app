/**
 * Single row in the global groups leaderboard — rank, avatar, name, points.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { RankedGroup } from './data';
import { HomeRankBadge } from './HomeRankBadge';
import { PG, usePGFonts } from './theme';

const PODIUM: Record<number, { bg: [string, string]; border: string; glow: string; avatar: number }> = {
  1: {
    bg: ['rgba(245,185,66,0.14)', 'rgba(245,185,66,0.03)'],
    border: 'rgba(245,185,66,0.35)',
    glow: '#F5B942',
    avatar: 44,
  },
  2: {
    bg: ['rgba(203,213,225,0.12)', 'rgba(203,213,225,0.02)'],
    border: 'rgba(203,213,225,0.28)',
    glow: '#CBD5E1',
    avatar: 42,
  },
  3: {
    bg: ['rgba(234,88,12,0.12)', 'rgba(234,88,12,0.02)'],
    border: 'rgba(253,186,116,0.3)',
    glow: '#EA580C',
    avatar: 42,
  },
};

export function GroupRankingRow({
  group,
  isRTL,
}: {
  group: RankedGroup;
  isRTL: boolean;
}) {
  const { bold, extra, medium } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const podium = PODIUM[group.rank];
  const isMine = group.isMine;
  const avatarSize = podium?.avatar ?? 38;

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
      <HomeRankBadge rank={group.rank} />
      <Image
        source={{ uri: group.avatar }}
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize * 0.28,
          },
          podium && { borderWidth: 2, borderColor: podium.border },
          isMine && !podium && styles.avatarMine,
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <Text
        style={[
          styles.name,
          { fontFamily: bold, textAlign: isRTL ? 'right' : 'left' },
          podium && { fontSize: 15 },
          group.rank === 1 && { color: '#FDE68A' },
          isMine && !podium && { color: PG.primaryLight },
        ]}
        numberOfLines={1}
      >
        {group.name}
      </Text>
      {group.points > 0 && group.hasScores !== false ? (
        <Text
          style={[
            styles.points,
            { fontFamily: extra },
            podium && { fontSize: 16 },
            group.rank === 1 && { color: '#FDE68A' },
            isMine && !podium && { color: PG.primaryLight },
          ]}
        >
          {group.points}
        </Text>
      ) : (
        <Text style={[styles.emptyPoints, { fontFamily: medium }]} numberOfLines={2}>
          توقعو كونو اول المصنفين
        </Text>
      )}
    </>
  );

  if (podium) {
    return (
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
    );
  }

  return <View style={[styles.row, row, isMine && styles.rowMine]}>{content}</View>;
}

const styles = StyleSheet.create({
  podiumShell: {
    marginBottom: 6,
    borderRadius: 14,
  },
  podiumRow: {
    borderWidth: 1,
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowMine: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  avatar: {
    backgroundColor: PG.cardElevated,
  },
  avatarMine: {
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.45)',
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: PG.text,
  },
  points: {
    fontSize: 14,
    color: PG.text,
    minWidth: 40,
    textAlign: 'center',
  },
  emptyPoints: {
    fontSize: 10,
    color: PG.textMuted,
    maxWidth: 96,
    textAlign: 'center',
    lineHeight: 14,
  },
});
