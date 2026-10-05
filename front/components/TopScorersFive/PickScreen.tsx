/**
 * "خماسي الهدافين" pitch screen — Figma `iPhone 14 Plus - 56` (node 1263:10333)
 * and its filled state `iPhone 14 Plus - 58` (node 1275:11412).
 *
 * One card per league laid out on the pitch; tapping a card opens a sheet with
 * that league's players. Picks live in component state and the pool is
 * placeholder data until the real selectable players are decided.
 *
 * Every element is positioned with the design-frame coordinates (448pt wide,
 * status bar removed) and scaled to fit both the device width and height.
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont, useScreenFont } from '../../utils/fontSetup';

import { GlassSurface } from '../KingOfPredictions/GlassSurface';
import { TSF_ART, TSF_DESIGN_WIDTH, TSF_LEAGUE_LOGO, type TsfLeagueKey } from './assets';
import { tsfInitials, tsfShortName, type TsfPlayer } from './mockData';
import { PlayerPicker } from './PlayerPicker';

const BG = '#030303';
const PURPLE = '#8B5CF6';
const PURPLE_SOFT = '#A78BFA';
const CARD_BG = '#08050F';
const CARD_STROKE = '#B896FC';
const CARD_LABEL = '#CF9BFC';
const TAB_ACTIVE = '#8C5CF5';

/** Design frame minus its 62pt status bar, down to 16pt below the tab bar. */
const DESIGN_STATUS_BAR = 62;
const DESIGN_CONTENT_HEIGHT = 855 - DESIGN_STATUS_BAR + 16;

/** Frame 802 — the formation block. */
const FORMATION = { left: 42, top: 248 - DESIGN_STATUS_BAR };
/** Frame 794 card inside each Group, plus the crown that overlaps its top edge. */
const CARD = { width: 107, height: 136, top: 10.47 };

type Slot = {
  readonly key: TsfLeagueKey;
  readonly left: number;
  readonly top: number;
  readonly logo: { width: number; height: number; top: number };
  readonly labelTop: number;
};

const SLOTS: readonly Slot[] = [
  { key: 'pl', left: 128.5, top: 0, logo: { width: 49, height: 81, top: 14.5 }, labelTop: 103.5 },
  { key: 'bundesliga', left: 0, top: 170.47, logo: { width: 67, height: 67, top: 21.5 }, labelTop: 96.5 },
  { key: 'seriea', left: 257, top: 170.47, logo: { width: 50, height: 85, top: 12.5 }, labelTop: 105.5 },
  { key: 'ligue1', left: 22, top: 360.93, logo: { width: 73, height: 73, top: 18.5 }, labelTop: 99.5 },
  { key: 'laliga', left: 235, top: 360.93, logo: { width: 85, height: 65, top: 22.5 }, labelTop: 95.5 },
];

type TabKey = 'matches' | 'pitch' | 'ranking';

const TAB_ICON: Record<TabKey, (size: number) => ReactElement> = {
  matches: (size) => <Ionicons name="calendar-outline" size={size} color="#FFFFFF" />,
  pitch: (size) => <MaterialCommunityIcons name="soccer-field" size={size} color="#FFFFFF" />,
  ranking: (size) => <Ionicons name="trophy-outline" size={size} color="#FFFFFF" />,
};

export default function TopScorersFivePickScreen() {
  useScreenFont();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const pickCopy = copy.pick;
  const isAr = language === 'ar';

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const [picks, setPicks] = useState<Partial<Record<TsfLeagueKey, TsfPlayer>>>({});
  const [openLeague, setOpenLeague] = useState<TsfLeagueKey | null>(null);

  const availableHeight = height - insets.top - Math.max(insets.bottom, 12);
  const scale = Math.min(width / TSF_DESIGN_WIDTH, availableHeight / DESIGN_CONTENT_HEIGHT);
  const s = useCallback((value: number) => value * scale, [scale]);

  /**
   * The nav floats over the pitch at the same lift as the King of Predictions
   * one. `DESIGN_CONTENT_HEIGHT` still reserves the nav's slot in the scale
   * above, so the formation can never grow down into it.
   */
  const navBottom = Math.max(insets.bottom, 12) + 8;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/top-scorers-five' as never);
  }, [router]);

  const handlePick = useCallback((league: TsfLeagueKey, player: TsfPlayer) => {
    setPicks((prev) => ({ ...prev, [league]: player }));
    setOpenLeague(null);
  }, []);

  const handleRemove = useCallback((league: TsfLeagueKey) => {
    setPicks((prev) => {
      const next = { ...prev };
      delete next[league];
      return next;
    });
  }, []);

  /** Arabic design order (left → right); English reads the other way. */
  const tabs = useMemo<readonly TabKey[]>(
    () => (isAr ? ['ranking', 'pitch', 'matches'] : ['matches', 'pitch', 'ranking']),
    [isAr],
  );

  return (
    <View style={styles.root}>
      <PitchBackground />

      <View
        style={{
          width: s(TSF_DESIGN_WIDTH),
          height: s(DESIGN_CONTENT_HEIGHT),
          marginTop: insets.top,
          alignSelf: 'center',
        }}
      >
        <Text
          style={[
            styles.title,
            { top: s(10), height: s(38), fontSize: s(20), lineHeight: s(38), fontFamily: fontSemi },
          ]}
          maxFontSizeMultiplier={1.1}
        >
          {copy.title}
        </Text>

        <TouchableOpacity
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          testID="top-scorers-five-pick-back"
          style={[styles.back, { left: s(24), top: s(10), width: s(38), height: s(38) }]}
        >
          <Ionicons name="arrow-back" size={s(28)} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          style={[
            styles.banner,
            {
              left: s(13),
              top: s(144 - DESIGN_STATUS_BAR),
              width: s(422),
              height: s(84),
              borderRadius: s(15),
              paddingHorizontal: s(23),
              gap: s(8),
              flexDirection: isAr ? 'row-reverse' : 'row',
            },
          ]}
        >
          <View style={[styles.bannerIcon, { width: s(58), height: s(58) }]}>
            <Ionicons name="flash" size={s(44)} color={PURPLE} />
          </View>
          <View style={styles.bannerText}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.bannerLine,
                {
                  fontFamily: fontMedium,
                  fontSize: s(20),
                  lineHeight: s(27),
                  textAlign: isAr ? 'right' : 'left',
                },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {pickCopy.goalLabel} <Text style={styles.accent}>{pickCopy.goalPoints}</Text>
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.bannerLine,
                {
                  fontFamily: fontMedium,
                  fontSize: s(20),
                  lineHeight: s(27),
                  marginTop: s(4),
                  textAlign: isAr ? 'right' : 'left',
                },
              ]}
              maxFontSizeMultiplier={1.1}
            >
              {pickCopy.assistLabel} <Text style={styles.accent}>{pickCopy.assistPoints}</Text>
            </Text>
          </View>
        </View>

        {SLOTS.map((slot) => {
          const player = picks[slot.key];
          return (
            <View
              key={slot.key}
              style={{
                position: 'absolute',
                left: s(FORMATION.left + slot.left),
                top: s(FORMATION.top + slot.top),
                width: s(CARD.width),
                height: s(CARD.top + CARD.height),
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setOpenLeague(slot.key)}
                accessibilityRole="button"
                accessibilityLabel={`${pickCopy.leagues[slot.key]} — ${
                  player ? player.name : pickCopy.choosePlayer
                }`}
                testID={`top-scorers-five-slot-${slot.key}`}
                style={[
                  styles.card,
                  { top: s(CARD.top), width: s(CARD.width), height: s(CARD.height), borderRadius: s(16) },
                ]}
              >
                {player ? (
                  <>
                    <View
                      style={[
                        styles.avatar,
                        { top: s(16), width: s(68), height: s(68), borderRadius: s(34) },
                      ]}
                    >
                      <Text style={[styles.avatarText, { fontFamily: fontBold, fontSize: s(22) }]}>
                        {tsfInitials(player)}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cardLabel,
                        styles.cardName,
                        { top: s(94), height: s(23), fontSize: s(15), fontFamily: fontBold },
                      ]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {tsfShortName(player)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Image
                      source={TSF_LEAGUE_LOGO[slot.key]}
                      style={{
                        position: 'absolute',
                        top: s(slot.logo.top),
                        width: s(slot.logo.width),
                        height: s(slot.logo.height),
                      }}
                      contentFit="contain"
                      transition={0}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cardLabel,
                        {
                          top: s(slot.labelTop),
                          height: s(18),
                          fontSize: s(15),
                          lineHeight: s(18),
                          fontFamily: fontMedium,
                        },
                      ]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {pickCopy.choosePlayer}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View pointerEvents="none" style={[styles.crown, { width: s(CARD.width) }]}>
                <FontAwesome5 name="crown" size={s(17)} color={PURPLE_SOFT} />
              </View>

              {player ? (
                <TouchableOpacity
                  onPress={() => handleRemove(slot.key)}
                  hitSlop={8}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={pickCopy.removePlayer.replace('{name}', player.name)}
                  style={[
                    styles.remove,
                    {
                      right: -s(3.5),
                      top: s(CARD.top - 4.5),
                      width: s(24),
                      height: s(24),
                      borderRadius: s(12),
                    },
                  ]}
                >
                  <Ionicons name="close" size={s(15)} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      <View pointerEvents="box-none" style={[styles.navWrap, { bottom: navBottom }]}>
        <GlassSurface
          radius={s(20)}
          tone="muted"
          style={[
            styles.nav,
            { width: s(404), height: s(83), paddingHorizontal: s(20), gap: s(15) },
          ]}
        >
          {tabs.map((tab) => {
            const active = tab === 'pitch';
            return (
              <View
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.tab,
                  { paddingVertical: s(6) },
                  active
                    ? { width: s(86), height: s(66), borderRadius: s(12), backgroundColor: TAB_ACTIVE }
                    : { width: s(109) },
                ]}
              >
                {TAB_ICON[tab](s(24))}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    { fontFamily: fontSemi, fontSize: s(active ? 14 : 12), marginTop: s(4) },
                  ]}
                  maxFontSizeMultiplier={1.1}
                >
                  {pickCopy.tabs[tab]}
                </Text>
              </View>
            );
          })}
        </GlassSurface>
      </View>

      <PlayerPicker
        league={openLeague}
        selectedId={openLeague ? picks[openLeague]?.id : undefined}
        onClose={() => setOpenLeague(null)}
        onChangeLeague={setOpenLeague}
        onPick={handlePick}
      />
    </View>
  );
}

/**
 * Figma fills the frame with the stadium art stretched to 2.34× the frame width
 * (shifted −0.67 widths, full height) under a 62% black layer. Until the art is
 * exported a drawn pitch stands in, without the overlay its colors already include.
 */
function PitchBackground() {
  if (TSF_ART.pitch != null) {
    return (
      <View style={styles.artClip} pointerEvents="none">
        <Image source={TSF_ART.pitch} style={styles.art} contentFit="fill" transition={0} />
        <View style={styles.artShade} />
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#07021A', '#1A0B3D', '#0F1A33']} style={styles.stands} />
      <View style={styles.pitch}>
        <LinearGradient colors={['#1D5226', '#2A7434', '#236A2D']} style={StyleSheet.absoluteFill} />
        {Array.from({ length: 8 }, (_, index) => (
          <View
            key={index}
            style={[styles.stripe, { top: `${index * 12.5}%`, opacity: index % 2 === 0 ? 1 : 0 }]}
          />
        ))}
        <View style={styles.centerLine} />
        <View style={styles.centerCircle} />
        <View style={styles.box} />
      </View>
      <LinearGradient
        colors={['rgba(15,26,51,1)', 'rgba(15,26,51,0)']}
        style={styles.pitchFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  artClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  art: { position: 'absolute', top: 0, left: '-67%', width: '234%', height: '100%' },
  artShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },

  stands: { position: 'absolute', top: 0, left: 0, right: 0, height: '46%' },
  pitch: { position: 'absolute', top: '42%', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  pitchFade: { position: 'absolute', top: '40%', left: 0, right: 0, height: '10%' },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '12.5%',
    backgroundColor: 'rgba(0,0,0,0.09)',
  },
  centerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  centerCircle: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: 120,
    height: 120,
    marginLeft: -60,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  box: {
    position: 'absolute',
    bottom: -2,
    left: '25%',
    right: '25%',
    height: 64,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  title: { position: 'absolute', left: 0, right: 0, color: '#FFFFFF', textAlign: 'center' },
  back: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  banner: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: 'rgba(76,29,149,0.45)',
    borderWidth: 0.5,
    borderColor: 'rgba(79,48,143,0.39)',
  },
  bannerIcon: { alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1 },
  bannerLine: { color: '#FFFFFF' },
  accent: { color: PURPLE_SOFT },

  card: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 0.5,
    borderColor: CARD_STROKE,
    overflow: 'hidden',
    boxShadow: '0px 1px 13.2px rgba(163,77,245,0.62)',
  },
  cardLabel: {
    position: 'absolute',
    left: 1,
    right: 1,
    color: CARD_LABEL,
    textAlign: 'center',
  },
  cardName: { color: '#FFFFFF' },
  avatar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E146A',
    borderWidth: 1.5,
    borderColor: PURPLE_SOFT,
  },
  avatarText: { color: '#FFFFFF' },
  crown: { position: 'absolute', top: 0, left: 0, alignItems: 'center' },
  remove: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1033',
    borderWidth: 1,
    borderColor: '#9CA3AF',
  },

  navWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050A1A',
    borderWidth: 0.5,
    borderColor: '#A854F7',
    shadowColor: '#5A129E',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  tab: { alignItems: 'center', justifyContent: 'center' },
  tabLabel: { color: '#FFFFFF', textAlign: 'center' },
});
