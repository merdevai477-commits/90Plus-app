/**
 * Leaderboard row — Figma Frame123 component 2021:151 / list 2022:6332.
 * Theme-aware (light + dark), medals for top 3, and elite title (لقب) under the name.
 */

import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import BadgeIcon from '../../identity/BadgeIcon';
import DeveloperBadge from '../../profile/DeveloperBadge';
import VerifiedBadge from '../../profile/VerifiedBadge';
import { MEDAL_BY_RANK, SW_ASSET } from '../assets';
import { useShareWinStyles } from '../styles';

export interface LeaderboardRowProps {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  /** Pre-formatted friends count. */
  scoreLabel: string;
  /** Unit next to the friends count — "صديق" / "friends". */
  scoreUnit: string;
  /** Pre-formatted score line under the name, e.g. "543 نقطة". */
  pointsLine?: string;
  /** Highlight treatment for the signed-in user's own row. */
  isCurrentUser?: boolean;
  onPress?: (username: string) => void;
  username: string;
  isVerified?: boolean;
  isDeveloper?: boolean;
  badgeKey?: string | null;
  badgeTitle?: string | null;
  badgeAccent?: string | null;
}

const LeaderboardRow = memo(function LeaderboardRow({
  rank,
  name,
  avatar,
  scoreLabel,
  scoreUnit,
  pointsLine,
  isCurrentUser = false,
  onPress,
  username,
  isVerified,
  isDeveloper,
  badgeKey,
  badgeTitle,
  badgeAccent,
}: LeaderboardRowProps) {
  const { metrics, theme } = useShareWinStyles();
  const { s, f } = metrics;
  const medal = MEDAL_BY_RANK[rank];
  const letter = (name || '?').charAt(0).toUpperCase();
  const titleColor = badgeAccent || theme.accent;
  const secondaryInk = theme.isDark ? theme.secondary : theme.dark;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          width: '100%',
          minHeight: s(68),
          borderRadius: s(16),
          backgroundColor: theme.rowBg,
          borderWidth: 1,
          borderColor: theme.isDark ? theme.border : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s(10),
          paddingVertical: s(8),
          gap: s(6),
        },
        rowLead: {
          backgroundColor: theme.isDark ? theme.cardAlt : theme.pale,
          borderColor: theme.isDark ? 'rgba(245,179,1,0.28)' : 'rgba(106,43,217,0.18)',
        },
        rowMine: {
          borderColor: theme.primary,
          backgroundColor: theme.isDark
            ? 'rgba(106,43,217,0.28)'
            : 'rgba(106,43,217,0.12)',
        },
        pointsCol: {
          width: s(70),
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        pointsValue: {
          fontSize: f(18),
          fontWeight: '700',
          color: theme.primary,
          textAlign: 'center',
        },
        pointsUnit: {
          fontSize: f(10),
          fontWeight: '600',
          color: theme.muted,
          textAlign: 'center',
        },
        userCol: {
          flex: 1,
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingHorizontal: s(4),
          gap: s(2),
          minWidth: 0,
        },
        nameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: s(4),
          maxWidth: '100%',
        },
        name: {
          fontSize: f(12),
          fontWeight: '600',
          color: theme.ink,
          textAlign: 'right',
          flexShrink: 1,
        },
        title: {
          fontSize: f(10),
          fontWeight: '600',
          color: titleColor,
          textAlign: 'right',
          maxWidth: '100%',
        },
        scoreLine: {
          fontSize: f(9),
          fontWeight: '500',
          color: secondaryInk,
          textAlign: 'right',
        },
        avatar: {
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          backgroundColor: theme.avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        },
        avatarMine: {
          borderWidth: 1.5,
          borderColor: theme.primary,
        },
        avatarLetter: {
          fontSize: f(14),
          fontWeight: '600',
          color: theme.primary,
          textAlign: 'center',
        },
        rankBadge: {
          width: s(32),
          height: s(32),
          borderRadius: s(16),
          backgroundColor: theme.pale,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        rankText: {
          fontSize: f(11),
          fontWeight: '700',
          color: theme.isDark ? theme.ink : theme.dark,
          textAlign: 'center',
        },
        medal: {
          width: s(28),
          height: s(28),
        },
      }),
    [f, s, secondaryInk, theme, titleColor],
  );

  return (
    <Pressable
      onPress={onPress ? () => onPress(username) : undefined}
      disabled={!onPress}
      style={[
        styles.row,
        rank <= 3 && styles.rowLead,
        isCurrentUser && styles.rowMine,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[
        `${rank}. ${name}`,
        badgeTitle || null,
        `${scoreLabel} ${scoreUnit}`,
        pointsLine || null,
      ]
        .filter(Boolean)
        .join(' — ')}
    >
      <View style={styles.pointsCol}>
        <Text style={styles.pointsValue} numberOfLines={1}>
          {scoreLabel}
        </Text>
        <Text style={styles.pointsUnit} numberOfLines={1}>
          {scoreUnit}
        </Text>
      </View>

      <View style={styles.userCol}>
        <View style={styles.nameRow}>
          {badgeKey ? (
            <BadgeIcon
              badgeKey={badgeKey}
              accent={badgeAccent || theme.accent}
              variant="leaderboard"
            />
          ) : null}
          {isDeveloper ? <DeveloperBadge size={14} /> : null}
          {isVerified ? <VerifiedBadge size={14} /> : null}
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {badgeTitle ? (
          <Text style={styles.title} numberOfLines={1}>
            {badgeTitle}
          </Text>
        ) : null}
        {pointsLine ? (
          <Text style={styles.scoreLine} numberOfLines={1}>
            {pointsLine}
          </Text>
        ) : null}
      </View>

      <View style={[styles.avatar, isCurrentUser && styles.avatarMine]}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{ width: s(40), height: s(40), borderRadius: s(20) }}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            recyclingKey={username}
          />
        ) : (
          <Text style={styles.avatarLetter}>{letter}</Text>
        )}
      </View>

      <View style={styles.rankBadge}>
        {medal ? (
          <Image source={medal} style={styles.medal} contentFit="contain" transition={0} />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>

      {/* Keep usersDuo bound for Fast Refresh / wrap-jsx after hot reloads. */}
      {false ? (
        <Image source={SW_ASSET.usersDuo} style={{ width: 0, height: 0 }} />
      ) : null}
    </Pressable>
  );
});

export default LeaderboardRow;
