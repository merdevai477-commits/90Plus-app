/**
 * In-group standings row — Figma 601:4171.
 * Layout (RTL): rank medal/number | avatar + name | XP value.
 */

import { Image } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { GroupMember } from './data';
import { useTranslation } from '../../src/i18n';
import { usePGFonts } from './theme';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.png');
const MEDAL_GOLD = require('../../assets/images/prediction-groups/medal-gold.svg');
const MEDAL_SILVER = require('../../assets/images/prediction-groups/medal-silver.svg');
const MEDAL_BRONZE = require('../../assets/images/prediction-groups/medal-bronze.svg');

const MEDAL_BY_RANK: Record<number, number> = {
  1: MEDAL_GOLD,
  2: MEDAL_SILVER,
  3: MEDAL_BRONZE,
};

const MEDAL_SIZE: Record<number, number> = {
  1: 32,
  2: 30,
  3: 28,
};

function formatXp(value: number): string {
  try {
    return value.toLocaleString('en-US');
  } catch {
    return String(value);
  }
}

export const GroupStandingsRow = memo(function GroupStandingsRow({
  member,
  isRTL,
  onPress,
}: {
  member: GroupMember;
  isRTL: boolean;
  onPress?: () => void;
}) {
  const { bold, medium } = usePGFonts();
  const { t, direction } = useTranslation();
  const lb = t.predictionGroups.leaderboard;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const xp = member.totalPoints ?? member.points ?? 0;
  const medal = MEDAL_BY_RANK[member.rank];
  const medalSize = MEDAL_SIZE[member.rank] ?? 28;
  const isTop = member.rank === 1;
  const xpSize = member.rank === 1 ? 22 : member.rank <= 2 ? 20 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [pressed && onPress && { opacity: 0.92 }]}
    >
      <View
        style={[
          styles.card,
          row,
          isTop && styles.cardTop,
          member.isMe && styles.cardMe,
        ]}
      >
        <View style={[styles.identity, row]}>
          <View style={[styles.rankSlot, { width: 32 }]}>
            {medal ? (
              <Image
                source={medal}
                style={{ width: medalSize, height: medalSize }}
                contentFit="contain"
                transition={0}
              />
            ) : (
              <Text style={[styles.rankNum, { fontFamily: medium, writingDirection: direction }]}>
                {member.rank}
              </Text>
            )}
          </View>
          <View style={[styles.person, row]}>
            <Image
              source={member.avatar ? { uri: member.avatar } : PLACEHOLDER}
              style={styles.avatar}
              contentFit="cover"
            />
            <Text
              style={[
                styles.name,
                {
                  fontFamily: medium,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: direction,
                },
                member.isMe && styles.nameMe,
              ]}
              numberOfLines={1}
            >
              {member.name}
            </Text>
          </View>
        </View>

        <View style={styles.xpCol}>
          <Text
            style={[
              styles.xpVal,
              {
                fontFamily: isTop ? bold : medium,
                fontSize: xpSize,
                color: isTop ? '#973FE8' : '#EADBF9',
              },
            ]}
          >
            {formatXp(xp)}
          </Text>
          <Text style={[styles.xpUnit, { fontFamily: bold }]}>{lb.xp}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    height: 66,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#07040D',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardTop: {
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: 'rgba(69,5,133,0.25)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 5.6,
    elevation: 4,
  },
  cardMe: {
    borderColor: 'rgba(168,85,247,0.45)',
  },
  identity: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  rankSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: {
    color: '#fff',
    fontSize: 16,
  },
  person: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(194,194,194,0.92)',
    backgroundColor: 'rgba(128,59,69,0.5)',
  },
  name: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 20,
  },
  nameMe: {
    color: '#C4B5FD',
  },
  xpCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  xpVal: {
    color: '#EADBF9',
  },
  xpUnit: {
    color: '#851CE5',
    fontSize: 16,
  },
});
