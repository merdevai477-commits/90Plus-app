/**
 * "خماسي الهدافين" ranking tab — Figma nodes 1288:14458 (empty) and
 * 1288:14284 (with the prize card and the board).
 *
 * The empty state shows until the user's five are complete, which is also the
 * only thing its "اختر الان" button can act on. Ported from the 448×925 design
 * frame and scaled by device width.
 */

import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import { TSF_DESIGN_WIDTH, TSF_PRIZE_SHIRT } from './assets';
import { TSF_MOCK_LEADERBOARD, type TsfLeaderboardRow } from './mockData';
import { TsfHeader } from './TsfHeader';
import { tsfNavBottom } from './TsfNav';

const ACTIVE = '#8C5CF5';
const RULE = '#DBDBDB';
const FILTER_IDLE_BG = '#08080A';
const FILTER_IDLE_STROKE = '#14141A';
const PRIZE_BG = '#150336';
const PRIZE_STROKE = '#1C0F38';
const PRIZE_LABEL = '#E0D4FF';
const PRIZE_SUB = '#ADADAD';
const EMPTY_TEXT = '#858585';
const PLACEHOLDER = '#2A1361';

/** The 87×2 rules either side of the 24 icon, 209 across. */
const RULE_ROW = { lineWidth: 87, lineHeight: 2, icon: 24, gap: 8, width: 209 };
/** Rule row sits 27 under the header in both states; the body 42 under the title. */
const GAP = { rule: 27, title: 8, body: 42 };
const PRIZE = { height: 143, radius: 20 };
const FILTER = { height: 46, radius: 12 };
const ROW = { height: 58, radius: 16, gap: 8 };
/**
 * The design's illustration is a 203.85×159.82 placeholder for art that was
 * never exported. Drawing the shirt we do have at that width and its own
 * 1024×430 ratio keeps the design's footprint without the dead band a taller
 * box would leave above and below it.
 */
const EMPTY_ART = { width: 203.85, height: 203.85 / (1024 / 430) };

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
  nameSize: number;
  avatar: number;
  medal: number;
  medalColor: string;
  opacity?: number;
}[] = [
  {
    bg: 'rgba(235,176,23,0.43)',
    stroke: 'rgba(255,255,255,0.10)',
    xp: '#FCF5DB',
    xpSize: 22,
    nameSize: 20,
    avatar: 38,
    medal: 32,
    medalColor: '#FFD75E',
  },
  {
    bg: 'rgba(122,122,122,0.31)',
    stroke: 'rgba(255,255,255,0.15)',
    xp: '#CFCFCF',
    xpSize: 20,
    nameSize: 18,
    avatar: 36,
    medal: 30,
    medalColor: '#D9D9D9',
    opacity: 0.8,
  },
  {
    bg: 'rgba(212,151,110,0.17)',
    stroke: 'rgba(255,255,255,0.10)',
    xp: '#D4976E',
    xpSize: 18,
    nameSize: 16,
    avatar: 34,
    medal: 28,
    medalColor: '#D4976E',
  },
];

const PLAIN = {
  bg: '#0D0D0D',
  xp: '#EBDBFA',
  xpUnit: '#851CE6',
  xpSize: 18,
  nameSize: 16,
  avatar: 34,
};

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

  const [filter, setFilter] = useState<'all' | 'week'>('week');

  const navClearance = tsfNavBottom(insets.bottom) + s(83 + 16);
  const sidePadding = s((TSF_DESIGN_WIDTH - 404) / 2);

  const heading = (
    <>
      <View
        style={[
          styles.ruleRow,
          { width: s(RULE_ROW.width), columnGap: s(RULE_ROW.gap), marginTop: s(GAP.rule) },
        ]}
      >
        <View
          style={[styles.rule, { width: s(RULE_ROW.lineWidth), height: s(RULE_ROW.lineHeight) }]}
        />
        <Ionicons name="trophy" size={s(RULE_ROW.icon)} color={ACTIVE} />
        <View
          style={[styles.rule, { width: s(RULE_ROW.lineWidth), height: s(RULE_ROW.lineHeight) }]}
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

  const filters = (
    <View style={[styles.filters, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
      {(['all', 'week'] as const).map((key) => {
        const selected = key === filter;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.filter,
              {
                height: s(FILTER.height),
                borderRadius: s(FILTER.radius),
                paddingHorizontal: s(24),
              },
              selected
                ? { backgroundColor: ACTIVE }
                : {
                    backgroundColor: FILTER_IDLE_BG,
                    borderWidth: 0.5,
                    borderColor: FILTER_IDLE_STROKE,
                  },
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                { fontFamily: selected ? fontBold : fontRegular, fontSize: s(16) },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {key === 'all' ? copy.filterAll : copy.filterWeek}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (!complete) {
    return (
      <View style={styles.root}>
        <TsfHeader onBack={onBack} s={s} testID="tsf-ranking-back" />
        <View style={[styles.headingWrap, { paddingHorizontal: sidePadding }]}>{heading}</View>

        <View
          style={[
            styles.emptyBody,
            { paddingHorizontal: sidePadding, paddingBottom: navClearance },
          ]}
        >
          <Image
            source={TSF_PRIZE_SHIRT}
            style={{ width: s(EMPTY_ART.width), height: s(EMPTY_ART.height) }}
            contentFit="contain"
            transition={0}
          />
          <Text
            style={[
              styles.emptyTitle,
              { fontFamily: fontSemi, fontSize: s(16), marginTop: s(20) },
            ]}
          >
            {copy.emptyTitle}
          </Text>
          <TouchableOpacity
            onPress={onPickNow}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="tsf-ranking-pick-now"
            style={[
              styles.emptyCta,
              { height: s(52), borderRadius: s(16), paddingHorizontal: s(23), marginTop: s(12) },
            ]}
          >
            <Text style={[styles.emptyCtaLabel, { fontFamily: fontBold, fontSize: s(16) }]}>
              {copy.emptyCta}
            </Text>
          </TouchableOpacity>
        </View>
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
              paddingVertical: s(20),
              paddingHorizontal: s(16),
              columnGap: s(13),
              flexDirection: isAr ? 'row' : 'row-reverse',
            },
          ]}
        >
          <Image
            source={TSF_PRIZE_SHIRT}
            style={styles.prizeArt}
            contentFit="contain"
            transition={0}
          />
          <View style={styles.prizeText}>
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
  const xpColor = podium ? podium.xp : PLAIN.xp;
  const xpSize = podium ? podium.xpSize : PLAIN.xpSize;
  const nameSize = podium ? podium.nameSize : PLAIN.nameSize;
  const avatar = podium ? podium.avatar : PLAIN.avatar;

  return (
    <View
      accessibilityLabel={`${rankLabel}. ${name}. ${row.xp} ${xpUnit}`}
      style={[
        styles.row,
        {
          height: s(ROW.height),
          borderRadius: s(ROW.radius),
          paddingHorizontal: s(20),
          flexDirection: isAr ? 'row' : 'row-reverse',
        },
        podium
          ? {
              backgroundColor: podium.bg,
              borderWidth: 0.5,
              borderColor: podium.stroke,
              opacity: podium.opacity,
            }
          : { backgroundColor: PLAIN.bg },
        row.isYou ? { borderWidth: 0.5, borderColor: 'rgba(140,92,245,0.69)' } : null,
        rank === 1 ? styles.rowLift : null,
      ]}
    >
      {/* Tally and unit keep their order in both locales; only which side of
          the row they sit on mirrors, which the row itself handles. */}
      <View style={[styles.xp, { columnGap: s(2) }]}>
        <Text
          style={[{ color: xpColor, fontFamily: podium ? fontSemi : fontMedium, fontSize: s(xpSize) }]}
          allowFontScaling={false}
        >
          {row.xp}
        </Text>
        <Text
          style={[
            {
              color: podium ? xpColor : PLAIN.xpUnit,
              fontFamily: fontSemi,
              fontSize: s(16),
            },
          ]}
          allowFontScaling={false}
        >
          {xpUnit}
        </Text>
      </View>

      <View
        style={[styles.who, { columnGap: s(16), flexDirection: isAr ? 'row' : 'row-reverse' }]}
      >
        {podium ? (
          <Ionicons name="medal" size={s(podium.medal)} color={podium.medalColor} />
        ) : (
          <Text
            style={[styles.rankNumber, { fontFamily: fontRegular, fontSize: s(16) }]}
            allowFontScaling={false}
          >
            {rank}
          </Text>
        )}
        <View
          style={[styles.whoName, { columnGap: s(8), flexDirection: isAr ? 'row' : 'row-reverse' }]}
        >
          <View
            style={[
              styles.avatar,
              { width: s(avatar), height: s(avatar), borderRadius: s(avatar / 2) },
            ]}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { fontFamily: podium ? fontBold : fontRegular, fontSize: s(nameSize) },
            ]}
            maxFontSizeMultiplier={1.1}
          >
            {name}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headingWrap: { alignItems: 'center' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rule: { backgroundColor: RULE, borderRadius: 1 },
  title: { color: '#FFFFFF', textAlign: 'center' },

  filters: { justifyContent: 'center', columnGap: 8 },
  filter: { alignItems: 'center', justifyContent: 'center' },
  filterLabel: { color: '#FFFFFF' },

  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: EMPTY_TEXT, textAlign: 'center' },
  emptyCta: { alignItems: 'center', justifyContent: 'center', backgroundColor: ACTIVE },
  emptyCtaLabel: { color: '#FFFFFF' },

  prize: {
    alignItems: 'center',
    backgroundColor: PRIZE_BG,
    borderWidth: 0.5,
    borderColor: PRIZE_STROKE,
    boxShadow: '0px 0px 33.4px rgba(168,84,247,0.16)',
  },
  prizeArt: { flex: 1, height: '100%' },
  prizeText: { flexShrink: 0 },
  prizeLabel: { color: PRIZE_LABEL },
  prizeName: { color: '#FFFFFF' },
  prizeSub: { color: PRIZE_SUB },

  row: { alignItems: 'center', justifyContent: 'space-between' },
  rowLift: { boxShadow: '0px 1px 11.2px rgba(69,5,133,0.25)' },
  xp: { flexDirection: 'row', alignItems: 'baseline' },
  who: { alignItems: 'center' },
  whoName: { alignItems: 'center' },
  avatar: { backgroundColor: PLACEHOLDER, borderWidth: 0.5, borderColor: 'rgba(194,194,194,0.92)' },
  name: { color: '#FFFFFF' },
  rankNumber: { color: '#FFFFFF' },
});
