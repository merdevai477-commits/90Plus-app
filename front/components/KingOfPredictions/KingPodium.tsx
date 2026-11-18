import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { KingLeaderboardEntry } from '../../services/predictions.service';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ART } from './assets';
import type { KingPlayTheme } from './playTheme';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

type Props = {
  top: KingLeaderboardEntry[];
  theme: KingPlayTheme;
  pointsLabel: string;
};

export const KingPodium = memo(function KingPodium({ top, theme, pointsLabel }: Props) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const first = top.find((e) => e.rank === 1) ?? top[0];
  const second = top.find((e) => e.rank === 2) ?? top[1];
  const third = top.find((e) => e.rank === 3) ?? top[2];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <PodiumSlot
          entry={second}
          place={2}
          theme={theme}
          pointsLabel={pointsLabel}
          fonts={{ bold: fontBold, semi: fontSemi }}
        />
        <PodiumSlot
          entry={first}
          place={1}
          theme={theme}
          pointsLabel={pointsLabel}
          fonts={{ bold: fontBold, semi: fontSemi }}
        />
        <PodiumSlot
          entry={third}
          place={3}
          theme={theme}
          pointsLabel={pointsLabel}
          fonts={{ bold: fontBold, semi: fontSemi }}
        />
      </View>
    </View>
  );
});

function PodiumSlot({
  entry,
  place,
  theme,
  pointsLabel,
  fonts,
}: {
  entry?: KingLeaderboardEntry;
  place: 1 | 2 | 3;
  theme: KingPlayTheme;
  pointsLabel: string;
  fonts: { bold: string; semi: string };
}) {
  const meta = PLACE[place];
  const name = entry?.displayName || entry?.username || '—';
  const xp = entry?.xp ?? 0;

  return (
    <View style={[styles.slot, { width: meta.width, marginTop: meta.offset }]}>
      <Image
        source={entry?.avatar ? { uri: entry.avatar } : PLACEHOLDER}
        style={{ width: meta.avatar, height: meta.avatar, borderRadius: meta.avatar / 2 }}
        contentFit="cover"
      />
      <Text
        style={[styles.name, { color: theme.ink, fontFamily: fonts.bold, fontSize: meta.nameSize }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <View style={[styles.xpPill, { backgroundColor: meta.pillBg }]}>
        <Text style={[styles.xpText, { color: meta.pillText, fontFamily: fonts.semi, fontSize: meta.pillSize }]}>
          {`${xp} ${pointsLabel}`}
        </Text>
      </View>

      <View style={[styles.block, { width: meta.blockW, height: meta.blockH }]}>
        <Image source={meta.top} style={{ width: meta.blockW, height: meta.topH }} contentFit="fill" />
        <LinearGradient colors={['#4B1FA3', '#1C0C3D']} style={[styles.blockBody, { height: meta.blockH - meta.topH }]}>
          <Text
            style={[
              styles.placeNum,
              {
                fontFamily: fonts.semi,
                fontSize: meta.numSize,
                color: meta.numColor,
                textShadowColor: 'rgba(0,0,0,0.25)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
              },
            ]}
          >
            {place}
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const PLACE = {
  1: {
    width: 124,
    offset: 0,
    avatar: 67,
    nameSize: 18,
    pillSize: 11,
    pillBg: 'rgba(205,181,248,0.35)',
    pillText: '#6A2BD9',
    blockW: 124,
    blockH: 186,
    topH: 18,
    numSize: 72,
    numColor: '#FBC944',
    top: KING_ART.podiumTop1,
  },
  2: {
    width: 110,
    offset: 36,
    avatar: 51,
    nameSize: 14,
    pillSize: 9,
    pillBg: 'rgba(145,145,145,0.15)',
    pillText: '#656565',
    blockW: 110,
    blockH: 135,
    topH: 13,
    numSize: 40,
    numColor: '#C7C7C7',
    top: KING_ART.podiumTop2,
  },
  3: {
    width: 96,
    offset: 64,
    avatar: 45,
    nameSize: 12,
    pillSize: 8,
    pillBg: 'rgba(209,155,79,0.15)',
    pillText: '#986825',
    blockW: 94,
    blockH: 102,
    topH: 10,
    numSize: 36,
    numColor: '#F6BF73',
    top: KING_ART.podiumTop3,
  },
} as const;

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', paddingTop: 8 },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  slot: { alignItems: 'center', gap: 5 },
  name: { textAlign: 'center', maxWidth: '100%' },
  xpPill: {
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpText: { textAlign: 'center' },
  block: { marginTop: 8, overflow: 'hidden', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  blockBody: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeNum: { textAlign: 'center' },
});
