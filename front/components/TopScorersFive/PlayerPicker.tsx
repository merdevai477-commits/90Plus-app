/**
 * "خماسي الهدافين" player picker — the grid a pitch card opens.
 *
 * Ported from the 448×925 design frame: a 3-up grid of 112.48×176.7 player
 * tiles sitting over a league switcher. The design carries no confirm button,
 * so a tap commits the pick and closes, and the switcher swaps the league being
 * browsed without leaving the screen.
 */

import { useCallback, useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import {
  TSF_DESIGN_WIDTH,
  TSF_LEAGUE_LOGO,
  TSF_LIGUE1_CREST_ASPECT,
  TSF_LOGO_TINT_ON_DARK,
  type TsfLeagueKey,
} from './assets';
import { TSF_MOCK_PLAYERS, tsfInitials, tsfShortName, type TsfPlayer } from './mockData';

const BG = '#030303';
const ACTIVE = '#8C5CF5';
const COLUMNS = 3;

/** Design has no radius on the tile; 12 matches the rest of the feature. */
const CARD = { width: 112.48, height: 176.7, radius: 12 };
/** Grid starts 12 below the 128-tall header block, 21 between columns. */
const GRID = { columnGap: 21, rowGap: 16, top: 12 };
/**
 * The name/stats block is 61 wide at x 25 inside a 112.48 tile, leaving 26.5 on
 * the far side — centred, not leading — and its baseline sits 21.7 off the
 * bottom edge. The design's 22 divider matches its 22 icons; ours are 13, so the
 * rule is cut to suit or it towers over the figures it separates.
 */
const CARD_TEXT = { bottom: 21.7, iconSize: 13, dividerHeight: 14 };

const CHIP = { width: 77, height: 93, radius: 10, gap: 4 };
/** Logo box per league inside a chip, straight off the design. */
const CHIP_LOGO: Record<TsfLeagueKey, { width: number; height: number; anchorTop?: boolean }> = {
  pl: { width: 49, height: 81 },
  laliga: { width: 57, height: 43.7 },
  bundesliga: { width: 67, height: 67 },
  // Design draws this box 49 square; narrowing it to the sponsor-free crest's
  // ratio is what crops Ligue 1's McDonald's band off the foot of the asset.
  ligue1: { width: 49 * TSF_LIGUE1_CREST_ASPECT, height: 49, anchorTop: true },
  seriea: { width: 50, height: 85 },
};
/** Bundesliga is the one chip whose unselected fill is tinted rather than white. */
const CHIP_TINT: Partial<Record<TsfLeagueKey, string>> = { bundesliga: '#D10314' };

/** Reads right→left in the Arabic design, so the row is reversed for it. */
const LEAGUE_ORDER: readonly TsfLeagueKey[] = ['pl', 'laliga', 'bundesliga', 'ligue1', 'seriea'];

type PlayerPickerProps = {
  league: TsfLeagueKey | null;
  selectedId: string | undefined;
  onClose: () => void;
  onChangeLeague: (league: TsfLeagueKey) => void;
  onPick: (league: TsfLeagueKey, player: TsfPlayer) => void;
};

export function PlayerPicker({
  league,
  selectedId,
  onClose,
  onChangeLeague,
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

  const scale = width / TSF_DESIGN_WIDTH;
  const s = useCallback((value: number) => value * scale, [scale]);

  const rows = useMemo(() => {
    const players = league ? TSF_MOCK_PLAYERS[league] : [];
    const chunks: TsfPlayer[][] = [];
    for (let index = 0; index < players.length; index += COLUMNS) {
      chunks.push(players.slice(index, index + COLUMNS));
    }
    return chunks;
  }, [league]);

  const chips = useMemo(
    () => (isAr ? [...LEAGUE_ORDER].reverse() : LEAGUE_ORDER),
    [isAr],
  );

  const switcherBottom = Math.max(insets.bottom, 12) + 8;

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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: s(GRID.top),
            paddingBottom: switcherBottom + s(CHIP.height) + s(24),
            rowGap: s(GRID.rowGap),
          }}
        >
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[styles.row, { columnGap: s(GRID.columnGap) }]}
            >
              {row.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  selected={player.id === selectedId}
                  fontBold={fontBold}
                  s={s}
                  goalsLabel={pickCopy.goalsA11y.replace('{count}', String(player.goals))}
                  assistsLabel={pickCopy.assistsA11y.replace('{count}', String(player.assists))}
                  onPress={() => league && onPick(league, player)}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={[styles.switcher, { bottom: switcherBottom, columnGap: s(CHIP.gap) }]}
        >
          {chips.map((key) => {
            const active = key === league;
            const logo = CHIP_LOGO[key];
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onChangeLeague(key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={pickCopy.selectLeagueA11y.replace(
                  '{league}',
                  pickCopy.leagues[key],
                )}
                style={[
                  styles.chip,
                  {
                    width: s(CHIP.width),
                    height: s(CHIP.height),
                    borderRadius: s(CHIP.radius),
                    backgroundColor: active
                      ? ACTIVE
                      : withAlpha(CHIP_TINT[key] ?? '#FFFFFF', 0.05),
                  },
                ]}
              >
                <Image
                  source={TSF_LEAGUE_LOGO[key]}
                  style={{ width: s(logo.width), height: s(logo.height) }}
                  contentFit={logo.anchorTop ? 'cover' : 'contain'}
                  contentPosition={logo.anchorTop ? 'top' : 'center'}
                  tintColor={TSF_LOGO_TINT_ON_DARK[key]}
                  transition={0}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

type PlayerCardProps = {
  player: TsfPlayer;
  selected: boolean;
  fontBold: string;
  s: (value: number) => number;
  goalsLabel: string;
  assistsLabel: string;
  onPress: () => void;
};

/**
 * Tile is mostly the player's portrait with the name and tallies over a scrim.
 * No portraits ship yet, so initials stand in behind the same scrim.
 */
function PlayerCard({
  player,
  selected,
  fontBold,
  s,
  goalsLabel,
  assistsLabel,
  onPress,
}: PlayerCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${player.name}. ${goalsLabel}. ${assistsLabel}`}
      style={[
        styles.card,
        {
          width: s(CARD.width),
          height: s(CARD.height),
          borderRadius: s(CARD.radius),
        },
        selected ? { borderWidth: 1.5, borderColor: ACTIVE } : null,
      ]}
    >
      <LinearGradient
        colors={['#2A1361', '#140832']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text
        style={[styles.initials, { fontFamily: fontBold, fontSize: s(40) }]}
        allowFontScaling={false}
      >
        {tsfInitials(player)}
      </Text>
      <LinearGradient
        colors={['rgba(3,3,3,0)', 'rgba(3,3,3,0.55)', 'rgba(3,3,3,0.92)']}
        locations={[0, 0.45, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />

      <View style={[styles.cardText, { bottom: s(CARD_TEXT.bottom) }]}>
        <Text
          style={[styles.cardName, { fontFamily: fontBold, fontSize: s(15) }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.1}
        >
          {tsfShortName(player)}
        </Text>
        <View style={[styles.stats, { marginTop: s(2), columnGap: s(8) }]}>
          <View style={[styles.stat, { columnGap: s(3) }]}>
            <Ionicons name="football" size={s(CARD_TEXT.iconSize)} color="#FFFFFF" />
            <Text
              style={[styles.statValue, { fontFamily: fontBold, fontSize: s(12) }]}
              allowFontScaling={false}
            >
              {player.goals}
            </Text>
          </View>
          <View style={[styles.divider, { height: s(CARD_TEXT.dividerHeight) }]} />
          <View style={[styles.stat, { columnGap: s(3) }]}>
            <MaterialCommunityIcons
              name="shoe-cleat"
              size={s(CARD_TEXT.iconSize)}
              color="#FFFFFF"
            />
            <Text
              style={[styles.statValue, { fontFamily: fontBold, fontSize: s(12) }]}
              allowFontScaling={false}
            >
              {player.assists}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** `#RRGGBB` plus an alpha, for the chips' 5% fills. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#FFFFFF', textAlign: 'center' },

  row: { flexDirection: 'row', justifyContent: 'center' },

  card: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { color: 'rgba(255,255,255,0.32)' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  cardText: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  cardName: { color: '#FFFFFF', textAlign: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flexDirection: 'row', alignItems: 'center' },
  statValue: { color: '#FFFFFF' },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.4)' },

  switcher: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  chip: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
