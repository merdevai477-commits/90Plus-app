/**
 * King of Coaches ranking — Figma 1277:12418 (period tabs + podium rows).
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import type { CkBoardRow } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from '../KingOfPredictions/assets';
import { TSF_DESIGN_WIDTH } from '../TopScorersFive/assets';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

const AVATAR_STROKE = 'rgba(194,194,194,0.92)';
const YOU_RIM = 'rgba(140,92,245,0.69)';
const ROW = { height: 58, radius: 16, gap: 8 };
const RANK_SLOT = { width: 18, gap: 30 };

type Weight = 'bold' | 'semi' | 'medium' | 'regular';

const PODIUM: readonly {
  bg: string;
  xp: string;
  xpSize: number;
  xpWeight: Weight;
  nameSize: number;
  nameWeight: Weight;
  avatar: number;
  medal: number;
  medalSize: number;
  opacity?: number;
  shadow?: boolean;
}[] = [
  {
    bg: 'rgba(235,175,22,0.43)',
    xp: '#FDF4DC',
    xpSize: 22,
    xpWeight: 'semi',
    nameSize: 20,
    nameWeight: 'bold',
    avatar: 38,
    medal: KING_ICON.medal1,
    medalSize: 32,
    shadow: true,
  },
  {
    bg: 'rgba(123,123,123,0.31)',
    xp: '#CECECE',
    xpSize: 20,
    xpWeight: 'medium',
    nameSize: 18,
    nameWeight: 'semi',
    avatar: 36,
    medal: KING_ICON.medal2,
    medalSize: 30,
    opacity: 0.8,
  },
  {
    bg: 'rgba(211,151,110,0.17)',
    xp: '#D3976E',
    xpSize: 18,
    xpWeight: 'medium',
    nameSize: 16,
    nameWeight: 'semi',
    avatar: 34,
    medal: KING_ICON.medal3,
    medalSize: 28,
  },
];

const PLAIN = {
  bg: '#0D0D0D',
  xp: '#EBDCFA',
  xpUnit: '#831DE5',
  xpSize: 18,
  xpWeight: 'medium' as const,
  nameSize: 16,
  nameWeight: 'regular' as const,
  avatar: 34,
};

type Props = {
  entries: CkBoardRow[];
  isAr: boolean;
  youLabel: string;
  xpLabel: string;
  periodTabs: ReactNode;
  empty?: ReactNode;
  onOpen: (row: CkBoardRow) => void;
};

export function CoachKingBoard({ entries, isAr, youLabel, xpLabel, periodTabs, empty, onOpen }: Props) {
  const { width } = useWindowDimensions();
  const s = (value: number) => (width / TSF_DESIGN_WIDTH) * value;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const fontRegular = useAppFont(400);

  return (
    <View style={styles.root}>
      {periodTabs}

      {entries.length === 0 ? (
        <View style={{ marginTop: s(24), alignItems: 'center' }}>{empty}</View>
      ) : (
        <View style={{ marginTop: s(19), rowGap: s(ROW.gap) }}>
          {entries.map((entry) => (
            <BoardRow
              key={entry.userId}
              entry={entry}
              s={s}
              isAr={isAr}
              fontBold={fontBold}
              fontSemi={fontSemi}
              fontMedium={fontMed}
              fontRegular={fontRegular}
              name={entry.isMe ? youLabel : entry.name}
              xpUnit={xpLabel}
              onOpen={onOpen}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type BoardRowProps = {
  entry: CkBoardRow;
  s: (value: number) => number;
  isAr: boolean;
  fontBold: string;
  fontSemi: string;
  fontMedium: string;
  fontRegular: string;
  name: string;
  xpUnit: string;
  onOpen: (row: CkBoardRow) => void;
};

function BoardRow({
  entry,
  s,
  isAr,
  fontBold,
  fontSemi,
  fontMedium,
  fontRegular,
  name,
  xpUnit,
  onOpen,
}: BoardRowProps) {
  const rank = entry.rank;
  const podium = PODIUM[rank - 1];
  const look = podium ?? PLAIN;
  const font: Record<Weight, string> = {
    bold: fontBold,
    semi: fontSemi,
    medium: fontMedium,
    regular: fontRegular,
  };
  const identityDirection = isAr ? 'row-reverse' : 'row';
  /** Plain rows use a wider gap between the rank digit and the avatar (Figma: 30). */
  const whoGap = podium ? 16 : RANK_SLOT.gap;
  /** Two-digit ranks sit a touch closer so avatars stay in one column (Figma: 22 for "10"). */
  const plainGap = !podium && rank >= 10 ? 22 : whoGap;

  return (
    <Pressable
      onPress={() => onOpen(entry)}
      testID={`ck-board-${rank}`}
      accessibilityLabel={`${rank}. ${name}. ${entry.points} ${xpUnit}`}
      style={({ pressed }) => [
        styles.row,
        {
          height: s(ROW.height),
          borderRadius: s(ROW.radius),
          paddingHorizontal: s(20),
          flexDirection: isAr ? 'row' : 'row-reverse',
          backgroundColor: look.bg,
          opacity: pressed ? 0.88 : podium?.opacity ?? 1,
        },
        entry.isMe ? { borderWidth: 0.5, borderColor: YOU_RIM } : null,
        podium?.shadow ? styles.rowLift : null,
      ]}
    >
      <View style={[styles.xp, { columnGap: s(2) }]}>
        <Text
          style={{ color: look.xp, fontFamily: font[look.xpWeight], fontSize: s(look.xpSize) }}
          allowFontScaling={false}
        >
          {entry.points}
        </Text>
        <Text
          style={{
            color: podium ? podium.xp : PLAIN.xpUnit,
            fontFamily: fontSemi,
            fontSize: s(16),
          }}
          allowFontScaling={false}
        >
          {xpUnit}
        </Text>
      </View>

      <View style={[styles.who, { columnGap: s(plainGap), flexDirection: identityDirection }]}>
        {podium ? (
          <Image
            source={podium.medal}
            style={{ width: s(podium.medalSize), height: s(podium.medalSize) }}
            contentFit="contain"
          />
        ) : (
          <Text
            style={[
              styles.rankNumber,
              { fontFamily: fontRegular, fontSize: s(16), width: s(RANK_SLOT.width) },
            ]}
            allowFontScaling={false}
          >
            {rank}
          </Text>
        )}

        <View style={[styles.whoName, { columnGap: s(8), flexDirection: identityDirection }]}>
          <Image
            source={entry.avatar ? { uri: entry.avatar } : PLACEHOLDER}
            placeholder={PLACEHOLDER}
            style={[
              styles.avatar,
              {
                width: s(look.avatar),
                height: s(look.avatar),
                borderRadius: s(look.avatar / 2),
              },
              entry.isMe ? null : { borderWidth: 0.5, borderColor: AVATAR_STROKE },
            ]}
            contentFit="cover"
            transition={0}
          />
          <View
            style={[
              styles.nameWrap,
              { columnGap: s(4), flexDirection: isAr ? 'row' : 'row-reverse' },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.name, { fontFamily: font[look.nameWeight], fontSize: s(look.nameSize) }]}
              maxFontSizeMultiplier={1.1}
            >
              {name}
            </Text>
            {entry.isMe ? (
              <Image source={KING_ICON.user} style={{ width: s(16), height: s(16) }} contentFit="contain" />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  row: { alignItems: 'center', justifyContent: 'space-between' },
  rowLift: { boxShadow: '0px 1px 5.6px rgba(70,5,132,0.25)' },
  xp: { flexDirection: 'row', alignItems: 'baseline' },
  who: { alignItems: 'center', flexShrink: 1 },
  whoName: { alignItems: 'center', flexShrink: 1 },
  nameWrap: { alignItems: 'center', flexShrink: 1 },
  avatar: { backgroundColor: '#2A2A2A' },
  name: { color: '#FFFFFF', flexShrink: 1 },
  rankNumber: { color: '#FFFFFF', textAlign: 'center' },
});
