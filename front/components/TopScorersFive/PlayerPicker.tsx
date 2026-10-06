/**
 * "خماسي الهدافين" player picker — the grid a pitch card opens.
 *
 * Ported from the 448×925 design frame: a search field over a 3-up grid of
 * 112.48×176.7 player cards (Figma 1302:15248). The picker only browses the
 * league of the pitch card that opened it. A tap only proposes the player: the
 * confirmation sheet shows his card again, and confirming there is final for
 * the gameweek.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TSF_LIVE_LEAGUES } from '../../services/topScorersFive.service';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import {
  TSF_CARD_ART,
  TSF_CARD_ART_BOX,
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
 * The photo window: the card body's straight-sided span (the body sits at
 * 5.88, 8.39, 100.1 wide). Portraits are transparent square head-and-shoulders
 * cut-outs, framed slightly wider than the body like the design's.
 */
const PHOTO_WINDOW = { left: 5.876, top: 8.394, width: 100.099, height: 130 };
const PHOTO = { left: -6, top: 8, size: 112 };
/** Name + badges block: 113 down, the badge row 11 apart around a 22 rule. */
const INFO = { top: 113, gap: 2, rowGap: 11, league: { width: 19, height: 22 }, club: 20, divider: 22 };

type Box = { left: number; top: number; width: number; height: number };

type PlayerPickerProps = {
  league: TsfLeagueKey | null;
  /** Hides the picker without losing its state, e.g. while a player profile is open on top. */
  hidden?: boolean;
  /** Pools loaded from the backend; leagues missing here use the placeholder pool. */
  players?: Partial<Record<TsfLeagueKey, readonly TsfPlayer[]>>;
  selectedId: string | undefined;
  onClose: () => void;
  onPick: (league: TsfLeagueKey, player: TsfPlayer) => void;
  /** The tapped player awaiting confirmation. */
  pending?: TsfPlayer | null;
  confirming?: boolean;
  onConfirm?: () => void;
  onCancelPending?: () => void;
  onViewProfile?: (player: TsfPlayer) => void;
};

export function PlayerPicker({
  league,
  hidden = false,
  players: livePlayers,
  selectedId,
  onClose,
  onPick,
  pending = null,
  confirming = false,
  onConfirm,
  onCancelPending,
  onViewProfile,
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
  /**
   * The grid mounts only once the modal window is up: mounting it in the same
   * frame keeps Android's UI thread from answering the window's focus event.
   */
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setQuery('');
    if (league == null) setShown(false);
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

  const searchIndex = useMemo(
    () =>
      pool.map((player) => ({
        player,
        haystack: searchKey(
          [player.name, player.nameAr, player.nameEn, player.club].filter(Boolean).join(' '),
        ),
      })),
    [pool],
  );

  const matches = useMemo(() => {
    const tokens = searchKey(query).split(' ').filter(Boolean);
    if (!tokens.length) return pool;
    return searchIndex
      .filter(({ haystack }) => tokens.every((token) => haystack.includes(token)))
      .map(({ player }) => player);
  }, [pool, searchIndex, query]);

  const handleSelect = useCallback(
    (player: TsfPlayer) => {
      if (league) onPick(league, player);
    },
    [league, onPick],
  );

  const renderItem = useCallback<ListRenderItem<TsfPlayer>>(
    ({ item }) => (
      <PlayerCard
        league={league as TsfLeagueKey}
        player={item}
        selected={item.id === selectedId}
        fontBold={fontBold}
        scale={scale}
        a11yLabel={[
          item.name,
          item.club,
          pickCopy.goalsA11y.replace('{count}', String(item.goals)),
          `${pickCopy.assistsA11y.replace('{count}', String(item.assists))} ${pickCopy.seasonA11y}`,
        ].join('. ')}
        onSelect={handleSelect}
      />
    ),
    [league, selectedId, fontBold, scale, pickCopy, handleSelect],
  );

  return (
    <Modal
      visible={league != null && !hidden}
      animationType="slide"
      onRequestClose={pending ? onCancelPending : onClose}
      onShow={() => setShown(true)}
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

        <FlatList
          key={league ?? 'none'}
          data={shown ? matches : EMPTY}
          keyExtractor={keyOf}
          renderItem={renderItem}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={9}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          columnWrapperStyle={[
            styles.row,
            { width: s(GRID_WIDTH), columnGap: s(GRID.columnGap), marginBottom: s(GRID.rowGap) },
          ]}
          contentContainerStyle={{
            // Room for the card's sparkle, which rises above the frame.
            paddingTop: s(GRID.top + 7),
            paddingBottom: Math.max(insets.bottom, 12) + s(12),
          }}
          ListEmptyComponent={
            query ? (
              <Text style={[styles.empty, { fontFamily: fontRegular, fontSize: s(15), marginTop: s(32) }]}>
                {pickCopy.searchEmpty}
              </Text>
            ) : null
          }
        />

        {league && pending ? (
          <ConfirmSheet
            league={league}
            player={pending}
            scale={scale}
            confirming={confirming}
            onConfirm={onConfirm}
            onCancel={onCancelPending}
            onViewProfile={onViewProfile}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const CONFIRM_CARD_SCALE = 1.45;

type ConfirmSheetProps = {
  league: TsfLeagueKey;
  player: TsfPlayer;
  scale: number;
  confirming: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onViewProfile?: (player: TsfPlayer) => void;
};

/** The pending pick over a dimmed picker: his card, then profile / confirm / cancel. */
function ConfirmSheet({ league, player, scale, confirming, onConfirm, onCancel, onViewProfile }: ConfirmSheetProps) {
  const { t, language } = useTranslation();
  const pickCopy = t.topScorersFive.pick;
  const isAr = language === 'ar';
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontRegular = useAppFont(400);
  const s = (value: number) => value * scale;
  const canViewProfile = onViewProfile != null && player.athleteId != null;

  return (
    <View style={styles.sheetBackdrop}>
      <View
        accessibilityViewIsModal
        style={[styles.sheet, { width: s(380), borderRadius: s(20), padding: s(20), rowGap: s(14) }]}
      >
        <Text style={[styles.sheetTitle, { fontFamily: fontSemi, fontSize: s(18) }]} maxFontSizeMultiplier={1.15}>
          {pickCopy.confirmTitle}
        </Text>

        <View pointerEvents="none" style={styles.sheetCard}>
          <PlayerCard
            league={league}
            player={player}
            selected={false}
            fontBold={fontBold}
            scale={scale * CONFIRM_CARD_SCALE}
            a11yLabel={player.name}
            onSelect={noop}
          />
        </View>

        <View style={{ rowGap: s(2) }}>
          <Text style={[styles.sheetName, { fontFamily: fontBold, fontSize: s(18) }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
            {player.name}
          </Text>
          <Text style={[styles.sheetMeta, { fontFamily: fontRegular, fontSize: s(13) }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
            {`${player.club} · ${pickCopy.leagues[league]}`}
          </Text>
        </View>

        <Text
          style={[styles.sheetBody, { fontFamily: fontRegular, fontSize: s(13), lineHeight: s(19), textAlign: 'center' }]}
          maxFontSizeMultiplier={1.15}
        >
          {pickCopy.confirmBody}
        </Text>

        {canViewProfile ? (
          <TouchableOpacity
            onPress={() => onViewProfile?.(player)}
            disabled={confirming}
            activeOpacity={0.8}
            accessibilityRole="button"
            testID="tsf-confirm-profile"
            style={[styles.sheetLink, { columnGap: s(6), flexDirection: isAr ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="person-circle-outline" size={s(18)} color={ACTIVE} />
            <Text style={[styles.sheetLinkText, { fontFamily: fontSemi, fontSize: s(14) }]} maxFontSizeMultiplier={1.15}>
              {pickCopy.viewProfile}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.sheetActions, { columnGap: s(10), flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={confirming}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ busy: confirming }}
            testID="tsf-confirm-yes"
            style={[styles.sheetButton, styles.sheetPrimary, { height: s(48), borderRadius: s(14) }]}
          >
            {confirming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.sheetPrimaryText, { fontFamily: fontSemi, fontSize: s(15) }]} maxFontSizeMultiplier={1.15}>
                {pickCopy.confirmYes}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onCancel}
            disabled={confirming}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="tsf-confirm-no"
            style={[styles.sheetButton, styles.sheetSecondary, { height: s(48), borderRadius: s(14) }]}
          >
            <Text style={[styles.sheetSecondaryText, { fontFamily: fontSemi, fontSize: s(15) }]} maxFontSizeMultiplier={1.15}>
              {pickCopy.confirmNo}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const noop = () => undefined;

type PlayerCardProps = {
  league: TsfLeagueKey;
  player: TsfPlayer;
  selected: boolean;
  fontBold: string;
  scale: number;
  a11yLabel: string;
  onSelect: (player: TsfPlayer) => void;
};

/**
 * The design's framed card: purple rails, crown and bars around a body that
 * holds the portrait over light streaks, fading to black under the name and
 * the league · club badges. Season goals and assists sit in the top corners.
 */
const PlayerCard = memo(function PlayerCard({
  league,
  player,
  selected,
  fontBold,
  scale,
  a11yLabel,
  onSelect,
}: PlayerCardProps) {
  const s = (value: number) => value * scale;
  const box = (b: Box) => ({
    position: 'absolute' as const,
    left: s(b.left),
    top: s(b.top),
    width: s(b.width),
    height: s(b.height),
  });

  return (
    <TouchableOpacity
      onPress={() => onSelect(player)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
      style={{ width: s(CARD.width), height: s(CARD.height) }}
    >
      <Image source={TSF_CARD_ART.under} style={box(TSF_CARD_ART_BOX)} contentFit="fill" />

      <View style={[box(PHOTO_WINDOW), styles.clip]} pointerEvents="none">
        {player.photo ? (
          <Image
            source={{ uri: player.photo }}
            style={box({ left: PHOTO.left, top: PHOTO.top, width: PHOTO.size, height: PHOTO.size })}
            contentFit="contain"
            contentPosition="top"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={[box({ left: 0, top: 22, width: PHOTO_WINDOW.width, height: 70 }), styles.center]}>
            <Text style={[styles.initials, { fontFamily: fontBold, fontSize: s(36) }]} allowFontScaling={false}>
              {tsfInitials(player)}
            </Text>
          </View>
        )}
      </View>

      <Image source={TSF_CARD_ART.over} style={box(TSF_CARD_ART_BOX)} contentFit="fill" />

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
          <View style={[styles.divider, { height: s(INFO.divider) }]} />
          {player.clubLogo ? (
            <Image
              source={{ uri: player.clubLogo }}
              style={{ width: s(INFO.club), height: s(INFO.club) }}
              contentFit="contain"
              cachePolicy="memory-disk"
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
});

const keyOf = (player: TsfPlayer) => player.id;
const EMPTY: readonly TsfPlayer[] = [];

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

  clip: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: 'rgba(255,255,255,0.32)' },

  corner: { position: 'absolute', alignItems: 'center' },
  cornerValue: { color: '#FFFFFF' },

  info: { position: 'absolute', alignItems: 'center' },
  name: { color: '#FFFFFF', textAlign: 'center', alignSelf: 'stretch' },
  badges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  divider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.4)' },
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

  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,3,3,0.78)',
  },
  sheet: {
    alignItems: 'center',
    backgroundColor: '#0D081A',
    borderWidth: 0.5,
    borderColor: '#B896FC',
    boxShadow: '0px 1px 13.2px rgba(163,77,245,0.45)',
  },
  sheetTitle: { color: '#FFFFFF', textAlign: 'center' },
  sheetCard: { alignItems: 'center' },
  sheetName: { color: '#FFFFFF', textAlign: 'center' },
  sheetMeta: { color: '#B896FC', textAlign: 'center' },
  sheetBody: { color: '#9E9E9E' },
  sheetLink: { alignItems: 'center', justifyContent: 'center' },
  sheetLinkText: { color: ACTIVE },
  sheetActions: { alignSelf: 'stretch' },
  sheetButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheetPrimary: { backgroundColor: ACTIVE },
  sheetPrimaryText: { color: '#FFFFFF' },
  sheetSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  sheetSecondaryText: { color: '#FFFFFF' },
});
