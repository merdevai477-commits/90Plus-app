/**
 * King of Coaches ranking — Share & Win–style rows (readable in light + dark).
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import type { CkBoardRow } from '../../services/coachKing.service';
import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from '../KingOfPredictions/assets';
import UserIdentity from '../identity/UserIdentity';
import { TSF_DESIGN_WIDTH } from '../TopScorersFive/assets';
import { getCoachKingTheme, type CoachKingTheme } from './theme';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

const AVATAR_STROKE = 'rgba(194,194,194,0.92)';
const ROW = { height: 68, radius: 16, gap: 10 };
const RANK_SLOT = { width: 18, gap: 30 };

const MEDAL_BY_RANK: Record<number, { source: number; size: number }> = {
  1: { source: KING_ICON.medal1, size: 32 },
  2: { source: KING_ICON.medal2, size: 30 },
  3: { source: KING_ICON.medal3, size: 28 },
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
  const fontRegular = useAppFont(400);
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getCoachKingTheme(isDark), [isDark]);

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
              fontRegular={fontRegular}
              name={entry.isMe ? youLabel : entry.name}
              xpUnit={xpLabel}
              theme={theme}
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
  fontRegular: string;
  name: string;
  xpUnit: string;
  theme: CoachKingTheme;
  onOpen: (row: CkBoardRow) => void;
};

function BoardRow({
  entry,
  s,
  isAr,
  fontBold,
  fontSemi,
  fontRegular,
  name,
  xpUnit,
  theme,
  onOpen,
}: BoardRowProps) {
  const rank = entry.rank;
  const medal = MEDAL_BY_RANK[rank];
  const isLead = rank <= 3;
  const avatar = isLead ? 38 : 34;
  const nameWeight = rank === 1 ? fontBold : rank <= 3 ? fontSemi : fontRegular;
  const nameSize = rank === 1 ? 18 : rank <= 3 ? 16 : 15;
  const xpSize = rank === 1 ? 20 : 18;
  const identityDirection = isAr ? 'row-reverse' : 'row';
  const whoGap = medal ? 16 : RANK_SLOT.gap;
  const plainGap = !medal && rank >= 10 ? 22 : whoGap;
  const leadBorder = theme.isDark ? 'rgba(245,179,1,0.35)' : 'rgba(106,43,217,0.35)';
  const leadBg = theme.isDark ? theme.cardAlt : theme.pale;
  const mineBg = theme.isDark ? 'rgba(106,43,217,0.28)' : 'rgba(106,43,217,0.12)';

  return (
    <Pressable
      onPress={() => onOpen(entry)}
      testID={`ck-board-${rank}`}
      accessibilityLabel={`${rank}. ${name}. ${entry.points} ${xpUnit}`}
      style={({ pressed }) => [
        styles.row,
        !theme.isDark ? styles.rowLift : null,
        {
          height: s(ROW.height),
          borderRadius: s(ROW.radius),
          paddingHorizontal: s(16),
          flexDirection: isAr ? 'row' : 'row-reverse',
          backgroundColor: entry.isMe ? mineBg : isLead ? leadBg : theme.boardPlainBg,
          borderWidth: entry.isMe ? 1.5 : 1,
          borderColor: entry.isMe ? theme.youRim : isLead ? leadBorder : theme.boardPlainBorder,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.xp, { columnGap: s(2), minWidth: s(64) }]}>
        <Text
          style={{ color: theme.boardXp, fontFamily: fontSemi, fontSize: s(xpSize) }}
          allowFontScaling={false}
        >
          {entry.points}
        </Text>
        <Text
          style={{
            color: theme.boardXpUnit,
            fontFamily: fontSemi,
            fontSize: s(14),
          }}
          allowFontScaling={false}
        >
          {xpUnit}
        </Text>
      </View>

      <View style={[styles.who, { columnGap: s(plainGap), flexDirection: identityDirection }]}>
        {medal ? (
          <Image
            source={medal.source}
            style={{ width: s(medal.size), height: s(medal.size) }}
            contentFit="contain"
          />
        ) : (
          <Text
            style={[
              styles.rankNumber,
              {
                fontFamily: fontRegular,
                fontSize: s(16),
                width: s(RANK_SLOT.width),
                color: theme.boardRank,
              },
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
                width: s(avatar),
                height: s(avatar),
                borderRadius: s(avatar / 2),
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
            <UserIdentity
              user={entry}
              name={name}
              variant="leaderboard"
              nameStyle={[
                styles.name,
                { fontFamily: nameWeight, fontSize: s(nameSize), color: theme.boardName },
              ]}
            />
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
  rowLift: {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  xp: { flexDirection: 'row', alignItems: 'baseline' },
  who: { alignItems: 'center', flexShrink: 1 },
  whoName: { alignItems: 'center', flexShrink: 1 },
  nameWrap: { alignItems: 'center', flexShrink: 1 },
  avatar: { backgroundColor: '#2A2A2A' },
  name: { flexShrink: 1 },
  rankNumber: { textAlign: 'center' },
});
