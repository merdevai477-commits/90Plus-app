/**
 * ProfileCard — AAA FIFA Ultimate Team inspired card.
 * Premium upgrade: crown shape, holographic effects, cinematic image blend,
 * animated border shimmer, ambient glow system, premium typography.
 * Preserves all existing props, SVG architecture, and Expo compatibility.
 */

import { memo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ImageSourcePropType,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
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
  Rect,
} from 'react-native-svg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CARD_BACK = require('../../assets/images/profile-card-back.png') as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ARENA_BG = require('../../assets/images/arena_profile.png') as number;

// ── Animation helpers ────────────────────────────────────────────────────────
const useSafeLoop = (from: number, to: number, duration: number, easing = Easing.bezier(0.4, 0, 0.2, 1)) => {
  const animatedValue = useRef(new Animated.Value(from)).current;
  const start = () => {
    animatedValue.setValue(from);
    Animated.loop(
      Animated.timing(animatedValue, { toValue: to, duration, easing, useNativeDriver: true })
    ).start();
  };
  return { animatedValue, start };
};

// ── Types ────────────────────────────────────────────────────────────────────
export interface ProfileCardProps {
  playerImage?: ImageSourcePropType;
  cardType?: 'gold' | 'icon' | 'toty';
  scale?: number;
  onImageUpload?: () => void;
  /** Tap on the player photo. Falls back to onImageUpload when omitted. */
  onImagePress?: () => void;
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
  isAvatarUploading?: boolean;
  isCountryUpdating?: boolean;
  isClubUpdating?: boolean;
  isStatsUpdating?: boolean;
}

// ── Design constants ─────────────────────────────────────────────────────────
const WIDTH  = 340;
const HEIGHT = 520;

// Gold palette
const GOLD_0 = '#7A5C1E';
const GOLD_2 = '#F5C518';
const GOLD_3 = '#FFF0A0';
const GOLD_INNER = 'rgba(255,240,160,0.55)';

// Accent
const ACCENT_POS   = '#F5C518';   // gold position text
const ACCENT_STAT  = '#C4B5FD';   // soft purple stat values
const LABEL_COL    = 'rgba(196,181,253,0.55)';
const DIVIDER_COL  = 'rgba(124,58,237,0.25)';
const SEP_COL      = 'rgba(124,58,237,0.18)';

// Holo rainbow stops
const HOLO_STOPS = [
  'rgba(255,0,128,0)',
  'rgba(255,0,128,0.18)',
  'rgba(255,165,0,0.18)',
  'rgba(0,255,128,0.18)',
  'rgba(0,200,255,0.18)',
  'rgba(180,0,255,0.18)',
  'rgba(255,0,128,0)',
] as const;

const FONT_BOLD      = 'Inter_700Bold';
const FONT_EXTRABOLD = 'Inter_800ExtraBold';

const EMOJI_FLAG_REGEX = /[\u{1F1E6}-\u{1F1FF}]/u;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FALLBACK_FLAG: ImageSourcePropType = require('../../assets/images/football.png');

// ── Component ────────────────────────────────────────────────────────────────
const ProfileCard = memo(function ProfileCard({
  playerImage,
  scale = 0.66,
  onImageUpload,
  onImagePress,
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
}: ProfileCardProps) {
  // Animations — only while profile tab is focused (reduces scroll jank on iOS/Android)
  const isFocused = useIsFocused();
  const shimmer  = useSafeLoop(0, 1, 3800);
  const holo     = useSafeLoop(0, 1, 4200, Easing.linear);
  const [flagFailed, setFlagFailed] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    // Lighter motion on Android — card still looks premium without continuous loops
    if (Platform.OS === 'android') return;
    shimmer.start();
    holo.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => { setFlagFailed(false); }, [countryFlag]);

  const cardWidth  = WIDTH  * scale;
  const cardHeight = HEIGHT * scale;

  // Full-bleed backdrop: span the whole screen width, centered behind the card.
  const { width: screenWidth } = useWindowDimensions();
  const arenaWidth = Math.max(screenWidth, cardWidth * 1.9);
  const arenaLeft  = -(arenaWidth - cardWidth) / 2;

  // Shimmer
  const shimmerX = shimmer.animatedValue.interpolate({
    inputRange: [0, 1], outputRange: [-500 * scale, 800 * scale],
  });
  const shimmerOp = shimmer.animatedValue.interpolate({
    inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 0.9, 0.9, 0],
  });

  // Holo rainbow sweep
  const holoX = holo.animatedValue.interpolate({
    inputRange: [0, 1], outputRange: [-cardWidth * 1.5, cardWidth * 1.5],
  });
  const holoOp = holo.animatedValue.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1], outputRange: [0, 0.55, 0.7, 0.55, 0],
  });

  // Flag rendering
  const flagValue   = (countryFlag ?? '').trim();
  const isEmojiFlag = !!flagValue && EMOJI_FLAG_REGEX.test(flagValue);
  const isIsoCode   = !!flagValue && !isEmojiFlag && flagValue.length <= 3;
  const flagSize    = { width: 44 * scale, height: 28 * scale };

  const renderFlag = () => {
    if (isEmojiFlag) return (
      <Text style={{ fontSize: 26 * scale, lineHeight: 30 * scale }} accessibilityLabel="country-flag">
        {flagValue}
      </Text>
    );
    if (isIsoCode && !flagFailed) return (
      <Image
        source={{ uri: `https://flagcdn.com/w80/${flagValue.toLowerCase()}.png` }}
        style={[flagSize, { borderRadius: 3 * scale }]}
        contentFit="cover" cachePolicy="memory-disk"
        onError={() => setFlagFailed(true)}
      />
    );
    return (
      <Image source={FALLBACK_FLAG} style={[flagSize, { borderRadius: 3 * scale, opacity: 0.5 }]}
        contentFit="cover" cachePolicy="memory-disk" />
    );
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[s.container, { width: cardWidth, height: cardHeight }]}>

        {/* ── arena_profile.png — full-bleed pitch backdrop behind the card ── */}
        <View
          pointerEvents="none"
          style={[s.arenaBg, {
            width: arenaWidth,
            height: cardHeight * 1.10,
            left: arenaLeft,
            top: -cardHeight * 0.04,
          }]}
        >
          <Image
            source={ARENA_BG}
            style={s.arenaImg}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {/* Fade the top and bottom into the page bg so the backdrop blends to
              the screen edges and ends cleanly ABOVE the name/username. */}
          <LinearGradient
            colors={['#05010D', 'transparent', 'transparent', '#05010D']}
            locations={[0, 0.28, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* ── SVG: border + body + crown + image + energy layers ────── */}
        <Svg width={cardWidth} height={cardHeight}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={s.cardSvg}>
          <Defs>
            {/* Gold border — 5-stop metallic */}
            <SvgLinearGradient id="pcBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%"   stopColor={GOLD_0} stopOpacity="1" />
              <Stop offset="20%"  stopColor={GOLD_2} stopOpacity="1" />
              <Stop offset="45%"  stopColor={GOLD_3} stopOpacity="1" />
              <Stop offset="70%"  stopColor={GOLD_2} stopOpacity="1" />
              <Stop offset="100%" stopColor={GOLD_0} stopOpacity="1" />
            </SvgLinearGradient>

            {/* Inner gold reflection line */}
            <SvgLinearGradient id="pcInnerGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%"   stopColor={GOLD_INNER} stopOpacity="0" />
              <Stop offset="40%"  stopColor={GOLD_INNER} stopOpacity="1" />
              <Stop offset="60%"  stopColor={GOLD_INNER} stopOpacity="1" />
              <Stop offset="100%" stopColor={GOLD_INNER} stopOpacity="0" />
            </SvgLinearGradient>

            {/* Energy radial — center purple bloom */}
            <SvgRadialGradient id="energyBloom" cx="50%" cy="45%" r="55%">
              <Stop offset="0%"   stopColor="#3B0080" stopOpacity="0.55" />
              <Stop offset="60%"  stopColor="#1A0038" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#05010D" stopOpacity="0" />
            </SvgRadialGradient>

            {/* Image cinematic overlay — dark top + purple edge */}
            <SvgLinearGradient id="imgOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%"   stopColor="#000000" stopOpacity="0.45" />
              <Stop offset="35%"  stopColor="#000000" stopOpacity="0.1" />
              <Stop offset="70%"  stopColor="#1A0038" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#05010D" stopOpacity="0.7" />
            </SvgLinearGradient>

            {/* Purple light leak on image left edge */}
            <SvgLinearGradient id="purpleLeak" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%"   stopColor="#7C3AED" stopOpacity="0.45" />
              <Stop offset="40%"  stopColor="#7C3AED" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </SvgLinearGradient>

            {/* Vignette */}
            <SvgRadialGradient id="vignette" cx="50%" cy="50%" r="70%">
              <Stop offset="0%"   stopColor="#000000" stopOpacity="0" />
              <Stop offset="75%"  stopColor="#000000" stopOpacity="0" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
            </SvgRadialGradient>

            {/* Player image clip — cinematic curved */}
            <ClipPath id="pcClip">
              <Path d="M162 22 Q228 12 308 52 L308 278 Q235 300 162 282 Z" />
            </ClipPath>

            {/* Crown clip */}
            <ClipPath id="crownClip">
              <Rect x="80" y="0" width="180" height="30" />
            </ClipPath>
          </Defs>

          {/* ── Outer gold border ──────────────────────────────────── */}
          <Path
            d="M170 8 Q252 14 318 52 L318 412 Q318 448 282 472 L170 512 L58 472 Q22 448 22 412 L22 52 Q88 14 170 8 Z"
            fill="url(#pcBorder)"
          />

          {/* ── Crown shape at top center ──────────────────────────── */}
          <Path
            d="M120 22 L140 8 L155 18 L170 4 L185 18 L200 8 L220 22 Z"
            fill="url(#pcBorder)"
          />
          {/* Crown inner fill */}
          <Path
            d="M124 22 L142 10 L156 19 L170 6 L184 19 L198 10 L216 22 Z"
            fill="#1A0038"
          />
          {/* Crown gold highlight line */}
          <Path
            d="M120 22 L140 8 L155 18 L170 4 L185 18 L200 8 L220 22"
            fill="none" stroke={GOLD_3} strokeWidth="0.8" strokeOpacity="0.7"
          />

          {/* ── Card body — profile-card-back.png as background ──── */}
          {/* Clip the image to the card shape */}
          <ClipPath id="bodyClip">
            <Path d="M170 16 Q248 22 310 56 L310 406 Q310 438 278 460 L170 502 L62 460 Q30 438 30 406 L30 56 Q92 22 170 16 Z" />
          </ClipPath>
          <SvgImage
            x="30" y="16" width="280" height="490"
            href={CARD_BACK}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#bodyClip)"
          />

          {/* ── Energy bloom overlay (keeps depth) ────────────────── */}
          <Path
            d="M170 16 Q248 22 310 56 L310 406 Q310 438 278 460 L170 502 L62 460 Q30 438 30 406 L30 56 Q92 22 170 16 Z"
            fill="url(#energyBloom)"
          />

          {/* ── Player image ───────────────────────────────────────── */}
          {(uploadedImage || playerImage) && (
            <SvgImage
              x="158" y="18" width="152" height="268"
              href={uploadedImage ? { uri: uploadedImage } : (playerImage as any)}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#pcClip)"
            />
          )}

          {/* ── Cinematic image overlay ────────────────────────────── */}
          <Path
            d="M162 22 Q228 12 308 52 L308 278 Q235 300 162 282 Z"
            fill="url(#imgOverlay)"
          />

          {/* ── Purple light leak on image left edge ──────────────── */}
          <Path
            d="M162 22 L175 22 L175 282 L162 282 Z"
            fill="url(#purpleLeak)"
          />

          {/* ── Inner gold reflection line ─────────────────────────── */}
          <Path
            d="M170 20 Q246 26 308 60 L308 408 Q308 436 278 458 L170 500 L62 458 Q32 436 32 408 L32 60 Q94 26 170 20 Z"
            fill="none" stroke="url(#pcInnerGold)" strokeWidth="1.2"
          />

          {/* ── Vignette ──────────────────────────────────────────── */}
          <Path
            d="M170 16 Q248 22 310 56 L310 406 Q310 438 278 460 L170 502 L62 460 Q30 438 30 406 L30 56 Q92 22 170 16 Z"
            fill="url(#vignette)"
          />

          {/* ── Decorative corner highlights ──────────────────────── */}
          <Path d="M30 80 L30 56 Q92 22 120 18" fill="none" stroke={GOLD_3} strokeWidth="0.6" strokeOpacity="0.5" />
          <Path d="M310 80 L310 56 Q248 22 220 18" fill="none" stroke={GOLD_3} strokeWidth="0.6" strokeOpacity="0.5" />
          <Path d="M30 430 L30 406 Q30 438 62 460 L90 472" fill="none" stroke={GOLD_3} strokeWidth="0.6" strokeOpacity="0.5" />
          <Path d="M310 430 L310 406 Q310 438 278 460 L250 472" fill="none" stroke={GOLD_3} strokeWidth="0.6" strokeOpacity="0.5" />

          {/* ── Stats section separator line ──────────────────────── */}
          <Path d="M50 308 L290 308" stroke={GOLD_2} strokeWidth="0.5" strokeOpacity="0.35" />

          {/* ── Bottom decorative line ─────────────────────────────── */}
          <Path d="M80 488 L260 488" stroke={GOLD_2} strokeWidth="0.4" strokeOpacity="0.3" />
        </Svg>

        {/* ── Inner border glow (animated pulse) ───────────────────── */}

        {/* ── Glass reflection top-left ─────────────────────────────── */}
        <View pointerEvents="none" style={[s.glassReflect, {
          top: 18 * scale, left: 18 * scale,
          width: 80 * scale, height: 40 * scale,
          borderRadius: 20 * scale,
        }]} />

        {/* ── Shimmer sweep ─────────────────────────────────────────── */}
        <View pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, width: cardWidth, height: cardHeight, overflow: 'hidden', borderRadius: 32 * scale, zIndex: 6 }}>
          <Animated.View style={[s.shimmer, { opacity: shimmerOp,
            transform: [{ translateX: shimmerX }, { rotate: '22deg' }] }]}>
            <LinearGradient
              colors={['transparent','rgba(255,255,255,0.06)','rgba(255,255,255,0.32)','rgba(255,255,255,0.06)','transparent']}
              style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>

        {/* ── Holographic rainbow sweep ─────────────────────────────── */}
        <View pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, width: cardWidth, height: cardHeight, overflow: 'hidden', borderRadius: 32 * scale, zIndex: 7 }}>
          <Animated.View style={[s.holoSweep, { opacity: holoOp,
            transform: [{ translateX: holoX }, { rotate: '18deg' }] }]}>
            <LinearGradient
              colors={HOLO_STOPS as any}
              style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>

        {/* ── Soft inner glow overlay ───────────────────────────────── */}
        <View pointerEvents="none" style={[s.innerGlow, {
          top: 0, left: 0, width: cardWidth, height: cardHeight, borderRadius: 32 * scale,
        }]} />

        {/* ── Top-left: position + flag + logos ────────────────────── */}
        <View style={{ position: 'absolute', top: 22 * scale, left: 14 * scale,
          width: 130 * scale, height: 230 * scale, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>

          <TouchableOpacity onPress={onPositionPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[s.posTxt, {
              fontSize: 46 * scale, marginBottom: 6 * scale,
              color: ACCENT_POS,
              textShadowColor: 'rgba(245,197,24,0.75)',
              textShadowRadius: 16,
              textShadowOffset: { width: 0, height: 0 },
            }]}>
              {position || '--'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onCountryPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            {renderFlag()}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 6 * scale, marginTop: 8 * scale }}>
            <TouchableOpacity onPress={onClubPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              {clubLogo ? (
                <Image source={{ uri: clubLogo }}
                  style={{ width: 32 * scale, height: 32 * scale }}
                  contentFit="contain" cachePolicy="memory-disk" />
              ) : (
                <View style={{ width: 32 * scale, height: 32 * scale,
                  backgroundColor: 'rgba(124,58,237,0.18)', borderRadius: 16 * scale,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' }}>
                  <Text style={{ fontSize: 16 * scale }}>⚽</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Image upload / preview tap area ───────────────────────── */}
        <TouchableOpacity
          style={[s.quadrantContainer, { top: 18 * scale, left: 158 * scale,
            width: 152 * scale, height: 268 * scale }]}
          onPress={onImagePress ?? onImageUpload} activeOpacity={0.85}
          accessibilityRole="imagebutton"
        >
          {!uploadedImage && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={[s.plusH, { width: 14 * scale, height: 2 * scale, backgroundColor: ACCENT_STAT }]} />
              <View style={[s.plusV, { width: 2 * scale, height: 14 * scale, backgroundColor: ACCENT_STAT }]} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Stats section ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={{ position: 'absolute', top: 308 * scale, left: 22 * scale,
            right: 22 * scale, bottom: 50 * scale, justifyContent: 'center', zIndex: 10 }}
          onPress={onStatsPress} activeOpacity={0.9}>

          {/* Stats background glass */}
          <View style={[s.statsBg, { borderRadius: 12 * scale, padding: 8 * scale }]}>

            {/* Row 1: AGE + HGT */}
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={[s.statLabel, { color: LABEL_COL, fontSize: 10 * scale }]}>AGE</Text>
                <Text style={[s.statValue, { color: ACCENT_STAT, fontSize: 26 * scale }]}>{age ?? '--'}</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: DIVIDER_COL, height: 36 * scale }]} />
              <View style={s.statBox}>
                <Text style={[s.statLabel, { color: LABEL_COL, fontSize: 10 * scale }]}>HGT</Text>
                <Text style={[s.statValue, { color: ACCENT_STAT, fontSize: 26 * scale }]}>{height ?? '--'}</Text>
              </View>
            </View>

            {/* Separator */}
            <View style={[s.statSep, { backgroundColor: SEP_COL, marginVertical: 4 * scale }]} />

            {/* Row 2: WGT + FOOT */}
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={[s.statLabel, { color: LABEL_COL, fontSize: 10 * scale }]}>WGT</Text>
                <Text style={[s.statValue, { color: ACCENT_STAT, fontSize: 26 * scale }]}>{weight ?? '--'}</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: DIVIDER_COL, height: 36 * scale }]} />
              <View style={s.statBox}>
                <Text style={[s.statLabel, { color: LABEL_COL, fontSize: 10 * scale }]}>FOOT</Text>
                <Text style={[s.statValue, { color: ACCENT_STAT, fontSize: 26 * scale }]}>
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
    elevation: 30,
    writingDirection: 'ltr',
  },
  cardSvg: { position: 'absolute', top: 0, left: 0 },
  quadrantContainer: { position: 'absolute', overflow: 'hidden', zIndex: 10 },

  // arena_profile.png pitch backdrop behind the card
  arenaBg: {
    position: 'absolute',
    zIndex: -1,
    overflow: 'hidden',
    borderRadius: 24,
  },
  arenaImg: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
    // Zoom the pitch in so the grass fills the frame and the card reads as if
    // it's floating over the field.
    transform: [{ scale: 1.25 }],
  },

  // Animated inner border glow
  innerBorderGlow: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.45)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 0,
    zIndex: 3,
  },

  // Glass reflection top-left
  glassReflect: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.055)',
    zIndex: 4,
    transform: [{ rotate: '-15deg' }],
  },

  // Shimmer bar
  shimmer: {
    width: '100%',
    height: '320%',
    position: 'absolute',
    top: '-110%',
    left: '-60%',
  },

  // Holo rainbow bar
  holoSweep: {
    width: '80%',
    height: '320%',
    position: 'absolute',
    top: '-110%',
    left: '-40%',
  },

  // Soft inner glow vignette
  innerGlow: {
    position: 'absolute',
    zIndex: 5,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    // Simulated via background
    backgroundColor: 'transparent',
  },

  // Position text
  posTxt: {
    fontFamily: FONT_EXTRABOLD,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },

  // Stats
  statsBg: {
    backgroundColor: 'rgba(5,1,13,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    writingDirection: 'ltr',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  statLabel: {
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 1,
    writingDirection: 'ltr',
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: FONT_EXTRABOLD,
    fontWeight: '900',
    writingDirection: 'ltr',
    letterSpacing: -0.5,
  },
  statDivider: { width: 1 },
  statSep: {
    height: 1,
    width: '55%',
    alignSelf: 'center',
  },

  plusH: { position: 'absolute' },
  plusV: { position: 'absolute' },
});
