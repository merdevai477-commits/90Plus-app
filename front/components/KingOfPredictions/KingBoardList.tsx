import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { KingLeaderboardEntry } from '../../services/predictions.service';
import { useAppFont } from '../../utils/fontSetup';
import { KING_PURPLE } from './shared';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

const MEDAL = ['#F6C445', '#C0C6D4', '#D08A4A'];

export function KingBoardList({
  entries,
  meId,
  youLabel,
  xpLabel,
  emptyTitle,
  onEmptyAction,
  emptyActionLabel,
}: {
  entries: KingLeaderboardEntry[];
  meId?: string | null;
  youLabel: string;
  xpLabel: string;
  emptyTitle?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🏆</Text>
        <Text style={[styles.emptyTitle, { fontFamily: fontSemi }]}>{emptyTitle}</Text>
        {onEmptyAction && emptyActionLabel ? (
          <Pressable style={styles.emptyBtn} onPress={onEmptyAction}>
            <Text style={[styles.emptyBtnText, { fontFamily: fontSemi }]}>{emptyActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {entries.map((entry) => {
        const mine = meId != null && entry.userId === meId;
        const name = mine ? youLabel : (entry.displayName || entry.username || '—');
        return (
          <View key={entry.userId} style={[styles.row, mine && styles.rowMine]}>
            <Text style={[styles.xp, { fontFamily: fontBold }]}>
              {entry.xp} <Text style={[styles.xpUnit, { fontFamily: fontMedium }]}>{xpLabel}</Text>
            </Text>
            <View style={styles.identity}>
              <View style={styles.nameWrap}>
                <Text style={[styles.name, mine && styles.nameMine, { fontFamily: mine ? fontBold : fontSemi }]} numberOfLines={1}>
                  {name}
                </Text>
                {mine ? <User size={14} color={KING_PURPLE} /> : null}
              </View>
              <Image
                source={entry.avatar ? { uri: entry.avatar } : PLACEHOLDER}
                style={styles.avatar}
                contentFit="cover"
              />
              <RankMark rank={entry.rank} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RankMark({ rank }: { rank: number }) {
  const fontBold = useAppFont(700);
  if (rank <= 3) {
    return (
      <View style={[styles.medal, { backgroundColor: MEDAL[rank - 1] }]}>
        <Text style={[styles.medalText, { fontFamily: fontBold }]}>{rank}</Text>
      </View>
    );
  }
  return <Text style={[styles.rankNum, { fontFamily: fontBold }]}>{rank}</Text>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowMine: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderRadius: 12,
    borderBottomWidth: 0,
    marginVertical: 2,
  },
  xp: {
    color: '#fff',
    fontSize: 18,
  },
  xpUnit: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '68%',
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    flexShrink: 1,
  },
  nameMine: {
    color: '#E9D5FF',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
  },
  medal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    color: '#1A1020',
    fontSize: 13,
  },
  rankNum: {
    color: '#fff',
    fontSize: 16,
    minWidth: 18,
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#D4D4D8',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 14,
    backgroundColor: KING_PURPLE,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
  },
});
