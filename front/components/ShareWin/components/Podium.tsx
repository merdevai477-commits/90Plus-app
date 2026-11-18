/**
 * Top-3 podium — Figma Frame123 node 2025:6715.
 * Visual order: 2nd (left) · 1st (center, tallest) · 3rd (right).
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinLeaderboardEntry } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { displayNameOf, formatNumber } from '../data';
import { useShareWinStyles } from '../styles';
import GradientText from './GradientText';

interface PodiumProps {
  entries: ShareWinLeaderboardEntry[];
}

type Slot = {
  entry: ShareWinLeaderboardEntry | null;
  place: 1 | 2 | 3;
  avatar: number;
  blockW: number;
  blockH: number;
  topH: number;
  nameSize: number;
  pillH: number;
  pillFs: number;
  topAsset: number;
  numberColors: readonly [string, string];
  numberSize: number;
  pillBg: string;
  pillColor: string;
};

const Podium = memo(function Podium({ entries }: PodiumProps) {
  const { metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const { s, f } = metrics;

  const first = entries.find((e) => e.rank === 1) ?? entries[0] ?? null;
  const second = entries.find((e) => e.rank === 2) ?? entries[1] ?? null;
  const third = entries.find((e) => e.rank === 3) ?? entries[2] ?? null;

  const slots: Slot[] = [
    {
      entry: second,
      place: 2,
      avatar: 51,
      blockW: 124.6,
      blockH: 121.6,
      topH: 13.35,
      nameSize: 16,
      pillH: 21,
      pillFs: 9,
      topAsset: SW_ASSET.podiumTop2,
      numberColors: ['#C7C7C7', '#616161'],
      numberSize: 40,
      pillBg: 'rgba(145,145,145,0.15)',
      pillColor: '#656565',
    },
    {
      entry: first,
      place: 1,
      avatar: 67,
      blockW: 171.9,
      blockH: 167.8,
      topH: 18.4,
      nameSize: 20,
      pillH: 24,
      pillFs: 11,
      topAsset: SW_ASSET.podiumTop1,
      numberColors: ['#FBC944', '#E9AD0C'],
      numberSize: 72,
      pillBg: 'rgba(205,181,248,0.35)',
      pillColor: theme.primary,
    },
    {
      entry: third,
      place: 3,
      avatar: 45,
      blockW: 94.2,
      blockH: 91.9,
      topH: 10.1,
      nameSize: 12,
      pillH: 15,
      pillFs: 7,
      topAsset: SW_ASSET.podiumTop3,
      numberColors: ['#F6BF73', '#8F580C'],
      numberSize: 40,
      pillBg: 'rgba(209,155,79,0.15)',
      pillColor: '#986825',
    },
  ];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          width: '100%',
          height: s(353),
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        row: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        },
        col: {
          alignItems: 'center',
        },
        name: {
          fontWeight: '700',
          color: theme.ink,
          textAlign: 'center',
          marginTop: s(4),
          textShadowColor: 'rgba(0,0,0,0.25)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 1,
        },
        pill: {
          marginTop: s(5),
          borderRadius: s(50),
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: s(8),
        },
        pillText: {
          fontWeight: '600',
          textAlign: 'center',
        },
        block: {
          marginTop: s(10),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        topCap: {
          width: '100%',
        },
      }),
    [s, theme],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {slots.map((slot) => {
          const avatarSize = s(slot.avatar);
          const friends = slot.entry?.participants ?? 0;
          const name = slot.entry ? displayNameOf(slot.entry) : '—';
          return (
            <View
              key={slot.place}
              style={[
                styles.col,
                {
                  width: s(slot.blockW),
                  marginBottom: slot.place === 1 ? 0 : slot.place === 2 ? s(20) : s(40),
                },
              ]}
            >
              <Image
                source={
                  slot.entry?.avatar
                    ? { uri: slot.entry.avatar }
                    : SW_ASSET.usersDuo
                }
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                }}
                contentFit="cover"
                transition={120}
              />
              <Text
                style={[styles.name, { fontSize: f(slot.nameSize), width: s(slot.blockW) }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <View
                style={[
                  styles.pill,
                  {
                    height: s(slot.pillH),
                    backgroundColor: slot.pillBg,
                    minWidth: s(slot.place === 1 ? 80 : slot.place === 2 ? 65 : 52),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { fontSize: f(slot.pillFs), color: slot.pillColor },
                  ]}
                >
                  {`${formatNumber(friends, language)} ${copy.friendsUnit}`}
                </Text>
              </View>

              <View style={{ width: s(slot.blockW), marginTop: s(8) }}>
                <Image
                  source={slot.topAsset}
                  style={[styles.topCap, { height: s(slot.topH) }]}
                  contentFit="fill"
                  transition={0}
                />
                <LinearGradient
                  colors={[...theme.podiumGradient]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    styles.block,
                    {
                      width: s(slot.blockW),
                      height: s(slot.blockH),
                      marginTop: 0,
                    },
                  ]}
                >
                  <GradientText
                    colors={slot.numberColors}
                    style={{
                      fontSize: f(slot.numberSize),
                      fontWeight: '600',
                      textAlign: 'center',
                    }}
                  >
                    {String(slot.place)}
                  </GradientText>
                </LinearGradient>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default Podium;
