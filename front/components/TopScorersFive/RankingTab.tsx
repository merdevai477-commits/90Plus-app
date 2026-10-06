/**
 * "خماسي الهدافين" ranking tab — Figma nodes 1288:14458 (empty) and
 * 1288:14284 (with the prize card and the board).
 *
 * The empty state shows until the user's five are complete, which is also the
 * only thing its "اختر الان" button can act on. Ported from the 448×925 design
 * frame and scaled by device width.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KingPeriod } from '../../services/predictions.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KING_ICON } from '../KingOfPredictions/assets';
import { KingEmptyState, KingPeriodTabs } from '../KingOfPredictions/KingBoardList';

import { TSF_DESIGN_WIDTH, TSF_PRIZE_SHIRT } from './assets';
import { TSF_MOCK_LEADERBOARD, type TsfLeaderboardRow } from './mockData';
import { TsfHeader } from './TsfHeader';
import { tsfNavBottom } from './TsfNav';

const AVATAR_PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

/** Each rule fades out away from the ball, so the outer ends dissolve into the page. */
const RULE_FADE = ['rgba(219,219,219,0)', '#DBDBDB'] as const;
const PRIZE_BG = '#150336';
const PRIZE_STROKE = '#1C0F38';
const PRIZE_LABEL = '#E0D4FF';
const PRIZE_SUB = '#ADADAD';
const AVATAR_STROKE = 'rgba(194,194,194,0.92)';
const YOU_RIM = 'rgba(140,92,245,0.69)';

/** The 87×2 rules either side of the 24 icon, 209 across. */
const RULE_ROW = { lineWidth: 87, lineHeight: 2, icon: 24, gap: 8, width: 209 };
/** Rule row sits 27 under the header in both states; the body 42 under the title. */
const GAP = { rule: 27, title: 8, body: 42 };
/** The text block sits 29 in from the card's trailing edge, over the art. */
const PRIZE = { height: 143, radius: 20, textInset: 29 };
const ROW = { height: 58, radius: 16, gap: 8 };
/**
 * Plain rows sit their rank 30 from the avatar, and the design narrows that to
 * 22 for "10" so the avatars stay in one column. A fixed slot does the same for
 * any number of digits.
 */
const RANK_SLOT = { width: 18, gap: 26 };

type Weight = 'bold' | 'semi' | 'medium' | 'regular';

/**
 * Podium dressing by position. The design's third row is also the signed-in
 * user's, which is why it carries a purple rim — that rim belongs to "you"
 * rather than to third place, so the two are kept apart here.
 */
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
  xpWeight: 'medium',
  nameSize: 16,
  nameWeight: 'regular',
  avatar: 34,
} as const;

type RankingTabProps = {
  complete: boolean;
  onBack: () => void;
  onPickNow: () => void;
};

export function RankingTab({ complete, onBack, onPickNow }: RankingTabProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive.ranking;
  const isAr = language === 'ar';

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);
  const fontRegular = useAppFont(400);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = (value: number) => value * scale;

  const [filter, setFilter] = useState<KingPeriod>('week');

  const navClearance = tsfNavBottom(insets.bottom) + s(83 + 16);
  const sidePadding = s((TSF_DESIGN_WIDTH - 404) / 2);
  const ruleSize = { width: s(RULE_ROW.lineWidth), height: s(RULE_ROW.lineHeight) };

  const heading = (
    <>
      <View
        style={[
          styles.ruleRow,
          { width: s(RULE_ROW.width), columnGap: s(RULE_ROW.gap), marginTop: s(GAP.rule) },
        ]}
      >
        <LinearGradient
          colors={RULE_FADE}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rule, ruleSize]}
        />
        <Ionicons name="football" size={s(RULE_ROW.icon)} color="#FFFFFF" />
        <LinearGradient
          colors={RULE_FADE}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 0 }}
          style={[styles.rule, ruleSize]}
        />
      </View>
      <Text
        style={[styles.title, { fontFamily: fontBold, fontSize: s(28), marginTop: s(GAP.title) }]}
        maxFontSizeMultiplier={1.15}
      >
        {copy.title}
      </Text>
    </>
  );

  /**
   * Same segmented control, empty illustration and gradient button as King of
   * Predictions' leaderboard — the two competitions share these in the design.
   */
  const filters = (
    <KingPeriodTabs
      period={filter}
      allLabel={copy.filterAll}
      weekLabel={copy.filterWeek}
      onChange={setFilter}
    />
  );

  if (!complete) {
    return (
      <View style={styles.root}>
        <TsfHeader onBack={onBack} s={s} testID="tsf-ranking-back" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: sidePadding,
            paddingBottom: navClearance,
          }}
        >
          <View style={styles.headingWrap}>{heading}</View>
          <View style={{ marginTop: s(GAP.body) }}>{filters}</View>
          <View style={[styles.emptyBody, { paddingVertical: s(24) }]}>
            <KingEmptyState
              title={copy.emptyTitle}
              actionLabel={copy.emptyCta}
              onAction={onPickNow}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TsfHeader onBack={onBack} s={s} testID="tsf-ranking-back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: sidePadding,
          paddingBottom: navClearance,
        }}
      >
        <View style={styles.headingWrap}>{heading}</View>

        <View
          style={[
            styles.prize,
            {
              height: s(PRIZE.height),
              borderRadius: s(PRIZE.radius),
              marginTop: s(GAP.body),
              alignItems: isAr ? 'flex-end' : 'flex-start',
              [isAr ? 'paddingRight' : 'paddingLeft']: s(PRIZE.textInset),
            },
          ]}
        >
          {/* Rounded on the image rather than clipped on the card, so the
              card's glow is not cut off with it. */}
          <Image
            source={TSF_PRIZE_SHIRT}
            style={[StyleSheet.absoluteFill, { borderRadius: s(PRIZE.radius) }]}
            contentFit="cover"
            transition={0}
          />
          <View>
            <Text
              style={[
                styles.prizeLabel,
                { fontFamily: fontMedium, fontSize: s(11), textAlign: isAr ? 'right' : 'left' },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {copy.prizeLabel}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.prizeName,
                {
                  fontFamily: fontBold,
                  fontSize: s(24),
                  marginTop: s(2),
                  textAlign: isAr ? 'right' : 'left',
                },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {copy.prizeName}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.prizeSub,
                {
                  fontFamily: fontMedium,
                  fontSize: s(16),
                  marginTop: s(4),
                  textAlign: isAr ? 'right' : 'left',
                },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {copy.prizeSubtitle}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: s(16) }}>{filters}</View>

        <View style={{ marginTop: s(19), rowGap: s(ROW.gap) }}>
          {TSF_MOCK_LEADERBOARD.map((row, index) => (
            <BoardRow
              key={row.id}
              row={row}
              rank={index + 1}
              s={s}
              isAr={isAr}
              fontBold={fontBold}
              fontSemi={fontSemi}
              fontMedium={fontMedium}
              fontRegular={fontRegular}
              name={row.isYou ? copy.you : row.name}
              xpUnit={copy.xp}
              rankLabel={copy.rankA11y.replace('{rank}', String(index + 1))}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type BoardRowProps = {
  row: TsfLeaderboardRow;
  rank: number;
  s: (value: number) => number;
  isAr: boolean;
  fontBold: string;
  fontSemi: string;
  fontMedium: string;
  fontRegular: string;
  name: string;
  xpUnit: string;
  rankLabel: string;
};

function BoardRow({
  row,
  rank,
  s,
  isAr,
  fontBold,
  fontSemi,
  fontMedium,
  fontRegular,
  name,
  xpUnit,
  rankLabel,
}: BoardRowProps) {
  const podium = PODIUM[rank - 1];
  const look = podium ?? PLAIN;
  const font: Record<Weight, string> = {
    bold: fontBold,
    semi: fontSemi,
    medium: fontMedium,
    regular: fontRegular,
  };
  /*
   * Layout is LTR in every language, so Arabic reverses the identity group to
   * read name · avatar · medal towards the right edge, as the design does.
   */
  const identityDirection = isAr ? 'row-reverse' : 'row';

  return (
    <View
      accessibilityLabel={`${rankLabel}. ${name}. ${row.xp} ${xpUnit}`}
      style={[
        styles.row,
        {
          height: s(ROW.height),
          borderRadius: s(ROW.radius),
          paddingHorizontal: s(20),
          columnGap: s(12),
          flexDirection: isAr ? 'row' : 'row-reverse',
          backgroundColor: look.bg,
        },
        podium
          ? { borderWidth: 0.5, borderColor: podium.stroke, opacity: podium.opacity }
          : null,
        row.isYou ? { borderWidth: 0.5, borderColor: YOU_RIM } : null,
        rank === 1 ? styles.rowLift : null,
      ]}
    >
      {/* Tally and unit keep their order in both locales; only which side of
          the row they sit on mirrors, which the row itself handles. */}
      <View style={[styles.xp, { columnGap: s(2) }]}>
        <Text
          style={{ color: look.xp, fontFamily: font[look.xpWeight], fontSize: s(look.xpSize) }}
          allowFontScaling={false}
        >
          {row.xp}
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
            source={AVATAR_PLACEHOLDER}
            style={[
              styles.avatar,
              {
                width: s(look.avatar),
                height: s(look.avatar),
                borderRadius: s(look.avatar / 2),
              },
              row.isYou ? null : { borderWidth: 0.5, borderColor: AVATAR_STROKE },
            ]}
            contentFit="cover"
            transition={0}
          />
          {/* The "you" mark sits between the name and the avatar. */}
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
            {row.isYou ? (
              <Image
                source={KING_ICON.user}
                style={{ width: s(16), height: s(16) }}
                contentFit="contain"
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headingWrap: { alignItems: 'center' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rule: { borderRadius: 1 },
  title: { color: '#FFFFFF', textAlign: 'center' },

  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
