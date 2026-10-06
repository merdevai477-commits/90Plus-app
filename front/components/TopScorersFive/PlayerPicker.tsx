/**
 * "خماسي الهدافين" player picker — the grid a pitch card opens.
 *
 * Ported from the 448×925 design frame: a search field over a 3-up grid of
 * 112.48×176.7 player cards (Figma 1302:15248). The picker only browses the
 * league of the pitch card that opened it. The design carries no confirm
 * button, so a tap commits the pick and closes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TSF_LIVE_LEAGUES } from '../../services/topScorersFive.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import {
  TSF_CARD_ART,
  TSF_DESIGN_WIDTH,
  TSF_LEAGUE_LOGO,
  TSF_LOGO_TINT_ON_DARK,
  type TsfLeagueKey,
} from './assets';
import {
  TSF_MOCK_PLAYERS,
  tsfClubInitials,
  tsfInitials,
  tsfShortName,
  type TsfPlayer,
} from './mockData';

const BG = '#030303';
const ACTIVE = '#8C5CF5';
const COLUMNS = 3;

const CARD = { width: 112.48, height: 176.7 };
/** Grid starts 12 below the search field, 21 between columns. */
const GRID = { columnGap: 21, rowGap: 22, top: 12 };
const GRID_WIDTH = CARD.width * COLUMNS + GRID.columnGap * (COLUMNS - 1);
const SEARCH = { height: 44, radius: 12 };

/**
 * Card body ("Vector 28"): its outline in its own 100.1×168.3 box, placed at
 * (5.88, 8.39) on the card and stroked 2 wide on the centre line.
 */
const BODY = { left: 5.876, top: 8.394, width: 100.099, height: 168.301, stroke: 2 };
const BODY_PATH =
  'M41.551 0L25.812 3.148L14.690 11.962L1.679 16.368L0 18.677L0 144.798L2.728 147.316L18.467 153.822L24.763 159.488L50.155 168.301L76.176 159.697L81.003 154.031L98.421 146.896L100.099 144.378L100.099 18.887L98.211 16.368L84.570 11.542L74.078 2.938L58.339 0L49.945 4.407L41.551 0Z';
/** Figma's stroke gradient handles, resolved to the body's bounding box. */
const BODY_STROKE = {
  from: { x: 1.068, y: 0.382 },
  to: { x: -0.28, y: 0.078 },
  stops: [
    [0, '#8814F6'],
    [0.129, '#9242DF'],
    [0.289, '#9551D7'],
    [0.61, '#4B078B'],
    [0.78, '#B376ED'],
    [0.862, '#53168E'],
    [1, '#862CDB'],
  ] as const,
};
/** The black fade over the photo runs from 37% to 74% down the body. */
const BODY_FADE = { from: 0.373, to: 0.736 };
/** Portraits are square head-and-shoulders crops; this frames them like the design's. */
const PHOTO = { left: -6, top: 8, size: 112 };

/** Frame pieces as placed in the design, each box already including its stroke overflow. */
const FRAME = {
  railLeft: { box: { left: 0, top: 11.327, width: 31.904, height: 155.97 }, art: { left: -0.753, top: -0.484, width: 32.9, height: 156.886 } },
  railRight: { box: { left: 80.577, top: 11.538, width: 31.904, height: 155.92 }, art: { left: -0.753, top: -0.484, width: 32.9, height: 156.886 } },
  crown: { left: 45.746, top: 2.173, width: 19.783, height: 16.293 },
  sparkle: { left: 44.4, top: -6.8, width: 22.833, height: 26.611 },
  topBar: { left: 20.37, top: 7.341, width: 70.504, height: 13.645 },
  bottomBar: { left: 24.115, top: 160.77, width: 65.383, height: 16.976 },
};
/** Name + badges block: 113 down, the badge row 11 apart around a 22 rule. */
const INFO = { top: 113, gap: 2, rowGap: 11, league: { width: 19, height: 22 }, club: 20, divider: 22 };

type PlayerPickerProps = {
  league: TsfLeagueKey | null;
  /** Pools loaded from the backend; leagues missing here use the placeholder pool. */
  players?: Partial<Record<TsfLeagueKey, readonly TsfPlayer[]>>;
  selectedId: string | undefined;
  onClose: () => void;
  onPick: (league: TsfLeagueKey, player: TsfPlayer) => void;
};

export function PlayerPicker({
  league,
  players: livePlayers,
  selectedId,
  onClose,
  onPick,
}: PlayerPickerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const pickCopy = copy.pick;
  const isAr = language === 'ar';

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  const [query, setQuery] = useState('');
  useEffect(() => {
    setQuery('');
  }, [league]);

  const pool = useMemo(
    () =>
      league
        ? TSF_LIVE_LEAGUES.includes(league)
          ? livePlayers?.[league] ?? []
          : TSF_MOCK_PLAYERS[league]
        : [],
    [league, livePlayers],
  );

  const rows = useMemo(() => {
    const tokens = searchKey(query).split(' ').filter(Boolean);
    const matches = tokens.length
      ? pool.filter((player) => {
          const haystack = searchKey(
            [player.name, player.nameAr, player.nameEn, player.club].filter(Boolean).join(' '),
          );
          return tokens.every((token) => haystack.includes(token));
        })
      : pool;
    const chunks: TsfPlayer[][] = [];
    for (let index = 0; index < matches.length; index += COLUMNS) {
      chunks.push(matches.slice(index, index + COLUMNS));
    }
    return chunks;
  }, [pool, query]);

  return (
    <Modal
      visible={league != null}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + s(10),
              paddingBottom: s(10),
              paddingLeft: Math.max(insets.left, s(24)),
              paddingRight: Math.max(insets.right, s(24)),
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={pickCopy.close}
            testID="tsf-picker-close"
            style={[styles.headerButton, { width: s(38), height: s(38) }]}
          >
            <Ionicons name="arrow-back" size={s(28)} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { fontFamily: fontSemi, fontSize: s(20) }]}
            numberOfLines={1}
          >
            {copy.title}
          </Text>
          <View style={{ width: s(38) }} />
        </View>

        <View
          style={[
            styles.search,
            {
              width: s(GRID_WIDTH),
              height: s(SEARCH.height),
              borderRadius: s(SEARCH.radius),
              paddingHorizontal: s(14),
              columnGap: s(8),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons name="search" size={s(18)} color="#8C8C8C" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={pickCopy.searchPlaceholder}
            placeholderTextColor="#6E6E6E"
            selectionColor={ACTIVE}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            testID="tsf-picker-search"
            style={[
              styles.searchInput,
              { fontFamily: fontRegular, fontSize: s(15), textAlign: isAr ? 'right' : 'left' },
            ]}
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={pickCopy.searchClear}
            >
              <Ionicons name="close-circle" size={s(18)} color="#8C8C8C" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            // Room for the card's sparkle, which rises above the frame.
            paddingTop: s(GRID.top + 7),
            paddingBottom: Math.max(insets.bottom, 12) + s(12),
            rowGap: s(GRID.rowGap),
          }}
        >
          {rows.length === 0 && query ? (
            <Text style={[styles.empty, { fontFamily: fontRegular, fontSize: s(15), marginTop: s(32) }]}>
              {pickCopy.searchEmpty}
            </Text>
          ) : null}
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[styles.row, { width: s(GRID_WIDTH), columnGap: s(GRID.columnGap) }]}
            >
              {row.map((player) => (
                <PlayerCard
                  key={player.id}
                  league={league as TsfLeagueKey}
                  player={player}
                  selected={player.id === selectedId}
                  fontBold={fontBold}
                  s={s}
                  a11yLabel={[
                    player.name,
                    player.club,
                    pickCopy.goalsA11y.replace('{count}', String(player.goals)),
                    `${pickCopy.assistsA11y.replace('{count}', String(player.assists))} ${pickCopy.seasonA11y}`,
                  ].join('. ')}
                  onPress={() => league && onPick(league, player)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

type PlayerCardProps = {
  league: TsfLeagueKey;
  player: TsfPlayer;
  selected: boolean;
  fontBold: string;
  s: (value: number) => number;
  a11yLabel: string;
  onPress: () => void;
};

/**
 * The design's framed card: purple rails, crown and bars around a body that
 * holds the portrait over light streaks, fading to black under the name and
 * the league · club badges. Season goals and assists sit in the top corners.
 */
function PlayerCard({ league, player, selected, fontBold, s, a11yLabel, onPress }: PlayerCardProps) {
  const ids = useMemo(() => {
    const key = player.id.replace(/[^a-zA-Z0-9_-]/g, '');
    return { clip: `tsf-clip-${key}`, fade: `tsf-fade-${key}`, stroke: `tsf-stroke-${key}` };
  }, [player.id]);
  const box = (b: { left: number; top: number; width: number; height: number }) => ({
    position: 'absolute' as const,
    left: s(b.left),
    top: s(b.top),
    width: s(b.width),
    height: s(b.height),
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
      style={{ width: s(CARD.width), height: s(CARD.height) }}
    >
      <View style={[box(FRAME.railLeft.box), styles.flipX]} pointerEvents="none">
        <Image source={TSF_CARD_ART.railLeft} style={box(FRAME.railLeft.art)} contentFit="fill" />
      </View>
      <View style={box(FRAME.railRight.box)} pointerEvents="none">
        <Image source={TSF_CARD_ART.railRight} style={box(FRAME.railRight.art)} contentFit="fill" />
      </View>
      <Image source={TSF_CARD_ART.crown} style={box(FRAME.crown)} contentFit="fill" />
      <Image source={TSF_CARD_ART.sparkle} style={box(FRAME.sparkle)} contentFit="fill" />

      <Svg
        style={box({
          left: BODY.left - BODY.stroke / 2,
          top: BODY.top - BODY.stroke / 2,
          width: BODY.width + BODY.stroke,
          height: BODY.height + BODY.stroke,
        })}
        viewBox={`${-BODY.stroke / 2} ${-BODY.stroke / 2} ${BODY.width + BODY.stroke} ${BODY.height + BODY.stroke}`}
        pointerEvents="none"
      >
        <Defs>
          <ClipPath id={ids.clip}>
            <Path d={BODY_PATH} />
          </ClipPath>
          <SvgLinearGradient id={ids.fade} x1="0.5" y1={BODY_FADE.from} x2="0.5" y2={BODY_FADE.to}>
            <Stop offset="0" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient
            id={ids.stroke}
            x1={BODY_STROKE.from.x}
            y1={BODY_STROKE.from.y}
            x2={BODY_STROKE.to.x}
            y2={BODY_STROKE.to.y}
          >
            {BODY_STROKE.stops.map(([offset, color]) => (
              <Stop key={offset} offset={offset} stopColor={color} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <G clipPath={`url(#${ids.clip})`}>
          <SvgImage
            href={TSF_CARD_ART.background}
            x={0}
            y={0}
            width={BODY.width}
            height={BODY.height}
            preserveAspectRatio="xMidYMid slice"
          />
          {player.photo ? (
            <SvgImage
              href={{ uri: player.photo }}
              x={PHOTO.left}
              y={PHOTO.top}
              width={PHOTO.size}
              height={PHOTO.size}
              preserveAspectRatio="xMidYMin meet"
            />
          ) : null}
          <Rect x={0} y={0} width={BODY.width} height={BODY.height} fill={`url(#${ids.fade})`} />
        </G>
        <Path d={BODY_PATH} fill="none" stroke={`url(#${ids.stroke})`} strokeWidth={BODY.stroke} />
      </Svg>

      {player.photo ? null : (
        <View style={[box({ left: BODY.left, top: 30, width: BODY.width, height: 70 }), styles.center]}>
          <Text style={[styles.initials, { fontFamily: fontBold, fontSize: s(36) }]} allowFontScaling={false}>
            {tsfInitials(player)}
          </Text>
        </View>
      )}

      <Image source={TSF_CARD_ART.topBar} style={box(FRAME.topBar)} contentFit="fill" />
      <Image source={TSF_CARD_ART.bottomBar} style={box(FRAME.bottomBar)} contentFit="fill" />

      <View style={[styles.corner, { left: s(13), top: s(24) }]} pointerEvents="none">
        <Text style={[styles.cornerValue, { fontFamily: fontBold, fontSize: s(15) }]} allowFontScaling={false}>
          {player.goals}
        </Text>
        <Ionicons name="football" size={s(10)} color="#FFFFFF" />
      </View>
      <View style={[styles.corner, { right: s(13), top: s(24) }]} pointerEvents="none">
        <Text style={[styles.cornerValue, { fontFamily: fontBold, fontSize: s(15) }]} allowFontScaling={false}>
          {player.assists}
        </Text>
        <MaterialCommunityIcons name="shoe-cleat" size={s(10)} color="#FFFFFF" />
      </View>

      <View style={[styles.info, { top: s(INFO.top), left: s(8), right: s(8), rowGap: s(INFO.gap) }]} pointerEvents="none">
        <Text
          style={[styles.name, { fontFamily: fontBold, fontSize: s(15) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.1}
        >
          {tsfShortName(player)}
        </Text>
        <View style={[styles.badges, { columnGap: s(INFO.rowGap), height: s(INFO.divider) }]}>
          <Image
            source={TSF_LEAGUE_LOGO[league]}
            style={{ width: s(INFO.league.width), height: s(INFO.league.height) }}
            contentFit="contain"
            tintColor={TSF_LOGO_TINT_ON_DARK[league]}
          />
          <View style={{ width: 0, height: s(INFO.divider) }}>
            <Image
              source={TSF_CARD_ART.divider}
              style={[
                styles.divider,
                { width: s(INFO.divider), height: 0.5, left: -s(INFO.divider) / 2, top: s(INFO.divider) / 2 },
              ]}
              contentFit="fill"
            />
          </View>
          {player.clubLogo ? (
            <Image
              source={{ uri: player.clubLogo }}
              style={{ width: s(INFO.club), height: s(INFO.club) }}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.clubFallback, { width: s(INFO.club), height: s(INFO.club), borderRadius: s(INFO.club / 2) }]}>
              <Text style={[styles.clubFallbackText, { fontFamily: fontBold, fontSize: s(7) }]} allowFontScaling={false}>
                {tsfClubInitials(player.club)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {selected ? (
        <View
          style={[
            styles.check,
            { width: s(18), height: s(18), borderRadius: s(9), top: s(158), left: s(CARD.width / 2 - 9) },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark" size={s(12)} color="#FFFFFF" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Folds Arabic letter variants, diacritics and Latin accents so either spelling matches. */
function searchKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[-'’.]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#FFFFFF', textAlign: 'center' },

  search: {
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: { flex: 1, color: '#FFFFFF', paddingVertical: 0 },
  empty: { color: '#8C8C8C', textAlign: 'center' },

  row: { flexDirection: 'row', alignSelf: 'center' },

  flipX: { transform: [{ scaleX: -1 }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: 'rgba(255,255,255,0.32)' },

  corner: { position: 'absolute', alignItems: 'center' },
  cornerValue: { color: '#FFFFFF' },

  info: { position: 'absolute', alignItems: 'center' },
  name: { color: '#FFFFFF', textAlign: 'center', alignSelf: 'stretch' },
  badges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  divider: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  clubFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  clubFallbackText: { color: '#FFFFFF' },

  check: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACTIVE,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
