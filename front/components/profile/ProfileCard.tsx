import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Crown, Zap } from 'lucide-react-native';

import {
  GOLD_PRIMARY,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
  TEXT_PRIMARY,
} from '../../constants/tokens';
import { GlassWrapper, glassProps, ACCENT, ACCENT_DARK } from '../../constants/ui';
import { useTranslation } from '../../src/i18n';
import { resolveCountryDisplayName, isMeaningfulCountryFlag } from '../../utils/countryDisplay';
import { useCoins } from '../../contexts/CoinsContext';
import { CoinsInfoModal } from '../common/CoinsInfoModal';
import { LevelInfoModal } from '../common/LevelInfoModal';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AVATAR_PLACEHOLDER = require('../../assets/images/plear 90Plus.png') as number;

const CARD_W = 340;
const CARD_H = 448;
const MAX_SCALE = 1.02;

const POSITION_LABELS: Record<string, string> = {
  ST: 'STRIKER',
  CF: 'STRIKER',
  LW: 'LEFT WINGER',
  RW: 'RIGHT WINGER',
  CAM: 'ATT. MID',
  CM: 'MIDFIELDER',
  CDM: 'DEF. MID',
  CB: 'DEFENDER',
  LB: 'LEFT BACK',
  RB: 'RIGHT BACK',
  GK: 'GOALKEEPER',
};

export interface ProfileCardProps {
  playerImage?: ImageSourcePropType;
  cardType?: 'gold' | 'icon' | 'toty';
  scale?: number;
  onImageUpload?: () => void;
  uploadedImage?: string | null;
  countryFlag?: string | null;
  country?: string | null;
  onCountryPress?: () => void;
  position?: string;
  age?: string | number;
  height?: string | number;
  weight?: string | number;
  foot?: string;
  onPositionPress?: () => void;
  onStatsPress?: () => void;
  clubLogo?: string;
  favoriteTeam?: string | null;
  onClubPress?: () => void;
  displayName?: string;
  username?: string;
  level?: number;
  showEconomyBadges?: boolean;
  fillWidth?: boolean;
  widthPadding?: number;
  isAvatarUploading?: boolean;
  isCountryUpdating?: boolean;
  isClubUpdating?: boolean;
  isStatsUpdating?: boolean;
}

function resolvePhotoUri(
  uploadedImage?: string | null,
  playerImage?: ImageSourcePropType,
): string | null {
  if (uploadedImage) return uploadedImage;
  if (playerImage && typeof playerImage === 'object' && 'uri' in playerImage) {
    return (playerImage as { uri?: string }).uri ?? null;
  }
  return null;
}

function GlassChip({
  scale,
  children,
  onPress,
  style,
}: {
  scale: number;
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  const inner = (
    <View style={[styles.glassChip, { borderRadius: 14 * scale, paddingHorizontal: 10 * scale, paddingVertical: 6 * scale }, style]}>
      <GlassWrapper {...(glassProps.chip as object)} style={StyleSheet.absoluteFill} />
      <View style={styles.glassChipTint} />
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.88 }}>
      {inner}
    </Pressable>
  );
}

function StatRow({
  icon,
  label,
  value,
  scale,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  scale: number;
}) {
  return (
    <View style={[styles.statRow, { gap: 6 * scale, marginBottom: 7 * scale }]}>
      <View style={[styles.statIconWrap, { width: 20 * scale, height: 20 * scale, borderRadius: 10 * scale }]}>
        <Ionicons name={icon} size={10 * scale} color={PURPLE_SOFT} />
      </View>
      <View style={styles.statTextCol}>
        <Text style={[styles.statLabel, { fontSize: 7 * scale }]}>{label}</Text>
        <Text style={[styles.statValue, { fontSize: 12 * scale }]}>{value}</Text>
      </View>
    </View>
  );
}

function GlassSidePanel({
  scale,
  side,
  onPress,
  children,
}: {
  scale: number;
  side: 'left' | 'right';
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const w = 84 * scale;
  const h = 168 * scale;
  const panelStyle = [
    styles.sidePanel,
    {
      width: w,
      height: h,
      top: 136 * scale,
      borderRadius: 16 * scale,
      ...(side === 'left' ? { left: 12 * scale } : { right: 12 * scale }),
    },
  ];

  const inner = (
    <>
      <GlassWrapper {...(glassProps.card as object)} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(168,85,247,0.14)', 'rgba(5,1,13,0.45)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.sidePanelInner, { paddingVertical: 12 * scale, paddingHorizontal: 8 * scale }]}>
        {children}
      </View>
    </>
  );

  if (!onPress) return <View style={panelStyle}>{inner}</View>;
  return (
    <TouchableOpacity style={panelStyle} activeOpacity={0.85} onPress={onPress}>
      {inner}
    </TouchableOpacity>
  );
}

const ProfileCard = memo(function ProfileCard({
  playerImage,
  scale = 0.66,
  fillWidth = false,
  widthPadding = 12,
  onImageUpload,
  uploadedImage,
  countryFlag,
  country,
  onCountryPress,
  position,
  age,
  height,
  weight,
  foot,
  onPositionPress,
  onStatsPress,
  clubLogo,
  favoriteTeam,
  onClubPress,
  displayName,
  username,
  level,
  showEconomyBadges = false,
  isAvatarUploading,
  isCountryUpdating,
  isClubUpdating,
  isStatsUpdating,
}: ProfileCardProps) {
  const { t, language } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const { coins, loading: coinsLoading } = useCoins();
  const [showCoinsInfo, setShowCoinsInfo] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);

  const openLevelInfo = useCallback(() => setShowLevelInfo(true), []);
  const closeLevelInfo = useCallback(() => setShowLevelInfo(false), []);
  const openCoinsInfo = useCallback(() => setShowCoinsInfo(true), []);
  const closeCoinsInfo = useCallback(() => setShowCoinsInfo(false), []);

  const effectiveScale = Math.min(
    fillWidth ? (windowWidth - widthPadding * 2) / CARD_W : scale,
    MAX_SCALE,
  );

  const cardWidth = CARD_W * effectiveScale;
  const cardHeight = CARD_H * effectiveScale;
  const radius = 24 * effectiveScale;
  const economyVisible = showEconomyBadges && level != null;
  const headerTop = 12 * effectiveScale;
  const contentTop = economyVisible ? 52 * effectiveScale : 16 * effectiveScale;
  const coinsDisplay = coinsLoading ? '—' : String(coins);
  const photoUri = resolvePhotoUri(uploadedImage, playerImage);

  const preferArabic = language === 'ar';
  const countryName = useMemo(
    () => resolveCountryDisplayName(country, countryFlag, preferArabic),
    [country, countryFlag, preferArabic],
  );
  const flagEmoji = isMeaningfulCountryFlag(countryFlag) ? countryFlag!.trim() : null;
  const pos = position?.trim() || 'ST';
  const positionLabel = POSITION_LABELS[pos.toUpperCase()] ?? pos.toUpperCase();
  const name = displayName?.trim() || '';
  const handle = username?.trim() ? `@${username.trim()}` : '';

  return (
    <View style={[styles.outer, { width: cardWidth }]}>
      <View
        style={[
          styles.cardShell,
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: radius,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.ambientGlow,
            {
              width: cardWidth * 1.08,
              height: cardHeight * 1.06,
              borderRadius: radius + 4,
            },
          ]}
        />

        <GlassWrapper
          {...(glassProps.card as object)}
          style={[StyleSheet.absoluteFill, styles.cardGlass, { borderRadius: radius }]}
        >
          <LinearGradient
            colors={[
              'rgba(124,58,237,0.18)',
              'rgba(10,5,22,0.72)',
              'rgba(5,1,13,0.82)',
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          <LinearGradient
            colors={[ACCENT, ACCENT_DARK, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.topAccent, { height: 2 * effectiveScale, borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
          />

          <View
            pointerEvents="none"
            style={[styles.glassShine, { top: 8 * effectiveScale, left: 16 * effectiveScale, width: 72 * effectiveScale, height: 28 * effectiveScale, borderRadius: 14 * effectiveScale }]}
          />

          {economyVisible ? (
            <View style={[styles.economyRow, { top: headerTop, left: 14 * effectiveScale, right: 14 * effectiveScale }]}>
              <GlassChip scale={effectiveScale} onPress={openLevelInfo}>
                <View style={styles.chipRow}>
                  <Text style={[styles.lvlLabel, { fontSize: 8 * effectiveScale }]}>LVL</Text>
                  <Text style={[styles.lvlNumber, { fontSize: 13 * effectiveScale }]}>{level}</Text>
                </View>
              </GlassChip>

              <GlassChip scale={effectiveScale} onPress={openCoinsInfo}>
                <View style={styles.chipRow}>
                  <Zap size={12 * effectiveScale} color={PURPLE_PRIMARY} fill={PURPLE_PRIMARY} />
                  <Text style={[styles.coinTxt, { fontSize: 12 * effectiveScale }]}>{coinsDisplay}</Text>
                </View>
              </GlassChip>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.topLeft, { top: contentTop, left: 14 * effectiveScale }]}
            onPress={onPositionPress}
            activeOpacity={onPositionPress ? 0.8 : 1}
            disabled={!onPositionPress}
          >
            <View style={styles.positionTagRow}>
              <Ionicons name="chevron-forward" size={9 * effectiveScale} color={GOLD_PRIMARY} />
              <Text style={[styles.positionTag, { fontSize: 8 * effectiveScale }]}>{positionLabel}</Text>
            </View>
            <Text style={[styles.positionAbbr, { fontSize: 32 * effectiveScale }]}>{pos}</Text>
          </TouchableOpacity>

          <View style={[styles.topRight, { top: contentTop, right: 14 * effectiveScale, maxWidth: cardWidth * 0.5 }]}>
            <View style={styles.nameRow}>
              <Text style={[styles.arName, { fontSize: 14 * effectiveScale }]} numberOfLines={1}>
                {name || t.profile.profileCardGuest}
              </Text>
              <Crown size={13 * effectiveScale} color={GOLD_PRIMARY} fill={GOLD_PRIMARY} strokeWidth={1.5} />
            </View>
            {handle ? (
              <Text style={[styles.cardUsername, { fontSize: 10 * effectiveScale, marginTop: 2 * effectiveScale }]} numberOfLines={1}>
                {handle}
              </Text>
            ) : null}
            {(countryName || flagEmoji || onCountryPress) ? (
              <TouchableOpacity
                onPress={onCountryPress}
                activeOpacity={onCountryPress ? 0.8 : 1}
                disabled={!onCountryPress}
                style={[styles.countryPill, { marginTop: 6 * effectiveScale, paddingHorizontal: 8 * effectiveScale, paddingVertical: 4 * effectiveScale }]}
              >
                <GlassWrapper {...(glassProps.chip as object)} style={StyleSheet.absoluteFill} />
                {isCountryUpdating ? (
                  <ActivityIndicator size="small" color={PURPLE_SOFT} />
                ) : (
                  <View style={styles.countryRow}>
                    <Ionicons name="location-outline" size={10 * effectiveScale} color={PURPLE_SOFT} />
                    {countryName ? (
                      <Text style={[styles.countryTxt, { fontSize: 9 * effectiveScale }]} numberOfLines={1}>
                        {countryName}
                      </Text>
                    ) : null}
                    {flagEmoji ? <Text style={{ fontSize: 11 * effectiveScale }}>{flagEmoji}</Text> : null}
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.portraitWrap,
              {
                width: 118 * effectiveScale,
                height: 118 * effectiveScale,
                borderRadius: 59 * effectiveScale,
                top: (economyVisible ? 92 : 84) * effectiveScale,
                marginLeft: -59 * effectiveScale,
                borderWidth: 2.5 * effectiveScale,
              },
            ]}
            onPress={onImageUpload}
            activeOpacity={onImageUpload ? 0.88 : 1}
            disabled={!onImageUpload || isAvatarUploading}
          >
            <Image
              source={photoUri ? { uri: photoUri } : AVATAR_PLACEHOLDER}
              placeholder={AVATAR_PLACEHOLDER}
              style={[styles.portrait, { borderRadius: 56 * effectiveScale }]}
              contentFit="cover"
              contentPosition="top center"
              cachePolicy="memory-disk"
              transition={200}
            />
            <View style={[styles.portraitRing, { borderRadius: 59 * effectiveScale, borderWidth: 1.5 * effectiveScale }]} />
            {isAvatarUploading ? (
              <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : null}
            {!photoUri && onImageUpload ? (
              <View style={[StyleSheet.absoluteFill, styles.uploadHint]}>
                <Ionicons name="add" size={26 * effectiveScale} color={PURPLE_SOFT} />
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={[styles.ballFlame, { top: (economyVisible ? 214 : 206) * effectiveScale }]}>
            <Text style={{ fontSize: 20 * effectiveScale }}>⚽</Text>
          </View>

          <GlassSidePanel scale={effectiveScale} side="left" onPress={onClubPress}>
            {isClubUpdating ? (
              <ActivityIndicator color={PURPLE_PRIMARY} size="small" />
            ) : clubLogo ? (
              <Image
                source={{ uri: clubLogo }}
                style={{ width: 40 * effectiveScale, height: 40 * effectiveScale }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons name="football-outline" size={26 * effectiveScale} color="rgba(168,85,247,0.5)" />
            )}
            {favoriteTeam?.trim() ? (
              <Text style={[styles.clubName, { fontSize: 8 * effectiveScale, marginTop: 6 * effectiveScale }]} numberOfLines={2}>
                {favoriteTeam}
              </Text>
            ) : (
              <Text style={[styles.clubPlaceholder, { fontSize: 8 * effectiveScale, marginTop: 6 * effectiveScale }]}>
                {t.profile.profileCardPickClub}
              </Text>
            )}
          </GlassSidePanel>

          <GlassSidePanel scale={effectiveScale} side="right" onPress={onStatsPress}>
            {isStatsUpdating ? (
              <ActivityIndicator color={PURPLE_PRIMARY} size="small" />
            ) : (
              <>
                <StatRow scale={effectiveScale} icon="person-outline" label="AGE" value={age?.toString() ?? '--'} />
                <StatRow scale={effectiveScale} icon="resize-outline" label="HGT" value={height?.toString() ?? '--'} />
                <StatRow scale={effectiveScale} icon="barbell-outline" label="WGT" value={weight?.toString() ?? '--'} />
                <StatRow scale={effectiveScale} icon="footsteps-outline" label="FOOT" value={foot?.toUpperCase() ?? '--'} />
              </>
            )}
          </GlassSidePanel>

          <View style={[styles.bottomMotto, { bottom: 14 * effectiveScale }]}>
            <Text style={[styles.mottoLine, { fontSize: 7 * effectiveScale, letterSpacing: 1.4 * effectiveScale }]}>
              {t.profile.profileCardMotto}
            </Text>
            <Text style={[styles.dreamLine, { fontSize: 9 * effectiveScale, marginTop: 3 * effectiveScale }]}>
              {t.profile.profileCardDream}
            </Text>
          </View>
        </GlassWrapper>

        <View pointerEvents="none" style={[styles.glassBorder, { borderRadius: radius }]} />
      </View>

      {economyVisible ? (
        <>
          <LevelInfoModal visible={showLevelInfo} onClose={closeLevelInfo} level={level!} />
          <CoinsInfoModal visible={showCoinsInfo} onClose={closeCoinsInfo} />
        </>
      ) : null}
    </View>
  );
});

export default ProfileCard;

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
  },
  cardShell: {
    position: 'relative',
    overflow: 'hidden',
    writingDirection: 'ltr',
  },
  ambientGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '2%',
    backgroundColor: 'rgba(124,58,237,0.22)',
    shadowColor: PURPLE_PRIMARY,
    shadowOpacity: 0.65,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
  cardGlass: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    zIndex: 3,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  glassShine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-12deg' }],
    zIndex: 1,
  },
  economyRow: {
    position: 'absolute',
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassChip: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  glassChipTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  lvlLabel: {
    color: PURPLE_SOFT,
    fontWeight: '800',
    letterSpacing: 1,
  },
  lvlNumber: {
    color: '#fff',
    fontWeight: '900',
  },
  coinTxt: {
    color: '#fff',
    fontWeight: '800',
  },
  topLeft: {
    position: 'absolute',
    zIndex: 4,
    maxWidth: '36%',
  },
  positionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  positionTag: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  positionAbbr: {
    color: PURPLE_PRIMARY,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 1,
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  topRight: {
    position: 'absolute',
    zIndex: 4,
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  arName: {
    color: TEXT_PRIMARY,
    fontWeight: '800',
    flexShrink: 1,
  },
  cardUsername: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
    textAlign: 'right',
  },
  countryPill: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: '100%',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
    paddingHorizontal: 2,
  },
  countryTxt: {
    color: PURPLE_SOFT,
    fontWeight: '700',
    flexShrink: 1,
  },
  portraitWrap: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    zIndex: 5,
    borderColor: 'rgba(168,85,247,0.75)',
    backgroundColor: 'rgba(5,1,13,0.35)',
    shadowColor: PURPLE_PRIMARY,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  portraitRing: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  uploadOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHint: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,1,13,0.35)',
  },
  ballFlame: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 5,
    alignItems: 'center',
  },
  sidePanel: {
    position: 'absolute',
    zIndex: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sidePanelInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubName: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '700',
    textAlign: 'center',
  },
  clubPlaceholder: {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '600',
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statIconWrap: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statTextCol: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: 'rgba(196,181,253,0.55)',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statValue: {
    color: TEXT_PRIMARY,
    fontWeight: '800',
  },
  bottomMotto: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  mottoLine: {
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dreamLine: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
