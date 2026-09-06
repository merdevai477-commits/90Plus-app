/**
 * One leaderboard row — Figma node 147:294's row styling, reused verbatim by
 * both the top-5 card on the Share & Win screen and the full ranking page.
 *
 * Memoised and prop-flat on purpose: this renders inside a FlatList that can
 * hold thousands of rows, so it must never take a freshly-allocated object or
 * closure as a prop, and all formatting is done from primitives already
 * computed by the caller.
 */

import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { MEDAL_BY_RANK, SW_ASSET } from '../assets';
import { SW_COLOR, rowTier, useShareWinStyles } from '../styles';

export interface LeaderboardRowProps {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  /** Pre-formatted so no Intl work happens during scroll. */
  scoreLabel: string;
  /** Unit next to the count — participations, not XP. */
  scoreUnit: string;
  /** Visual tier index — clamped by the caller (0-4 in Figma). */
  tierIndex: number;
  /** Highlight treatment for the signed-in user's own row. */
  isCurrentUser?: boolean;
  /** Ignore the tier's opacity ramp — used by the pinned "you" bar. */
  solid?: boolean;
  onPress?: (username: string) => void;
  username: string;
}

const LeaderboardRow = memo(function LeaderboardRow({
  rank,
  name,
  avatar,
  scoreLabel,
  scoreUnit,
  tierIndex,
  isCurrentUser = false,
  solid = false,
  onPress,
  username,
}: LeaderboardRowProps) {
  const { sw, metrics } = useShareWinStyles();
  const { s, f } = metrics;

  const tier = rowTier(tierIndex);
  const medal = MEDAL_BY_RANK[rank];
  const avatarSize = s(tier.avatar);

  return (
    <Pressable
      onPress={onPress ? () => onPress(username) : undefined}
      disabled={!onPress}
      style={[
        sw.boardRow,
        tier.lead ? sw.boardRowLead : sw.boardRowRest,
        { opacity: solid ? 1 : tier.opacity },
        isCurrentUser && sw.boardRowMine,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${rank}. ${name} — ${scoreLabel} ${scoreUnit}`}
    >
      <View style={[sw.boardRowLeft, !medal && sw.boardRowLeftNumbered]}>
        {medal ? (
          <Image
            source={medal}
            style={{ width: s(tier.medal), height: s(tier.medal) }}
            contentFit="contain"
            transition={0}
          />
        ) : (
          <Text style={sw.boardRankNumber}>{rank}</Text>
        )}

        <View style={sw.boardIdentity}>
          <Image
            source={avatar ? { uri: avatar } : SW_ASSET.usersDuo}
            style={[
              sw.boardAvatar,
              { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              isCurrentUser && sw.boardAvatarMine,
            ]}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            recyclingKey={username}
          />
          <Text style={[sw.boardName, { fontSize: f(tier.name) }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>

      <View style={sw.boardScoreGroup}>
        <Text
          style={[
            sw.boardName,
            {
              fontSize: f(tier.score),
              color: tier.lead ? SW_COLOR.purpleBright : SW_COLOR.scoreTint,
            },
          ]}
        >
          {scoreLabel}
        </Text>
        <Text style={sw.boardScoreXp}>{scoreUnit}</Text>
      </View>
    </Pressable>
  );
});

export default LeaderboardRow;
