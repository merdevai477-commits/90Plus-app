/**
 * "خماسي الهدافين" pitch tab — Figma `iPhone 14 Plus - 56` (node 1263:10333)
 * and the filled slot card Frame 794 (node 1545:6240).
 *
 * One card per league laid out on the pitch; tapping a card opens that league's
 * players. Every element is positioned with the design-frame coordinates
 * (448pt wide, status bar removed) and scaled to fit both width and height.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import {
  TSF_ART,
  TSF_DESIGN_WIDTH,
  TSF_LEAGUE_LOGO,
  TSF_LIGUE1_CREST_ASPECT,
  TSF_LOGO_TINT_ON_DARK,
  TSF_PITCH_CARD_ART,
  type TsfLeagueKey,
} from './assets';
import { tsfInitials, tsfShortName, type TsfPlayer } from './mockData';

const PURPLE = '#8B5CF6';
const PURPLE_SOFT = '#A78BFA';
const CARD_BG = '#09060F';
const CARD_STROKE = '#B698FD';
const CARD_LABEL = '#CF9BFC';

/** Design frame minus its 62pt status bar, down to 16pt below the tab bar. */
const DESIGN_STATUS_BAR = 62;
export const TSF_PITCH_DESIGN_HEIGHT = 855 - DESIGN_STATUS_BAR + 16;

/** Frame 802 — the formation block. */
const FORMATION = { left: 42, top: 248 - DESIGN_STATUS_BAR };
/**
 * Frame 794 filled card (1545:6240). Empty slots keep the same box; the crown
 * only hangs above empty cards. Photo crop matches the design's 79×67 window.
 */
const CARD = { width: 107, height: 138.85, top: 10.47 };
const FILLED = {
  photo: { left: 14, top: 11.42, width: 79, height: 67 },
  name: { top: 86.42, height: 23, fontSize: 19 },
  stats: { top: 117.42, height: 10, gap: 11, icon: 9, fontSize: 8 },
  remove: { size: 24, right: -4, top: -4.93 },
};

type Slot = {
  readonly key: TsfLeagueKey;
  readonly left: number;
  readonly top: number;
  readonly logo: {
    width: number;
    height: number;
    top: number;
    /** Pins the art to the box's top edge so a cropping box drops the foot. */
    anchorTop?: boolean;
  };
  readonly labelTop: number;
};

const EUROPE_SLOTS: readonly Slot[] = [
  { key: 'pl', left: 128.5, top: 0, logo: { width: 49, height: 81, top: 14.5 }, labelTop: 103.5 },
  { key: 'bundesliga', left: 0, top: 170.47, logo: { width: 67, height: 67, top: 21.5 }, labelTop: 96.5 },
  { key: 'seriea', left: 257, top: 170.47, logo: { width: 50, height: 85, top: 12.5 }, labelTop: 105.5 },
  {
    key: 'ligue1',
    left: 22,
    top: 360.93,
    // Design draws this box 73 square; narrowing it to the sponsor-free crest's
    // ratio is what crops the band, and leaves the mark the width it renders at.
    logo: { width: 73 * TSF_LIGUE1_CREST_ASPECT, height: 73, top: 18.5, anchorTop: true },
    labelTop: 99.5,
  },
  { key: 'laliga', left: 235, top: 360.93, logo: { width: 85, height: 65, top: 22.5 }, labelTop: 95.5 },
];

/** Same formation layout; every empty card shows the Egyptian league crest. */
const EGYPT_SLOTS: readonly Slot[] = [
  { key: 'egypt1', left: 128.5, top: 0, logo: { width: 64, height: 64, top: 22 }, labelTop: 103.5 },
  { key: 'egypt2', left: 0, top: 170.47, logo: { width: 64, height: 64, top: 22 }, labelTop: 96.5 },
  { key: 'egypt3', left: 257, top: 170.47, logo: { width: 64, height: 64, top: 22 }, labelTop: 105.5 },
  { key: 'egypt4', left: 22, top: 360.93, logo: { width: 64, height: 64, top: 22 }, labelTop: 99.5 },
  { key: 'egypt5', left: 235, top: 360.93, logo: { width: 64, height: 64, top: 22 }, labelTop: 95.5 },
];

/** Alias for Europe layout — Hermes Fast Refresh can keep a stale `SLOTS` bind. */
const SLOTS = EUROPE_SLOTS;

type PitchTabProps = {
  picks: Partial<Record<TsfLeagueKey, TsfPlayer>>;
  /** Leagues whose gameweek has already kicked off (empty slots stay locked). */
  leagueLocked?: Partial<Record<TsfLeagueKey, boolean>>;
  /** Europe = five leagues; Egypt = five Egyptian Premier attackers. */
  mode?: 'europe' | 'egypt';
  scale: number;
  onBack: () => void;
  onOpenLeague: (league: TsfLeagueKey) => void;
  onRemove: (league: TsfLeagueKey) => void;
};

export function PitchTab({
  picks,
  leagueLocked,
  mode = 'europe',
  scale,
  onBack,
  onOpenLeague,
  onRemove,
}: PitchTabProps) {
  const pitchSlots = mode === 'egypt' ? EGYPT_SLOTS : SLOTS;
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive;
  const pickCopy = copy.pick;
  const isAr = language === 'ar';

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const s = (value: number) => value * scale;

  return (
    <>
      <PitchBackground />

      <View
        style={{
          width: s(TSF_DESIGN_WIDTH),
          height: s(TSF_PITCH_DESIGN_HEIGHT),
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
          onPress={onBack}
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

        {pitchSlots.map((slot) => {
          const player = picks[slot.key];
          const slotLocked = Boolean(player?.locked || (!player && leagueLocked?.[slot.key]));
          const leagueLabel = pickCopy.leagues[slot.key] ?? pickCopy.choosePlayer;
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
                onPress={() => onOpenLeague(slot.key)}
                accessibilityRole="button"
                accessibilityLabel={`${leagueLabel} — ${
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
                        styles.photo,
                        {
                          left: s(FILLED.photo.left),
                          top: s(FILLED.photo.top),
                          width: s(FILLED.photo.width),
                          height: s(FILLED.photo.height),
                        },
                      ]}
                    >
                      {player.photo ? (
                        <Image
                          source={{ uri: player.photo }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          contentPosition="top"
                          transition={0}
                        />
                      ) : (
                        <Text style={[styles.photoText, { fontFamily: fontBold, fontSize: s(22) }]}>
                          {tsfInitials(player)}
                        </Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cardLabel,
                        styles.cardName,
                        {
                          top: s(FILLED.name.top),
                          height: s(FILLED.name.height),
                          fontSize: s(FILLED.name.fontSize),
                          fontFamily: fontSemi,
                        },
                      ]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {tsfShortName(player)}
                    </Text>
                    <View
                      accessible
                      accessibilityLabel={[
                        pickCopy.goalsA11y.replace('{count}', String(player.goals)),
                        pickCopy.assistsA11y.replace('{count}', String(player.assists)),
                        pickCopy.pointsA11y.replace('{count}', String(player.points ?? 0)),
                      ].join('. ')}
                      style={[
                        styles.cardStats,
                        {
                          top: s(FILLED.stats.top),
                          height: s(FILLED.stats.height),
                          columnGap: s(FILLED.stats.gap),
                        },
                      ]}
                    >
                      <View style={[styles.cardStat, { columnGap: s(1) }]}>
                        <Image
                          source={TSF_PITCH_CARD_ART.football}
                          style={{ width: s(FILLED.stats.icon), height: s(FILLED.stats.icon) }}
                          contentFit="fill"
                          transition={0}
                        />
                        <Text
                          style={[
                            styles.cardStatText,
                            { fontFamily: fontSemi, fontSize: s(FILLED.stats.fontSize) },
                          ]}
                          allowFontScaling={false}
                        >
                          {player.goals}
                        </Text>
                      </View>
                      <View style={[styles.cardStat, { columnGap: s(1) }]}>
                        <Image
                          source={TSF_PITCH_CARD_ART.cleat}
                          style={{ width: s(FILLED.stats.icon), height: s(FILLED.stats.icon) }}
                          contentFit="fill"
                          transition={0}
                        />
                        <Text
                          style={[
                            styles.cardStatText,
                            { fontFamily: fontSemi, fontSize: s(FILLED.stats.fontSize) },
                          ]}
                          allowFontScaling={false}
                        >
                          {player.assists}
                        </Text>
                      </View>
                      <View style={[styles.cardStat, { columnGap: s(1) }]}>
                        {isAr ? (
                          <>
                            <Text
                              style={[
                                styles.cardStatText,
                                { fontFamily: fontSemi, fontSize: s(FILLED.stats.fontSize) },
                              ]}
                              allowFontScaling={false}
                            >
                              {pickCopy.pointsShort}
                            </Text>
                            <Text
                              style={[
                                styles.cardStatText,
                                { fontFamily: fontSemi, fontSize: s(FILLED.stats.fontSize) },
                              ]}
                              allowFontScaling={false}
                            >
                              {player.points ?? 0}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text
                              style={[
                                styles.cardStatText,
                                { fontFamily: fontSemi, fontSize: s(FILLED.stats.fontSize) },
                              ]}
                              allowFontScaling={false}
                            >
                              {player.points ?? 0}
                            </Text>
                            <Text
                              style={[
                                styles.cardStatText,
                                { fontFamily: fontSemi, fontSize: s(FILLED.stats.fontSize) },
                              ]}
                              allowFontScaling={false}
                            >
                              {pickCopy.pointsShort}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
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
                      contentFit={slot.logo.anchorTop ? 'cover' : 'contain'}
                      contentPosition={slot.logo.anchorTop ? 'top' : 'center'}
                      tintColor={TSF_LOGO_TINT_ON_DARK[slot.key]}
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

              {player ? null : (
                <View pointerEvents="none" style={[styles.crown, { width: s(CARD.width) }]}>
                  <FontAwesome5 name="crown" size={s(17)} color={PURPLE_SOFT} />
                </View>
              )}

              {slotLocked ? (
                <TouchableOpacity
                  onPress={() => onOpenLeague(slot.key)}
                  hitSlop={8}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={
                    player
                      ? pickCopy.lockedA11y.replace('{name}', player.name)
                      : `${leagueLabel} — ${pickCopy.lockedUntilNext}`
                  }
                  style={[
                    styles.remove,
                    styles.locked,
                    {
                      right: s(FILLED.remove.right),
                      top: s(CARD.top + FILLED.remove.top),
                      width: s(FILLED.remove.size),
                      height: s(FILLED.remove.size),
                      borderRadius: s(FILLED.remove.size / 2),
                    },
                  ]}
                >
                  <Ionicons name="lock-closed" size={s(12)} color="#FFFFFF" />
                </TouchableOpacity>
              ) : player ? (
                <TouchableOpacity
                  onPress={() => onRemove(slot.key)}
                  hitSlop={8}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={pickCopy.removePlayer.replace('{name}', player.name)}
                  style={{
                    position: 'absolute',
                    right: s(FILLED.remove.right),
                    top: s(CARD.top + FILLED.remove.top),
                    width: s(FILLED.remove.size),
                    height: s(FILLED.remove.size),
                  }}
                >
                  <Image
                    source={TSF_PITCH_CARD_ART.remove}
                    style={{ width: s(FILLED.remove.size), height: s(FILLED.remove.size) }}
                    contentFit="fill"
                    transition={0}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
    </>
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
    boxShadow: '0px 1px 6.6px rgba(162,77,244,0.62)',
  },
  cardLabel: {
    position: 'absolute',
    left: 1,
    right: 1,
    color: CARD_LABEL,
    textAlign: 'center',
  },
  cardName: { color: '#FFFFFF' },
  photo: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E146A',
  },
  photoText: { color: '#FFFFFF' },
  cardStats: {
    position: 'absolute',
    left: 1,
    right: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStat: { flexDirection: 'row', alignItems: 'center' },
  cardStatText: { color: '#FFFFFF' },
  crown: { position: 'absolute', top: 0, left: 0, alignItems: 'center' },
  remove: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: '#828282',
  },
  locked: { backgroundColor: PURPLE, borderColor: PURPLE_SOFT },
});
