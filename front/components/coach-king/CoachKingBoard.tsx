/**
 * King of Coaches ranking — same prize card and podium rows as Top Scorers Five.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkBoardRow } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from '../KingOfPredictions/assets';
import { TSF_DESIGN_WIDTH, TSF_PRIZE_SHIRT } from '../TopScorersFive/assets';

const PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

const RULE_FADE = ['rgba(219,219,219,0)', '#DBDBDB'] as const;
const PRIZE_BG = '#150336';
const PRIZE_STROKE = '#1C0F38';
const PRIZE_LABEL = '#E0D4FF';
const PRIZE_SUB = '#ADADAD';
const AVATAR_STROKE = 'rgba(194,194,194,0.92)';
const YOU_RIM = 'rgba(140,92,245,0.69)';

const RULE_ROW = { lineWidth: 87, lineHeight: 2, icon: 24, gap: 8, width: 209 };
const PRIZE = { height: 143, radius: 20, textInset: 29 };
const ROW = { height: 58, radius: 16, gap: 8 };
const RANK_SLOT = { width: 18, gap: 26 };

type Weight = 'bold' | 'semi' | 'medium' | 'regular';

const PODIUM: readonly {
  bg: string;
  stroke: string;
  xp: string;
  xpSize: number;
  xpWeight: Weight;
  nameSize: number;
  nameWeight: Weight;
  avatar: number;
  medal: number;
  medalSize: number;
  opacity?: number;
}[] = [
  {
    bg: 'rgba(235,176,23,0.43)',
    stroke: 'rgba(255,255,255,0.10)',
    xp: '#FCF5DB',
    xpSize: 22,
    xpWeight: 'semi',
    nameSize: 20,
    nameWeight: 'bold',
    avatar: 38,
    medal: KING_ICON.medal1,
    medalSize: 32,
  },
  {
    bg: 'rgba(122,122,122,0.31)',
    stroke: 'rgba(255,255,255,0.15)',
    xp: '#CFCFCF',
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
    bg: 'rgba(212,151,110,0.17)',
    stroke: 'rgba(255,255,255,0.10)',
    xp: '#D4976E',
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
  xp: '#EBDBFA',
  xpUnit: '#851CE6',
  xpSize: 18,
  xpWeight: 'medium' as const,
  nameSize: 16,
  nameWeight: 'regular' as const,
  avatar: 34,
};

type PrizeCopy = {
  title: string;
  prizeLabel: string;
  prizeName: string;
  prizeSubtitle: string;
  you: string;
  xp: string;
};

type Props = {
  entries: CkBoardRow[];
  isAr: boolean;
  copy: PrizeCopy;
  periodTabs: ReactNode;
  empty?: ReactNode;
  onOpen: (row: CkBoardRow) => void;
};

export function CoachKingBoard({ entries, isAr, copy, periodTabs, empty, onOpen }: Props) {
  const { width } = useWindowDimensions();
  const s = (value: number) => (width / TSF_DESIGN_WIDTH) * value;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const fontRegular = useAppFont(400);
  const ruleSize = { width: s(RULE_ROW.lineWidth), height: s(RULE_ROW.lineHeight) };

  return (
    <View style={styles.root}>
      <View style={styles.headingWrap}>
        <View
          style={[
            styles.ruleRow,
            { width: s(RULE_ROW.width), columnGap: s(RULE_ROW.gap), marginTop: s(12) },
          ]}
        >
          <LinearGradient colors={RULE_FADE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.rule, ruleSize]} />
          <Ionicons name="football" size={s(RULE_ROW.icon)} color="#FFFFFF" />
          <LinearGradient colors={RULE_FADE} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={[styles.rule, ruleSize]} />
        </View>
        <Text
          style={[styles.title, { fontFamily: fontBold, fontSize: s(28), marginTop: s(8) }]}
          maxFontSizeMultiplier={1.15}
        >
          {copy.title}
        </Text>
      </View>

      <View
        style={[
          styles.prize,
          {
            height: s(PRIZE.height),
            borderRadius: s(PRIZE.radius),
            marginTop: s(24),
            alignItems: isAr ? 'flex-end' : 'flex-start',
            [isAr ? 'paddingRight' : 'paddingLeft']: s(PRIZE.textInset),
          },
        ]}
      >
        <Image
          source={TSF_PRIZE_SHIRT}
          style={[StyleSheet.absoluteFill, { borderRadius: s(PRIZE.radius) }]}
          contentFit="cover"
          transition={0}
        />
        <View>
          <Text
            style={[styles.prizeLabel, { fontFamily: fontMed, fontSize: s(11), textAlign: isAr ? 'right' : 'left' }]}
            maxFontSizeMultiplier={1.1}
          >
            {copy.prizeLabel}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.prizeName,
              { fontFamily: fontBold, fontSize: s(24), marginTop: s(2), textAlign: isAr ? 'right' : 'left' },
            ]}
            maxFontSizeMultiplier={1.1}
          >
            {copy.prizeName}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.prizeSub,
              { fontFamily: fontMed, fontSize: s(16), marginTop: s(4), textAlign: isAr ? 'right' : 'left' },
            ]}
            maxFontSizeMultiplier={1.1}
          >
            {copy.prizeSubtitle}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: s(16) }}>{periodTabs}</View>

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
              name={entry.isMe ? copy.you : entry.name}
              xpUnit={copy.xp}
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
          columnGap: s(12),
          flexDirection: isAr ? 'row' : 'row-reverse',
          backgroundColor: look.bg,
          opacity: pressed ? 0.88 : podium?.opacity ?? 1,
        },
        podium ? { borderWidth: 0.5, borderColor: podium.stroke } : null,
        entry.isMe ? { borderWidth: 0.5, borderColor: YOU_RIM } : null,
        rank === 1 ? styles.rowLift : null,
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

      <View
        style={[
          styles.who,
          {
            columnGap: s(podium ? 16 : RANK_SLOT.gap),
            flexDirection: identityDirection,
          },
        ]}
      >
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
              style={[
                styles.name,
                { fontFamily: font[look.nameWeight], fontSize: s(look.nameSize) },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {name}
            </Text>
            {entry.isMe ? (
              <Image
                source={KING_ICON.user}
                style={{ width: s(16), height: s(16) }}
                contentFit="contain"
              />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  headingWrap: { alignItems: 'center' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rule: { borderRadius: 1 },
  title: { color: '#FFFFFF', textAlign: 'center' },
  prize: {
    justifyContent: 'center',
    backgroundColor: PRIZE_BG,
    borderWidth: 0.5,
    borderColor: PRIZE_STROKE,
    boxShadow: '0px 0px 33.4px rgba(168,84,247,0.16)',
  },
  prizeLabel: { color: PRIZE_LABEL },
  prizeName: { color: '#FFFFFF' },
  prizeSub: { color: PRIZE_SUB },
  row: { alignItems: 'center', justifyContent: 'space-between' },
  rowLift: { boxShadow: '0px 1px 11.2px rgba(69,5,133,0.25)' },
  xp: { flexDirection: 'row', alignItems: 'baseline' },
  who: { alignItems: 'center', flexShrink: 1 },
  whoName: { alignItems: 'center', flexShrink: 1 },
  nameWrap: { alignItems: 'center', flexShrink: 1 },
  avatar: { backgroundColor: '#2A2A2A' },
  name: { color: '#FFFFFF', flexShrink: 1 },
  rankNumber: { color: '#FFFFFF', textAlign: 'center' },
});
