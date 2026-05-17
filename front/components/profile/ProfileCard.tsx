/**
 * ProfileCard — FIFA-style card for the Profile screen.
 *
 * Same SVG shape & element layout as FifaCard (rank screen):
 *   - Top-left quadrant: position text + flag + club/brand logos
 *   - Top-right quadrant: player photo (clipped)
 *   - Bottom half: AGE / HGT / WGT / FOOT stats grid
 *
 * Visual differences from FifaCard:
 *   - Card body: deep purple (#080315 → purple gradient)
 *   - Border: gold gradient (same as reference image)
 *   - Shimmer: purple-tinted sweep
 *   - Holo: purple pulse
 *   - Typography: Inter (700 / 800) — sharp & professional
 *
 * NativeWind v4 is used for utility classes on wrapper elements.
 */

import React, { useEffect, memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
  ClipPath,
  Image as SvgImage,
} from 'react-native-svg';

// ── Reusable safe animation loop (mirrors FifaCard) ──────────────────────────
const useSafeLoop = (from: number, to: number, duration: number) => {
  const animatedValue = React.useRef(new Animated.Value(from)).current;
  const start = () => {
    animatedValue.setValue(from);
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: to,
        duration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      })
    ).start();
  };
  return { animatedValue, start };
};

// ── Types ────────────────────────────────────────────────────────────────────
interface ProfileCardProps {
  playerImage?: ImageSourcePropType;
  cardType?: 'gold' | 'icon' | 'toty';
  scale?: number;
  onImageUpload?: () => void;
  uploadedImage?: string | null;
  countryFlag?: string | null;
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

// ── Constants ────────────────────────────────────────────────────────────────
const WIDTH = 300;
const HEIGHT = 460;

// Gold border (same as reference image)
const GOLD_0 = '#A17F37';
const GOLD_1 = '#FFE066';
const GOLD_2 = '#F5C518';

// Purple card body
const BODY_BG = '#080315';

// Accent colors on card
const ACCENT_TEXT = '#A78BFA';       // purple-light for position & stat values
const LABEL_TEXT = 'rgba(167,139,250,0.6)'; // muted purple for stat labels
const DIVIDER_COLOR = 'rgba(124,58,237,0.2)';
const SEPARATOR_COLOR = 'rgba(124,58,237,0.15)';

// Shimmer / holo tint (purple instead of gold)
const SHIMMER_MID = 'rgba(167,139,250,0.45)';
const HOLO_COLOR = 'rgba(124,58,237,0.22)';

// Inter font families (loaded in _layout.tsx)
const FONT_BOLD = 'Inter_700Bold';
const FONT_EXTRABOLD = 'Inter_800ExtraBold';

// Emoji flag regex
const EMOJI_FLAG_REGEX = /[\u{1F1E6}-\u{1F1FF}]/u;
const FALLBACK_FLAG: ImageSourcePropType = require('../../assets/images/football.png');

// ── Component ────────────────────────────────────────────────────────────────
const ProfileCard = memo(function ProfileCard({
  playerImage,
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
  const shimmer = useSafeLoop(0, 1, 4000);
  const holo = useSafeLoop(0, 1, 5000);
  const [flagFailed, setFlagFailed] = useState(false);

  useEffect(() => {
    shimmer.start();
    holo.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFlagFailed(false);
  }, [countryFlag]);

  const shimmerTranslate = shimmer.animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-400 * scale, 700 * scale],
  });
  const shimmerOpacity = shimmer.animatedValue.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, 0.8, 0.8, 0],
  });
  const holoOpacity = holo.animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.1, 0.25, 0.1],
  });

  const cardWidth = WIDTH * scale;
  const cardHeight = HEIGHT * scale;

  // ── Flag rendering (same logic as FifaCard) ──────────────────────────────
  const flagValue = (countryFlag ?? '').trim();
  const isEmojiFlag = !!flagValue && EMOJI_FLAG_REGEX.test(flagValue);
  const isIsoCode = !!flagValue && !isEmojiFlag && flagValue.length <= 3;
  const flagSize = { width: 44 * scale, height: 28 * scale };

  const renderFlag = () => {
    if (isEmojiFlag) {
      return (
        <Text
          style={{ fontSize: 28 * scale, lineHeight: 32 * scale }}
          accessibilityLabel="country-flag"
        >
          {flagValue}
        </Text>
      );
    }
    if (isIsoCode && !flagFailed) {
      return (
        <Image
          source={{ uri: `https://flagcdn.com/w80/${flagValue.toLowerCase()}.png` }}
          style={[flagSize, { borderRadius: 3 * scale }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFlagFailed(true)}
        />
      );
    }
    return (
      <Image
        source={FALLBACK_FLAG}
        style={[flagSize, { borderRadius: 3 * scale, opacity: 0.6 }]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  };

  return (
    <View className="items-center">
      <View style={[s.container, { width: cardWidth, height: cardHeight }]}>

        {/* ── Purple glow behind card ──────────────────────────────── */}
        <View
          style={[
            s.glow,
            { width: cardWidth, height: cardHeight, shadowColor: '#7C3AED' },
          ]}
        />

        {/* ── SVG card shape: gold border + purple body + player image ── */}
        <Svg
          width={cardWidth}
          height={cardHeight}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={s.cardSvg}
        >
          <Defs>
            {/* Gold border gradient */}
            <SvgLinearGradient id="pcBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%"   stopColor={GOLD_0} stopOpacity="1" />
              <Stop offset="35%"  stopColor={GOLD_1} stopOpacity="1" />
              <Stop offset="65%"  stopColor={GOLD_2} stopOpacity="1" />
              <Stop offset="100%" stopColor={GOLD_0} stopOpacity="1" />
            </SvgLinearGradient>

            {/* Player image clip (top-right quadrant) */}
            <ClipPath id="pcClip">
              <Path d="M150 12 L286 37 L286 230 L150 230 Z" />
            </ClipPath>
          </Defs>

          {/* Gold outer border */}
          <Path
            d="M150 8 L290 35 L290 380 L240 420 L150 452 L60 420 L10 380 L10 35 Z"
            fill="url(#pcBorder)"
          />

          {/* Purple card body */}
          <Path
            d="M150 12 L286 37 L286 378 L238 418 L150 448 L62 418 L14 378 L14 37 Z"
            fill={BODY_BG}
          />

          {/* Player image (top-right) */}
          {(uploadedImage || playerImage) && (
            <SvgImage
              x="150"
              y="12"
              width="136"
              height="218"
              href={uploadedImage ? { uri: uploadedImage } : (playerImage as any)}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#pcClip)"
            />
          )}
        </Svg>

        {/* ── Shimmer sweep (purple-tinted) ────────────────────────── */}
        <View
          className="absolute top-0 left-0 overflow-hidden rounded-2xl"
          style={{ width: cardWidth, height: cardHeight, zIndex: 2 }}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              s.shimmer,
              {
                opacity: shimmerOpacity,
                transform: [
                  { translateX: shimmerTranslate },
                  { rotate: '25deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255,255,255,0.12)',
                SHIMMER_MID,
                'rgba(255,255,255,0.12)',
                'transparent',
              ]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

          {/* Holo pulse */}
          <Animated.View style={[s.holoEffect, { opacity: holoOpacity }]}>
            <LinearGradient
              colors={[
                HOLO_COLOR,
                'rgba(255,255,255,0.08)',
                HOLO_COLOR,
                'rgba(255,255,255,0.04)',
              ]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
        </View>

        {/* ── Top-left quadrant: position + flag + logos ───────────── */}
        <View
          className="absolute items-center justify-center"
          style={{
            top: 12 * scale,
            left: 14 * scale,
            width: 136 * scale,
            height: 218 * scale,
            zIndex: 5,
          }}
        >
          <TouchableOpacity
            onPress={onPositionPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                s.posTxt,
                { fontSize: 32 * scale, marginBottom: 8 * scale, color: ACCENT_TEXT },
              ]}
            >
              {position || '--'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCountryPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {renderFlag()}
          </TouchableOpacity>

          <View
            className="flex-row mt-1"
            style={{ gap: 5 * scale, marginTop: 5 * scale }}
          >
            <TouchableOpacity
              onPress={onClubPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {clubLogo ? (
                <Image
                  source={{ uri: clubLogo }}
                  style={{ width: 30 * scale, height: 30 * scale }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 30 * scale,
                    height: 30 * scale,
                    backgroundColor: 'rgba(124,58,237,0.15)',
                  }}
                >
                  <Text style={{ fontSize: 16 * scale }}>⚽</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onBrandPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 30 * scale,
                    height: 30 * scale,
                    backgroundColor: 'rgba(124,58,237,0.15)',
                  }}
                >
                  <Text style={{ fontSize: 16 * scale }}>👟</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Top-right quadrant: image upload tap area ────────────── */}
        <TouchableOpacity
          style={[
            s.quadrantContainer,
            {
              top: 12 * scale,
              left: 150 * scale,
              width: 136 * scale,
              height: 218 * scale,
            },
          ]}
          onPress={onImageUpload}
          activeOpacity={0.8}
        >
          {!uploadedImage && (
            <View className="flex-1 items-center justify-center bg-purple-mid/10">
              <View style={[s.plusH, { width: 12 * scale, height: 2 * scale, backgroundColor: ACCENT_TEXT }]} />
              <View style={[s.plusV, { width: 2 * scale, height: 12 * scale, backgroundColor: ACCENT_TEXT }]} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Bottom stats grid ─────────────────────────────────────── */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 240 * scale,
            left: 20 * scale,
            right: 20 * scale,
            bottom: 60 * scale,
            justifyContent: 'center',
            zIndex: 5,
          }}
          onPress={onStatsPress}
          activeOpacity={0.9}
        >
          <View style={s.clearStatsGrid}>
            {/* Row 1: AGE + HGT */}
            <View style={s.clearStatsRow}>
              <View style={s.clearStatBox}>
                <Text style={[s.clearStatLabel, { color: LABEL_TEXT, fontSize: 7 * scale }]}>AGE</Text>
                <Text style={[s.clearStatValue, { color: ACCENT_TEXT, fontSize: 13 * scale }]}>{age ?? '--'}</Text>
              </View>
              <View style={[s.clearStatDivider, { backgroundColor: DIVIDER_COLOR }]} />
              <View style={s.clearStatBox}>
                <Text style={[s.clearStatLabel, { color: LABEL_TEXT, fontSize: 7 * scale }]}>HGT</Text>
                <Text style={[s.clearStatValue, { color: ACCENT_TEXT, fontSize: 13 * scale }]}>{height ?? '--'}</Text>
              </View>
            </View>

            <View style={[s.clearStatsSeparator, { backgroundColor: SEPARATOR_COLOR }]} />

            {/* Row 2: WGT + FOOT */}
            <View style={s.clearStatsRow}>
              <View style={s.clearStatBox}>
                <Text style={[s.clearStatLabel, { color: LABEL_TEXT, fontSize: 7 * scale }]}>WGT</Text>
                <Text style={[s.clearStatValue, { color: ACCENT_TEXT, fontSize: 13 * scale }]}>{weight ?? '--'}</Text>
              </View>
              <View style={[s.clearStatDivider, { backgroundColor: DIVIDER_COLOR }]} />
              <View style={s.clearStatBox}>
                <Text style={[s.clearStatLabel, { color: LABEL_TEXT, fontSize: 7 * scale }]}>FOOT</Text>
                <Text style={[s.clearStatValue, { color: ACCENT_TEXT, fontSize: 13 * scale }]}>
                  {foot?.toUpperCase() ?? '--'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default ProfileCard;

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    position: 'relative',
    elevation: 20,
    writingDirection: 'ltr',
  },
  cardSvg: { position: 'absolute', top: 0, left: 0 },
  quadrantContainer: { position: 'absolute', overflow: 'hidden', zIndex: 5 },
  posTxt: {
    fontFamily: FONT_EXTRABOLD,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  clearStatsGrid: { width: '100%' },
  clearStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    writingDirection: 'ltr',
  },
  clearStatBox: { flex: 1, alignItems: 'center' },
  clearStatLabel: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
    writingDirection: 'ltr',
  },
  clearStatValue: {
    fontFamily: FONT_EXTRABOLD,
    fontWeight: '800',
    writingDirection: 'ltr',
  },
  clearStatDivider: { width: 1, height: '70%' },
  clearStatsSeparator: {
    height: 1,
    width: '60%',
    alignSelf: 'center',
    marginVertical: 3,
  },
  shimmer: {
    width: '100%',
    height: '300%',
    position: 'absolute',
    top: '-100%',
    left: '-50%',
  },
  holoEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 28,
    zIndex: -1,
  },
  plusH: { position: 'absolute' },
  plusV: { position: 'absolute' },
});
