import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { KingLeaderboardEntry, KingPeriod } from '../../services/predictions.service';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ART, KING_ICON } from './assets';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

export const KING_BUTTON_GRADIENT = ['#8B5CF6', '#2E146A'] as const;
const GOLD_LINE = ['rgba(24,6,64,0)', '#C29425', '#FFF0C0'] as const;

/** Medal tiers from Figma rows 1–3 (`1228:7416`, `1228:7439`, `1228:7462`). */
const TIERS = [
  { bg: 'rgba(235,175,22,0.43)', xp: '#FDF4DC', xpSize: 22, nameSize: 20, avatar: 38, medal: KING_ICON.medal1, medalSize: 32 },
  { bg: 'rgba(123,123,123,0.31)', xp: '#CECECE', xpSize: 20, nameSize: 18, avatar: 36, medal: KING_ICON.medal2, medalSize: 30 },
  { bg: 'rgba(211,151,110,0.17)', xp: '#D3976E', xpSize: 18, nameSize: 16, avatar: 34, medal: KING_ICON.medal3, medalSize: 28 },
] as const;

/** Preview card fades the tail the way the Figma card does (`1228:7642`). */
const PREVIEW_OPACITY = [1, 0.8, 0.7, 0.4, 0.2];

export function KingPeriodTabs({
  period,
  allLabel,
  weekLabel,
  onChange,
}: {
  period: KingPeriod;
  allLabel: string;
  weekLabel: string;
  onChange: (next: KingPeriod) => void;
}) {
  const fontBold = useAppFont(700);
  const fontRegular = useAppFont(400);
  const tab = (id: KingPeriod, label: string, side: 'left' | 'right') => {
    const active = period === id;
    const round = side === 'left' ? styles.tabLeft : styles.tabRight;
    if (active) {
      return (
        <LinearGradient key={id} colors={KING_BUTTON_GRADIENT} style={[styles.tab, round]}>
          <Text style={[styles.tabText, { fontFamily: fontBold }]}>{label}</Text>
        </LinearGradient>
      );
    }
    return (
      <Pressable key={id} onPress={() => onChange(id)} style={[styles.tab, styles.tabIdle, round]}>
        <Text style={[styles.tabText, { fontFamily: fontRegular }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.tabs}>
      {tab('all', allLabel, 'left')}
      {tab('week', weekLabel, 'right')}
    </View>
  );
}

/** Gold rule + icon + rule ornament above leaderboard titles. */
export function KingOrnament({ icon, lineWidth = 87, size = 24 }: { icon: number; lineWidth?: number; size?: number }) {
  const height = lineWidth > 40 ? 2 : 1;
  return (
    <View style={[styles.ornament, { width: lineWidth * 2 + size + 12 }]}>
      <LinearGradient colors={GOLD_LINE} locations={[0, 0.74, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: lineWidth, height, borderRadius: 1 }} />
      <Image source={icon} style={{ width: size, height: size }} contentFit="contain" />
      <LinearGradient colors={GOLD_LINE} locations={[0, 0.74, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={{ width: lineWidth, height, borderRadius: 1 }} />
    </View>
  );
}

export function KingEmptyState({
  title,
  actionLabel,
  onAction,
  scale = 1,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  scale?: number;
  style?: ViewStyle;
}) {
  const fontSemi = useAppFont(600);
  const fontBold = useAppFont(700);
  const blobW = 283.8 * scale;
  const blobH = 243.7 * scale;
  return (
    <View style={[styles.empty, { width: blobW }, style]}>
      <View style={{ width: blobW, height: blobH }}>
        <Image source={KING_ART.emptyBlob} style={StyleSheet.absoluteFill} contentFit="fill" />
        <Image
          source={KING_ART.emptyGoal}
          style={{
            position: 'absolute',
            left: 45.7 * scale,
            top: 39.5 * scale,
            width: 203.9 * scale,
            height: 159.8 * scale,
            opacity: 0.69,
          }}
          contentFit="fill"
        />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontSemi }]}>{title}</Text>
      {onAction && actionLabel ? (
        <Pressable onPress={onAction} style={styles.emptyBtnWrap}>
          <LinearGradient colors={KING_BUTTON_GRADIENT} style={[styles.emptyBtn, { height: scale < 1 ? 40 : 52 }]}>
            <Text style={[styles.emptyBtnText, { fontFamily: fontBold }]}>{actionLabel}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

export function KingBoardList({
  entries,
  meId,
  youLabel,
  xpLabel,
  preview,
}: {
  entries: KingLeaderboardEntry[];
  meId?: string | null;
  youLabel: string;
  xpLabel: string;
  preview?: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);

  return (
    <View style={{ gap: preview ? 6 : 8 }}>
      {entries.map((entry, index) => {
        const mine = meId != null && entry.userId === meId;
        const name = mine ? youLabel : (entry.displayName || entry.username || '—');
        const tier = entry.rank >= 1 && entry.rank <= 3 ? TIERS[entry.rank - 1] : null;
        const opacity = preview ? (PREVIEW_OPACITY[index] ?? 0.2) : 1;
        const avatarSize = tier?.avatar ?? 34;
        return (
          <View
            key={entry.userId}
            style={[
              styles.row,
              { backgroundColor: tier?.bg ?? '#0D0D0D', opacity },
              entry.rank === 1 && styles.rowGold,
            ]}
          >
            <View style={styles.xpWrap}>
              <Text
                style={[
                  styles.xp,
                  tier
                    ? { color: tier.xp, fontSize: tier.xpSize, fontFamily: entry.rank === 1 ? fontSemi : fontMedium }
                    : { color: '#EBDCFA', fontSize: 18, fontFamily: fontMedium },
                ]}
              >
                {entry.xp}
              </Text>
              <Text style={[styles.xpUnit, { color: tier ? tier.xp : '#831DE5', fontFamily: fontSemi }]}>{xpLabel}</Text>
            </View>
            <View style={[styles.identity, { gap: tier ? 16 : 30 }]}>
              <View style={styles.person}>
                <View style={styles.nameWrap}>
                  <Text
                    style={[
                      styles.name,
                      {
                        fontSize: tier?.nameSize ?? 16,
                        fontFamily: entry.rank === 1 ? fontBold : tier ? fontSemi : fontRegular,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {mine ? <Image source={KING_ICON.user} style={styles.youIcon} contentFit="contain" /> : null}
                </View>
                <Image
                  source={entry.avatar ? { uri: entry.avatar } : PLACEHOLDER}
                  style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: '#2A2A2A' }}
                  contentFit="cover"
                />
              </View>
              {tier ? (
                <Image source={tier.medal} style={{ width: tier.medalSize, height: tier.medalSize }} contentFit="contain" />
              ) : (
                <Text style={[styles.rankNum, { fontFamily: fontRegular }]}>{entry.rank}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    height: 46,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIdle: {
    backgroundColor: '#080709',
    borderWidth: 1,
    borderColor: '#161419',
  },
  tabLeft: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  tabRight: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  tabText: {
    color: '#fff',
    fontSize: 16,
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    height: 58,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowGold: {
    shadowColor: 'rgba(70,5,132,1)',
    shadowOpacity: 0.25,
    shadowRadius: 5.6,
    shadowOffset: { width: 0, height: 1 },
  },
  xpWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  xp: {
    color: '#fff',
  },
  xpUnit: {
    fontSize: 16,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 12,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  name: {
    color: '#fff',
    flexShrink: 1,
    textAlign: 'right',
  },
  youIcon: {
    width: 16,
    height: 16,
  },
  rankNum: {
    color: '#fff',
    fontSize: 16,
    minWidth: 10,
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#858585',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyBtnWrap: {
    alignSelf: 'stretch',
  },
  emptyBtn: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 23,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 16,
  },
});
