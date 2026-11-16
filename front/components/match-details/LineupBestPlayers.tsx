import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text } from './MatchText';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PWGradientText } from '../predictAndWin/GradientText';
import { shortPlayerName, type LineupPitchPlayer } from '../../utils/lineupMatchState';
import { useLocalizedName } from '../../hooks/useLocalizedName';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';
import { LINEUP_ART, LINEUP_ICON } from './lineupAssets';
import { AthleteCutoutImage } from './AthleteCutoutImage';

/** Figma node 550:2809 — card is 447 wide inside the 448 artboard. */
const DESIGN_W = 448;
const MAX_SCALE = 520 / DESIGN_W;
const RATING_COLORS = ['#D1A4FB', '#874AC0'] as const;
const PHOTO_PX = 256;

type Size = 'lg' | 'sm';

const CARD = {
  lg: { w: 131, h: 159, name: 16, nameWeight: '600' as const, chipW: 42, chipH: 18, chipTop: 9, chipRight: 7, chipFont: 11, star: 13 },
  sm: { w: 94, h: 113, name: 11, nameWeight: '500' as const, chipW: 35, chipH: 15, chipTop: 6, chipRight: 6.5, chipFont: 9, star: 11 },
} as const;

interface LineupBestPlayersProps {
  players: LineupPitchPlayer[];
  title: string;
  rtl: boolean;
  resolvePhoto: (playerId: number, photo?: string | null, px?: number) => string;
  onPlayerPress?: (player: LineupPitchPlayer) => void;
}

/** Top three rated players of one team, best first; duplicates (same id) collapse. */
export function pickBestPlayers(players: LineupPitchPlayer[], count = 3): LineupPitchPlayer[] {
  const seen = new Set<string>();
  return players
    .filter((p) => p.rating != null && p.rating > 0)
    .filter((p) => {
      const key = p.id != null ? `id:${p.id}` : `name:${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, count);
}

function BestPlayerCard({
  player,
  size,
  s,
  photoUri,
  isDark,
  onPress,
}: {
  player: LineupPitchPlayer;
  size: Size;
  s: number;
  photoUri?: string;
  isDark: boolean;
  onPress?: (player: LineupPitchPlayer) => void;
}) {
  const c = CARD[size];
  const radius = 10 * s;
  const displayName = useLocalizedName(player.name);
  const plate = isDark ? '#1C1240' : '#EDE6FA';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        !isDark && styles.cardLight,
        isDark && styles.cardDark,
        {
          width: c.w * s,
          height: c.h * s,
          borderRadius: radius,
          paddingHorizontal: 9 * s,
          paddingVertical: 12 * s,
        },
      ]}
      onPress={onPress ? () => onPress(player) : undefined}
      disabled={!onPress || !player.id}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${displayName} ${player.rating?.toFixed(1) ?? ''}`}
    >
      <View style={[StyleSheet.absoluteFill, styles.photoWrap, { borderRadius: radius }]}>
        {!isDark ? (
          <LinearGradient
            colors={['#F8F5FF', '#E9D5FF']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: plate }]} />
        )}

        {/* Soft halo behind the cutout so the character pops. */}
        <View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: c.w * s * 0.78,
              height: c.w * s * 0.78,
              borderRadius: (c.w * s * 0.78) / 2,
              top: c.h * s * 0.08,
              backgroundColor: isDark ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.7)',
            },
          ]}
        />

        <AthleteCutoutImage
          athleteId={player.id}
          photo={photoUri}
          width={c.w * s}
          height={c.h * s * 0.78}
          plateColor="transparent"
          contentFit="contain"
          style={[styles.cutout, { bottom: c.h * s * 0.22 }]}
          recyclingKey={player.id ?? photoUri ?? player.name}
        />

        {isDark ? (
          size === 'lg' ? (
            <LinearGradient
              colors={['rgba(33,14,72,0)', '#1E1137']}
              locations={[0, 0.8]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : (
            <Image
              source={LINEUP_ART.bestSideOverlay}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={0}
            />
          )
        ) : (
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(241,236,255,0.92)']}
            locations={[0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
      </View>

      <Text
        style={[
          styles.name,
          {
            fontSize: c.name * s,
            fontWeight: c.nameWeight,
            color: isDark ? '#FFFFFF' : '#24104E',
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={1.1}
      >
        {shortPlayerName(displayName, size === 'lg' ? 12 : 10)}
      </Text>

      <View
        style={[
          styles.chip,
          size === 'lg' ? (isDark ? styles.chipLg : styles.chipLgLight) : isDark ? styles.chipSm : styles.chipSmLight,
          {
            top: c.chipTop * s,
            right: c.chipRight * s,
            width: c.chipW * s,
            height: c.chipH * s,
            borderRadius: 59 * s,
            gap: 1 * s,
          },
        ]}
      >
        <PWGradientText colors={RATING_COLORS} style={[styles.chipText, { fontSize: c.chipFont * s }]}>
          {(player.rating as number).toFixed(1)}
        </PWGradientText>
        <Image
          source={size === 'lg' ? LINEUP_ICON.ratingStarLg : LINEUP_ICON.ratingStarSm}
          style={{ width: c.star * s * 0.77, height: c.star * s * 0.74 }}
          contentFit="contain"
          transition={0}
        />
      </View>
    </TouchableOpacity>
  );
}

export function LineupBestPlayers({
  players,
  title,
  rtl,
  resolvePhoto,
  onPlayerPress,
}: LineupBestPlayersProps) {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useMatchDetailsTheme();
  const s = Math.min(width / DESIGN_W, MAX_SCALE);
  const best = useMemo(() => pickBestPlayers(players), [players]);

  if (best.length === 0) return null;

  const [first, second, third] = best;
  const ordered: Array<{ player: LineupPitchPlayer; size: Size }> = [
    ...(second ? [{ player: second, size: 'sm' as const }] : []),
    { player: first, size: 'lg' },
    ...(third ? [{ player: third, size: 'sm' as const }] : []),
  ];
  const photoFor = (p: LineupPitchPlayer) =>
    p.id ? resolvePhoto(p.id, p.photo, PHOTO_PX) || undefined : p.photo;

  return (
    <View
      style={[
        styles.section,
        isDark ? styles.sectionDark : styles.sectionLight,
        {
          marginHorizontal: 15 * s,
          borderRadius: 16 * s,
          paddingVertical: 28 * s,
          gap: 20 * s,
          borderColor: isDark ? 'rgba(45,6,82,0.66)' : colors.primaryBorder,
          backgroundColor: isDark ? '#07040D' : colors.cardBg,
        },
      ]}
    >
      {isDark ? (
        <View style={[StyleSheet.absoluteFill, styles.bgWrap, { borderRadius: 16 * s }]}>
          <Image source={LINEUP_ART.bestPlayersBg} style={styles.photo} contentFit="cover" transition={0} />
          <LinearGradient
            colors={['rgba(12,5,26,0.55)', 'rgba(7,4,13,0.6)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      ) : (
        <LinearGradient
          colors={['#FAF7FF', '#F0E9FF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 * s }]}
          pointerEvents="none"
        />
      )}

      <Text
        style={[
          styles.title,
          { fontSize: 18 * s, color: isDark ? '#FFFFFF' : colors.textPrimary },
        ]}
        maxFontSizeMultiplier={1.2}
      >
        {title}
      </Text>

      <View style={[styles.row, { gap: 10 * s, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {ordered.map(({ player, size }, i) => (
          <BestPlayerCard
            key={`best-${player.id ?? player.name}-${i}`}
            player={player}
            size={size}
            s={s}
            photoUri={photoFor(player)}
            isDark={isDark}
            onPress={onPlayerPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionDark: {
    shadowColor: 'rgba(42,4,78,0.48)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 21,
    elevation: 4,
  },
  sectionLight: {
    shadowColor: 'rgba(75,31,163,0.16)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  bgWrap: {
    overflow: 'hidden',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  cardLight: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(106,43,217,0.18)',
    shadowColor: 'rgba(75,31,163,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  cardDark: {},
  photoWrap: {
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  halo: {
    position: 'absolute',
    alignSelf: 'center',
  },
  cutout: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'transparent',
  },
  name: {
    textAlign: 'center',
    alignSelf: 'stretch',
    includeFontPadding: false,
    zIndex: 2,
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  chipLg: {
    backgroundColor: 'rgba(37,2,69,0.5)',
  },
  chipSm: {
    backgroundColor: 'rgba(0,0,0,0.49)',
  },
  chipLgLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(106,43,217,0.22)',
  },
  chipSmLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(106,43,217,0.22)',
  },
  chipText: {
    fontWeight: '500',
    includeFontPadding: false,
  },
});

export default LineupBestPlayers;
