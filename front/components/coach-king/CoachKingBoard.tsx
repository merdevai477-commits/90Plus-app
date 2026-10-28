import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkBoardRow } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

const TIERS = [
  { bg: ['#3A2A08', '#1A1204'] as const, border: '#F8C94A', badge: '#F8C94A', label: '#1A0B00', ring: '#F8C94A' },
  { bg: ['#2A2A30', '#141418'] as const, border: '#C8C8D0', badge: '#C8C8D0', label: '#1A1A1E', ring: '#C8C8D0' },
  { bg: ['#2E1C12', '#160E08'] as const, border: '#D08A4A', badge: '#D08A4A', label: '#1A0B00', ring: '#D08A4A' },
] as const;

type Props = {
  entries: CkBoardRow[];
  isAr: boolean;
  pointsLabel: string;
  playerLabel: string;
  youLabel: string;
  onOpen: (row: CkBoardRow) => void;
};

export function CoachKingBoard({ entries, isAr, pointsLabel, playerLabel, youLabel, onOpen }: Props) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const row = isAr ? 'row-reverse' : 'row';

  return (
    <View style={styles.root}>
      <View style={[styles.head, { flexDirection: row }]}>
        <Text style={[styles.headRank, { fontFamily: fontMed }]}>#</Text>
        <Text style={[styles.headPlayer, { fontFamily: fontMed, textAlign: isAr ? 'right' : 'left' }]}>
          {playerLabel}
        </Text>
        <Text style={[styles.headPts, { fontFamily: fontMed }]}>{pointsLabel}</Text>
        <View style={styles.headChevron} />
      </View>

      <View style={styles.list}>
        {entries.map((entry) => {
          const tier = entry.rank >= 1 && entry.rank <= 3 ? TIERS[entry.rank - 1] : null;
          const name = entry.isMe ? youLabel : entry.name;
          const body = (
            <Pressable
              onPress={() => onOpen(entry)}
              testID={`ck-board-${entry.rank}`}
              style={({ pressed }) => [
                styles.row,
                { flexDirection: row },
                !tier && styles.rowPlain,
                entry.isMe && styles.rowMe,
                pressed && { opacity: 0.88 },
              ]}
            >
              <View style={[styles.rankSlot, tier && { backgroundColor: tier.badge }]}>
                <Text
                  style={[
                    styles.rankTxt,
                    {
                      fontFamily: fontBold,
                      color: tier ? tier.label : '#C9B8F0',
                    },
                  ]}
                >
                  {entry.rank}
                </Text>
              </View>

              <View style={[styles.person, { flexDirection: row }]}>
                <Image
                  source={entry.avatar ? { uri: entry.avatar } : PLACEHOLDER}
                  style={[styles.avatar, tier && { borderColor: tier.ring }]}
                  cachePolicy="memory-disk"
                />
                <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start', minWidth: 0 }}>
                  <Text style={[styles.name, { fontFamily: fontSemi }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.user, { fontFamily: fontMed }]} numberOfLines={1}>
                    @{entry.username}
                  </Text>
                </View>
              </View>

              <View style={[styles.ptsPill, { flexDirection: row }]}>
                <Ionicons name="flash" size={13} color="#C2ABFC" />
                <Text style={[styles.pts, { fontFamily: fontBold }]}>{entry.points}</Text>
              </View>

              <Ionicons
                name={isAr ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color="rgba(255,255,255,0.35)"
              />
            </Pressable>
          );

          if (!tier) return <View key={entry.userId}>{body}</View>;

          return (
            <LinearGradient
              key={entry.userId}
              colors={[...tier.bg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.tierWrap, { borderColor: tier.border }]}
            >
              {body}
            </LinearGradient>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
  head: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
    columnGap: 10,
  },
  headRank: {
    width: 32,
    color: '#7A6A9E',
    fontSize: 11,
    textAlign: 'center',
  },
  headPlayer: {
    flex: 1,
    color: '#7A6A9E',
    fontSize: 11,
  },
  headPts: {
    width: 56,
    color: '#7A6A9E',
    fontSize: 11,
    textAlign: 'center',
  },
  headChevron: {
    width: 16,
  },
  list: {
    gap: 8,
  },
  tierWrap: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    paddingHorizontal: 12,
    columnGap: 10,
  },
  rowPlain: {
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#241152',
  },
  rowMe: {
    borderColor: 'rgba(140,92,245,0.85)',
    backgroundColor: '#140533',
  },
  rankSlot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rankTxt: {
    fontSize: 14,
  },
  person: {
    flex: 1,
    alignItems: 'center',
    columnGap: 10,
    minWidth: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(140,92,245,0.55)',
    backgroundColor: '#1A1028',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  user: {
    color: '#9E8BC9',
    fontSize: 11,
    marginTop: 2,
  },
  ptsPill: {
    minWidth: 56,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
    backgroundColor: 'rgba(140,92,245,0.16)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.35)',
  },
  pts: {
    color: '#E9D5FF',
    fontSize: 15,
  },
});
