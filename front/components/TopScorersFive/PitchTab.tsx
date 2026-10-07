/**
 * "خماسي الهدافين" pitch tab — Figma `iPhone 14 Plus - 56` (node 1263:10333)
 * and its filled state `iPhone 14 Plus - 58` (node 1275:11412).
 *
 * One card per league laid out on the pitch; tapping a card opens that league's
 * players. Every element is positioned with the design-frame coordinates
 * (448pt wide, status bar removed) and scaled to fit both width and height.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  type TsfLeagueKey,
} from './assets';
import { tsfInitials, tsfShortName, type TsfPlayer } from './mockData';

const PURPLE = '#8B5CF6';
const PURPLE_SOFT = '#A78BFA';
const CARD_BG = '#08050F';
const CARD_STROKE = '#B896FC';
const CARD_LABEL = '#CF9BFC';

/** Design frame minus its 62pt status bar, down to 16pt below the tab bar. */
const DESIGN_STATUS_BAR = 62;
export const TSF_PITCH_DESIGN_HEIGHT = 855 - DESIGN_STATUS_BAR + 16;

/** Frame 802 — the formation block. */
const FORMATION = { left: 42, top: 248 - DESIGN_STATUS_BAR };
/** Frame 794 card inside each Group, plus the crown that overlaps its top edge. */
const CARD = { width: 107, height: 136, top: 10.47 };

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

const SLOTS: readonly Slot[] = [
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

type PitchTabProps = {
  picks: Partial<Record<TsfLeagueKey, TsfPlayer>>;
  scale: number;
  onBack: () => void;
  onOpenLeague: (league: TsfLeagueKey) => void;
  onRemove: (league: TsfLeagueKey) => void;
};

export function PitchTab({ picks, scale, onBack, onOpenLeague, onRemove }: PitchTabProps) {
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
                onPress={() => onOpenLeague(slot.key)}
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
                      {player.photo ? (
                        <Image
                          source={{ uri: player.photo }}
                          style={[StyleSheet.absoluteFill, { borderRadius: s(34) }]}
                          contentFit="cover"
                          contentPosition="top"
                        />
                      ) : (
                        <Text style={[styles.avatarText, { fontFamily: fontBold, fontSize: s(22) }]}>
                          {tsfInitials(player)}
                        </Text>
                      )}
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
                    {player.points != null ? (
                      <View
                        accessible
                        accessibilityLabel={[
                          pickCopy.goalsA11y.replace('{count}', String(player.goals)),
                          pickCopy.assistsA11y.replace('{count}', String(player.assists)),
                          pickCopy.pointsA11y.replace('{count}', String(player.points)),
                        ].join('. ')}
                        style={[styles.cardStats, { top: s(117), height: s(14), columnGap: s(6) }]}
                      >
                        <View style={[styles.cardStat, { columnGap: s(2) }]}>
                          <Ionicons name="football" size={s(10)} color="#FFFFFF" />
                          <Text style={[styles.cardStatText, { fontFamily: fontBold, fontSize: s(11) }]} allowFontScaling={false}>
                            {player.goals}
                          </Text>
                        </View>
                        <View style={[styles.cardStat, { columnGap: s(2) }]}>
                          <MaterialCommunityIcons name="shoe-cleat" size={s(10)} color="#FFFFFF" />
                          <Text style={[styles.cardStatText, { fontFamily: fontBold, fontSize: s(11) }]} allowFontScaling={false}>
                            {player.assists}
                          </Text>
                        </View>
                        <Text style={[styles.cardPoints, { fontFamily: fontBold, fontSize: s(11) }]} allowFontScaling={false}>
                          {`${player.points} ${pickCopy.pointsShort}`}
                        </Text>
                      </View>
                    ) : null}
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

              <View pointerEvents="none" style={[styles.crown, { width: s(CARD.width) }]}>
                <FontAwesome5 name="crown" size={s(17)} color={PURPLE_SOFT} />
              </View>

              {player?.locked ? (
                <TouchableOpacity
                  onPress={() => onOpenLeague(slot.key)}
                  hitSlop={8}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={pickCopy.lockedA11y.replace('{name}', player.name)}
                  style={[
                    styles.remove,
                    styles.locked,
                    {
                      right: -s(3.5),
                      top: s(CARD.top - 4.5),
                      width: s(24),
                      height: s(24),
                      borderRadius: s(12),
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
  cardPoints: { color: CARD_LABEL },
  crown: { position: 'absolute', top: 0, left: 0, alignItems: 'center' },
  remove: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1033',
    borderWidth: 1,
    borderColor: '#9CA3AF',
  },
  locked: { backgroundColor: PURPLE, borderColor: PURPLE_SOFT },
});
