/**
 * ProfileCard — FIFA-style FC25 card
 *
 * Visual: deep purple/indigo card body with gold border, inner gold rim,
 * cracked-glass purple wings, animated radial purple aura behind.
 * Typography: Inter (700 / 800 / 900) for sharp, premium readability.
 * Animations: Reanimated 4 (rotating aura, sweeping shimmer, gold rim pulse).
 */

import React, { memo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Path,
  ClipPath,
  Image as SvgImage,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface ProfileCardProps {
  playerImage?: any;
  cardType?: 'gold' | 'icon' | 'toty';
  scale?: number;
  onImageUpload?: () => void;
  uploadedImage?: string | null;
  countryFlag?: string;
  onCountryPress?: () => void;
  position?: string;
  age?: string | number;
  height?: string | number;
  weight?: string | number;
  foot?: string;
  onPositionPress?: () => void;
  onStatsPress?: () => void;
  clubLogo?: string;
  onClubPress?: () => void;
  brandLogo?: string;
  onBrandPress?: () => void;
  isAvatarUploading?: boolean;
  isCountryUpdating?: boolean;
  isClubUpdating?: boolean;
  isBrandUpdating?: boolean;
  isStatsUpdating?: boolean;
}

// Card dimensions in viewBox units
const WIDTH = 300;
const HEIGHT = 460;

// ── Color palette (matches reference image) ──────────────────────────────────
const PURPLE_DEEP = '#1A0B2E';      // card inner background
const PURPLE_DARK = '#2D1B4E';      // card mid
const PURPLE_MID = '#4C1D95';       // accents
const PURPLE_GLOW = '#7C3AED';      // outer glow
const PURPLE_LIGHT = '#A78BFA';     // highlights
const GOLD_PRIMARY = '#F5C518';     // border + position text
const GOLD_DARK = '#A17F37';
const GOLD_LIGHT = '#FFE066';
const TEXT_WHITE = '#FFFFFF';

// ── Inter font helpers ───────────────────────────────────────────────────────
const FONT_700 = 'Inter_700Bold';
const FONT_800 = 'Inter_800ExtraBold';
const FONT_900 = 'Inter_800ExtraBold'; // 900 not loaded, use 800 as heaviest

const ProfileCard = memo(function ProfileCard({
  scale = 0.66,
  onImageUpload,
  uploadedImage,
  countryFlag,
  onCountryPress,
  position,
  onPositionPress,
  age,
  height,
  weight,
  foot,
  onStatsPress,
  clubLogo,
  onClubPress,
  brandLogo,
  onBrandPress,
}: ProfileCardProps) {
  // ── Reanimated shared values ────────────────────────────────────────────
  const auraRotation = useSharedValue(0);
  const auraPulse = useSharedValue(0);
  const shimmerProgress = useSharedValue(0);
  const goldPulse = useSharedValue(0);

  useEffect(() => {
    // Slow rotation of background aura (12 seconds full rotation)
    auraRotation.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );

    // Aura breathing (in/out)
    auraPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Diagonal shimmer sweep across card
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );

    // Gold border subtle pulse
    goldPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const cardWidth = WIDTH * scale;
  const cardHeight = HEIGHT * scale;

  // ── Animated styles ─────────────────────────────────────────────────────
  const auraStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${auraRotation.value * 360}deg` as const },
      { scale: interpolate(auraPulse.value, [0, 1], [1, 1.08]) },
    ] as any,
    opacity: interpolate(auraPulse.value, [0, 1], [0.55, 0.85]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      shimmerProgress.value,
      [0, 0.4, 0.6, 1],
      [0, 0.7, 0.7, 0]
    ),
    transform: [
      {
        translateX: interpolate(
          shimmerProgress.value,
          [0, 1],
          [-cardWidth * 0.8, cardWidth * 1.2]
        ),
      },
      { rotate: '20deg' as const },
    ] as any,
  }));

  const goldGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(goldPulse.value, [0, 1], [0.4, 0.85]),
  }));

  // ── Country flag rendering ──────────────────────────────────────────────
  const renderFlag = () => {
    const flagValue = (countryFlag ?? '').trim();
    if (!flagValue) {
      return <Text style={[s.flagPlaceholder, { fontSize: 32 * scale }]}>🌍</Text>;
    }

    // Emoji flag
    if (/[\u{1F1E6}-\u{1F1FF}]/u.test(flagValue)) {
      const codePoints = [...flagValue];
      if (codePoints.length === 2) {
        const first = codePoints[0].codePointAt(0)!;
        const second = codePoints[1].codePointAt(0)!;
        if (first >= 0x1F1E6 && first <= 0x1F1FF) {
          const code = String.fromCharCode(
            first - 0x1F1E6 + 65,
            second - 0x1F1E6 + 65
          ).toLowerCase();
          return (
            <Image
              source={{ uri: `https://flagcdn.com/w80/${code}.png` }}
              style={{ width: 36 * scale, height: 26 * scale, borderRadius: 3 * scale }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          );
        }
      }
      return <Text style={{ fontSize: 32 * scale }}>{flagValue}</Text>;
    }

    // ISO code
    if (flagValue.length <= 3) {
      return (
        <Image
          source={{ uri: `https://flagcdn.com/w80/${flagValue.toLowerCase()}.png` }}
          style={{ width: 36 * scale, height: 26 * scale, borderRadius: 3 * scale }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      );
    }

    return <Text style={{ fontSize: 32 * scale }}>{flagValue}</Text>;
  };

  return (
    <View style={[s.outer, { width: cardWidth * 1.45, height: cardHeight * 1.25 }]}>
      {/* ── Animated rotating purple aura behind card ─────────────────── */}
      <Animated.View
        style={[
          s.auraWrap,
          { width: cardWidth * 1.45, height: cardHeight * 1.25 },
          auraStyle as any,
        ]}
        pointerEvents="none"
      >
        <Svg
          width={cardWidth * 1.45}
          height={cardHeight * 1.25}
          viewBox="0 0 100 100"
        >
          <Defs>
            <SvgRadialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={PURPLE_GLOW} stopOpacity="0.65" />
              <Stop offset="40%" stopColor={PURPLE_MID} stopOpacity="0.4" />
              <Stop offset="75%" stopColor={PURPLE_DARK} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={PURPLE_DEEP} stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Path
            d="M50 5 L75 15 L90 35 L95 55 L85 78 L65 90 L50 95 L35 90 L15 78 L5 55 L10 35 L25 15 Z"
            fill="url(#auraGrad)"
          />
        </Svg>
      </Animated.View>

      {/* ── Card body ────────────────────────────────────────────────── */}
      <View style={[s.cardContainer, { width: cardWidth, height: cardHeight }]}>
        {/* Gold border pulse glow */}
        <Animated.View
          style={[
            s.goldGlow,
            { width: cardWidth, height: cardHeight },
            goldGlowStyle as any,
          ]}
          pointerEvents="none"
        />

        {/* Main card SVG */}
        <Svg
          width={cardWidth}
          height={cardHeight}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={s.cardSvg}
        >
          <Defs>
            {/* Outer gold border gradient */}
            <SvgLinearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_DARK} stopOpacity="1" />
              <Stop offset="35%" stopColor={GOLD_LIGHT} stopOpacity="1" />
              <Stop offset="65%" stopColor={GOLD_PRIMARY} stopOpacity="1" />
              <Stop offset="100%" stopColor={GOLD_DARK} stopOpacity="1" />
            </SvgLinearGradient>

            {/* Inner card body — deep purple gradient */}
            <SvgLinearGradient id="cardBody" x1="0%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#1F0F3A" stopOpacity="1" />
              <Stop offset="50%" stopColor={PURPLE_DEEP} stopOpacity="1" />
              <Stop offset="100%" stopColor="#0F051F" stopOpacity="1" />
            </SvgLinearGradient>

            {/* Subtle inner overlay glow */}
            <SvgRadialGradient id="innerGlow" cx="50%" cy="35%" r="60%">
              <Stop offset="0%" stopColor={PURPLE_GLOW} stopOpacity="0.2" />
              <Stop offset="60%" stopColor={PURPLE_MID} stopOpacity="0.05" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0" />
            </SvgRadialGradient>

            {/* Player image clip */}
            <ClipPath id="playerClip">
              <Path d="M150 12 L286 37 L286 230 L150 230 Z" />
            </ClipPath>
          </Defs>

          {/* Gold outer border */}
          <Path
            d="M150 8 L290 35 L290 380 L240 420 L150 452 L60 420 L10 380 L10 35 Z"
            fill="url(#goldBorder)"
          />

          {/* Inner card body (deep purple) */}
          <Path
            d="M150 14 L284 39 L284 376 L238 416 L150 446 L62 416 L16 376 L16 39 Z"
            fill="url(#cardBody)"
          />

          {/* Inner glow overlay */}
          <Path
            d="M150 14 L284 39 L284 376 L238 416 L150 446 L62 416 L16 376 L16 39 Z"
            fill="url(#innerGlow)"
          />

          {/* Player image (top right) */}
          {uploadedImage && (
            <SvgImage
              x="150"
              y="14"
              width="134"
              height="216"
              href={{ uri: uploadedImage }}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#playerClip)"
            />
          )}

          {/* Inner thin gold rim line above stats */}
          <Path
            d="M40 285 L260 285"
            stroke={GOLD_PRIMARY}
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        </Svg>

        {/* ── Diagonal shimmer sweep ──────────────────────────────── */}
        <View
          style={[s.shimmerMask, { width: cardWidth, height: cardHeight }]}
          pointerEvents="none"
        >
          <Animated.View style={[s.shimmerBar, shimmerStyle as any]}>
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255,224,102,0.0)',
                'rgba(255,255,255,0.18)',
                'rgba(245,197,24,0.35)',
                'rgba(255,255,255,0.18)',
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* ── Top-Left: Position + Flag + Logos column ─────────────── */}
        <View
          style={[
            s.leftColumn,
            {
              top: 18 * scale,
              left: 24 * scale,
              width: 110 * scale,
              height: 210 * scale,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onPositionPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                s.positionText,
                {
                  fontSize: 38 * scale,
                  textShadowRadius: 8 * scale,
                },
              ]}
            >
              {position || '--'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCountryPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: 16 * scale }}
          >
            {renderFlag()}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClubPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: 12 * scale }}
          >
            {clubLogo ? (
              <Image
                source={{ uri: clubLogo }}
                style={{ width: 32 * scale, height: 32 * scale }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={[
                  s.miniPlaceholder,
                  { width: 32 * scale, height: 32 * scale },
                ]}
              >
                <Text style={{ fontSize: 16 * scale }}>⚽</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onBrandPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: 10 * scale }}
          >
            {brandLogo ? (
              <Image
                source={{ uri: brandLogo }}
                style={{ width: 30 * scale, height: 30 * scale }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={[
                  s.miniPlaceholder,
                  { width: 30 * scale, height: 30 * scale },
                ]}
              >
                <Text style={{ fontSize: 14 * scale }}>👟</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Top-Right: Player image upload area ──────────────────── */}
        <TouchableOpacity
          style={[
            s.imageArea,
            {
              top: 14 * scale,
              left: 150 * scale,
              width: 134 * scale,
              height: 216 * scale,
            },
          ]}
          onPress={onImageUpload}
          activeOpacity={0.85}
        >
          {!uploadedImage && (
            <View style={s.uploadPlaceholder}>
              <View
                style={[
                  s.plusH,
                  { width: 14 * scale, height: 2 * scale, backgroundColor: GOLD_PRIMARY },
                ]}
              />
              <View
                style={[
                  s.plusV,
                  { width: 2 * scale, height: 14 * scale, backgroundColor: GOLD_PRIMARY },
                ]}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Bottom: Stats grid ──────────────────────────────────── */}
        <TouchableOpacity
          style={[
            s.statsContainer,
            {
              top: 248 * scale,
              left: 30 * scale,
              right: 30 * scale,
              height: 160 * scale,
            },
          ]}
          onPress={onStatsPress}
          activeOpacity={0.9}
        >
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={[s.statLabel, { fontSize: 11 * scale }]}>AGE</Text>
              <Text style={[s.statValue, { fontSize: 26 * scale }]}>
                {age || '--'}
              </Text>
            </View>
            <View style={[s.statDivider, { height: 50 * scale }]} />
            <View style={s.statItem}>
              <Text style={[s.statLabel, { fontSize: 11 * scale }]}>HGT</Text>
              <Text style={[s.statValue, { fontSize: 26 * scale }]}>
                {height || '--'}
              </Text>
            </View>
          </View>

          <View style={[s.rowDivider, { width: '85%' }]} />

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={[s.statLabel, { fontSize: 11 * scale }]}>WGT</Text>
              <Text style={[s.statValue, { fontSize: 26 * scale }]}>
                {weight || '--'}
              </Text>
            </View>
            <View style={[s.statDivider, { height: 50 * scale }]} />
            <View style={s.statItem}>
              <Text style={[s.statLabel, { fontSize: 11 * scale }]}>FOOT</Text>
              <Text style={[s.statValue, { fontSize: 26 * scale }]}>
                {(foot || '--').toString().toUpperCase()}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default ProfileCard;

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    writingDirection: 'ltr',
  },
  auraWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    position: 'relative',
    shadowColor: PURPLE_GLOW,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
    writingDirection: 'ltr',
  },
  cardSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  goldGlow: {
    position: 'absolute',
    borderRadius: 20,
    shadowColor: GOLD_PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 14,
  },

  // Shimmer
  shimmerMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 3,
  },
  shimmerBar: {
    position: 'absolute',
    top: '-50%',
    left: 0,
    width: '50%',
    height: '200%',
  },

  // Left column (position + flag + logos)
  leftColumn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 5,
  },
  positionText: {
    fontFamily: FONT_900,
    fontWeight: '900',
    color: GOLD_PRIMARY,
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(245,197,24,0.45)',
    textShadowOffset: { width: 0, height: 0 },
  },
  flagPlaceholder: {
    color: TEXT_WHITE,
  },
  miniPlaceholder: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Image area
  imageArea: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 4,
  },
  uploadPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: { position: 'absolute' },
  plusV: { position: 'absolute' },

  // Stats
  statsContainer: {
    position: 'absolute',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
    writingDirection: 'ltr',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: FONT_800,
    fontWeight: '800',
    color: GOLD_PRIMARY,
    letterSpacing: 1.5,
    marginBottom: 2,
    writingDirection: 'ltr',
  },
  statValue: {
    fontFamily: FONT_900,
    fontWeight: '900',
    color: TEXT_WHITE,
    letterSpacing: 0.5,
    writingDirection: 'ltr',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(245,197,24,0.25)',
    marginHorizontal: 8,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(245,197,24,0.25)',
    alignSelf: 'center',
    marginVertical: 4,
  },
});
