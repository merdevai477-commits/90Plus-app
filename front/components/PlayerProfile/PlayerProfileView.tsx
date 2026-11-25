import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import type { Player365LastMatch } from '../../services/apiFootball';
import { useTranslation } from '../../src/i18n';
import { getCountryFlagUri } from '../../utils/countryFlagUri';
import { useAppFont } from '../../utils/fontSetup';
import { toFullscreenPhotoUrl } from '../../utils/scores365AthletePhoto';
import ImageViewerModal from '../common/ImageViewerModal';
import TeamBadge from '../common/TeamBadge';
import { PP_ICON, PP_STADIUM } from './assets';
import { getPPColors, ratingTone, type PPColors } from './theme';
import type {
  PlayerCompetitionStatRow,
  PlayerProfileViewModel,
  PlayerSeasonSummary,
  PlayerTransferRow,
} from './types';

const DESIGN_WIDTH = 430;
/** Figma 1855:223 hero frame — keep room for cutout + identity */
const HERO_BODY = 318;
const HEADER_BAR_HEIGHT = 44;

function useRtl() {
  const { language } = useTranslation();
  return language === 'ar';
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

export function usePlayerHeaderHeight(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 10) + HEADER_BAR_HEIGHT;
}

export function PlayerProfileHeader({
  onBack,
  scrollY,
  title,
  colors,
}: {
  onBack: () => void;
  scrollY?: Animated.Value;
  title?: string;
  colors?: PPColors;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const C = colors ?? getPPColors(isDark);
  void title; // optional scroll title — Figma hero keeps identity only

  const barOpacity = scrollY
    ? scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, 1], extrapolate: 'clamp' })
    : 0;

  return (
    <View
      style={[
        styles.header,
        { paddingTop: Math.max(insets.top, 10), height: Math.max(insets.top, 10) + HEADER_BAR_HEIGHT },
        scrollY ? styles.headerOverlay : null,
      ]}
    >
      {scrollY ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: C.hero, opacity: barOpacity }]}
        />
      ) : null}

      {/* Back always on the physical left */}
      <View
        style={[
          styles.headerTrailing,
          {
            flexDirection: 'row',
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(35,14,72,0.4)',
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 8,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.playerCareer.goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Image
            source={PP_ICON.arrowBack}
            style={styles.backIcon}
            contentFit="contain"
          />
        </Pressable>
      </View>
    </View>
  );
}

export function PlayerProfileStatus({
  loading,
  message,
  actionLabel,
  onBack,
}: {
  loading?: boolean;
  message: string;
  actionLabel?: string;
  onBack: () => void;
}) {
  const { isDark } = useResolvedAppScheme();
  const C = getPPColors(isDark);
  const fontSemi = useAppFont(600);
  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <PlayerProfileHeader onBack={onBack} colors={C} />
      <View style={styles.statusBody}>
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} />
        ) : (
          <Ionicons name="cloud-offline-outline" size={48} color={C.muted} />
        )}
        <Text style={[styles.statusText, { color: C.statusText, fontFamily: fontSemi }]}>{message}</Text>
        {!loading && actionLabel ? (
          <Pressable
            style={[styles.statusBtn, { backgroundColor: C.primary }]}
            onPress={onBack}
          >
            <Text style={[styles.statusBtnText, { fontFamily: fontSemi }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface PlayerProfileViewProps {
  vm: PlayerProfileViewModel;
  statsContent?: ReactNode;
  /** @deprecated Tabs removed; kept for call-site compat. */
  initialTab?: 'stats' | 'overview';
  refreshControl?: ReactElement<RefreshControlProps>;
  onBack: () => void;
  onSelectSeason?: (seasonKey: string) => void;
  socials?: {
    facebookUrl: string | null;
    instagramUrl: string | null;
    twitterUrl?: string | null;
  } | null;
}

export default function PlayerProfileView({
  vm,
  statsContent: _statsContent,
  refreshControl,
  onBack,
  onSelectSeason,
  socials,
}: PlayerProfileViewProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = usePlayerHeaderHeight();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const rtl = useRtl();
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const { isDark } = useResolvedAppScheme();
  const C = useMemo(() => getPPColors(isDark), [isDark]);
  const fontBold = useAppFont(700);
  const fontExtraBold = useAppFont(800);
  const fontSemi = useAppFont(600);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    setPhotoIndex(0);
  }, [vm.photoKey]);

  const scale = Math.min(width / DESIGN_WIDTH, 1.08);
  const heroHeight = Math.round(HERO_BODY * scale);
  const pad = 20;
  const photoUri = vm.photoCandidates[photoIndex];
  const photoFailed = photoIndex >= vm.photoCandidates.length;
  const flagUri = vm.nationality ? getCountryFlagUri(vm.nationality, null, 80) : null;
  const hasSocials = Boolean(socials?.instagramUrl || socials?.facebookUrl);
  const recentMatches = useMemo(
    () => (vm.lastMatches ?? []).filter((m) => m.played && m.rating != null).slice(0, 3),
    [vm.lastMatches],
  );

  const cardShadow = {
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.35 : 0.2,
    shadowRadius: 2,
    elevation: 3,
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          refreshControl
            ? React.cloneElement(refreshControl, { progressViewOffset: headerHeight })
            : undefined
        }
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Hero — stadium plate + cutout looking at identity */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <View style={styles.heroStage} pointerEvents="none">
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.hero }]} />
            <Image
              source={PP_STADIUM}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="center"
            />
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(18,10,34,0.7)', 'rgba(18,10,34,0.18)', 'transparent']
                  : ['rgba(249,246,254,0.78)', 'rgba(249,246,254,0.28)', 'transparent']
              }
              locations={[0.12, 0.38, 0.7]}
              start={rtl ? { x: 1, y: 0.08 } : { x: 0, y: 0.08 }}
              end={rtl ? { x: 0.28, y: 0.92 } : { x: 0.72, y: 0.92 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Cutout stays on the photo edge so he faces the identity panel with a clear gap */}
          <Pressable
            style={[
              styles.heroCutoutWrap,
              {
                width: Math.round(Math.min(width * 1.0, 270 * scale)),
                height: Math.round(heroHeight * 1.18),
                bottom: Math.round(-1 * scale),
              },
              rtl
                ? { left: Math.round(9 * scale) }
                : { right: Math.round(4 * scale) },
            ]}
            onPress={() => photoUri && !photoFailed && setViewerOpen(true)}
            accessibilityRole="imagebutton"
          >
            {photoUri && !photoFailed ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.heroCutout}
                contentFit="contain"
                contentPosition="bottom"
                cachePolicy="memory-disk"
                priority="high"
                transition={280}
                recyclingKey={`${vm.photoKey}-${photoIndex}`}
                onError={() =>
                  setPhotoIndex((i) =>
                    i + 1 < vm.photoCandidates.length ? i + 1 : vm.photoCandidates.length,
                  )
                }
              />
            ) : (
              <View style={styles.heroPhotoFallback}>
                <Ionicons name="person" size={72} color="rgba(255,255,255,0.35)" />
              </View>
            )}
          </Pressable>

          <View
            style={[
              styles.heroIdentity,
              {
                top: Math.max(insets.top, 10) + Math.round(22 * scale),
                // Wider panel so long names (e.g. ليونيل ميسي) stay readable over the cutout
                width: Math.round(Math.min(width * 0.5, 220 * scale)),
                gap: Math.round(10 * scale),
                alignItems: 'flex-end',
              },
              rtl
                ? { right: Math.round(14 * scale) }
                : { left: Math.round(14 * scale) },
            ]}
          >
            <View
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
                gap: Math.round(10 * scale),
              }}
            >
              {vm.nationality ? (
                <View style={styles.heroMetaRow}>
                  <Text
                    style={[
                      styles.heroNation,
                      {
                        fontFamily: fontSemi,
                        color: isDark ? C.ink : '#313131',
                        fontSize: Math.round(15 * scale),
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {vm.nationality}
                  </Text>
                  {flagUri ? (
                    <Image source={{ uri: flagUri }} style={styles.flag} contentFit="cover" />
                  ) : null}
                </View>
              ) : null}

              <View style={styles.heroNameRow}>
                <Text
                  style={[
                    styles.heroName,
                    {
                      fontFamily: fontExtraBold,
                      color: isDark ? C.ink : '#0a0a0a',
                      fontSize: Math.round(28 * scale),
                      lineHeight: Math.round(32 * scale),
                      letterSpacing: -0.2,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {vm.name}
                </Text>
                <Image source={PP_ICON.verified} style={styles.verifiedBadge} contentFit="contain" />
              </View>

              {vm.clubName ? (
                <View style={styles.heroClubRow}>
                  <Text
                    style={[
                      styles.heroClub,
                      {
                        fontFamily: fontExtraBold,
                        color: isDark ? C.ink : '#0a0a0a',
                        fontSize: Math.round(18 * scale),
                        lineHeight: Math.round(23 * scale),
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {vm.clubName}
                  </Text>
                  <TeamBadge
                    name={vm.clubName}
                    logo={vm.clubLogo || undefined}
                    size={Math.round(38 * scale)}
                    color="transparent"
                    highQuality
                  />
                </View>
              ) : null}
            </View>

            {hasSocials ? (
              <View style={styles.heroSocials}>
                {socials?.facebookUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={pc.facebook}
                    onPress={() => Linking.openURL(socials.facebookUrl!).catch(() => undefined)}
                    style={[styles.socialPill, styles.socialPillFilled, { backgroundColor: C.primary }]}
                  >
                    <Text style={[styles.socialPillText, { fontFamily: fontBold, color: '#fff' }]}>
                      {pc.facebook}
                    </Text>
                    <Image source={PP_ICON.facebookPill} style={styles.socialPillIcon} contentFit="contain" />
                  </Pressable>
                ) : null}
                {socials?.instagramUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={pc.instagram}
                    onPress={() => Linking.openURL(socials.instagramUrl!).catch(() => undefined)}
                    style={[
                      styles.socialPill,
                      styles.socialPillOutline,
                      { borderColor: C.primary, backgroundColor: C.card },
                    ]}
                  >
                    <Text style={[styles.socialPillText, { fontFamily: fontBold, color: C.primary }]}>
                      {pc.instagram}
                    </Text>
                    <Image source={PP_ICON.instagramPill} style={styles.socialPillIcon} contentFit="contain" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* Attributes — overlaps the cutout like Figma 1855:91 */}
        <View
          style={[
            styles.strip,
            cardShadow,
            {
              marginHorizontal: pad,
              marginTop: -28,
              backgroundColor: C.card,
              flexDirection: rtl ? 'row' : 'row-reverse',
            },
          ]}
        >
          <AttrCell
            label={pc.position}
            value={vm.position || '—'}
            icon={PP_ICON.position}
            iconSize={21}
            C={C}
          />
          <AttrCell
            label={pc.height}
            value={vm.height || '—'}
            icon={PP_ICON.height}
            iconSize={16}
            C={C}
          />
          <AttrCell
            label={pc.age}
            value={vm.age != null ? String(vm.age) : '—'}
            icon={PP_ICON.cake}
            iconSize={16}
            C={C}
          />
          <AttrCell
            label={pc.nationality}
            value={vm.nationality || '—'}
            leading={
              flagUri ? <Image source={{ uri: flagUri }} style={styles.flag} contentFit="cover" /> : null
            }
            C={C}
          />
        </View>

        <View style={{ paddingHorizontal: pad, marginTop: 24, gap: 20 }}>
          {/* Season statistics — Figma 2431:17457 */}
          {vm.season ? (
            <SeasonStatsCard
              season={vm.season}
              seasonLabel={vm.seasonLabel}
              seasons={vm.seasons}
              selectedSeasonKey={vm.selectedSeasonKey}
              onSelectSeason={onSelectSeason}
              C={C}
              rtl={rtl}
              cardShadow={cardShadow}
            />
          ) : null}

          {/* Last matches — Figma 2431:17519 */}
          {recentMatches.length > 0 ? (
            <LastMatchesCard matches={recentMatches} C={C} rtl={rtl} cardShadow={cardShadow} />
          ) : null}

          {/* Per competition for selected season — before transfers */}
          {vm.competitions.length > 0 ? (
            <CompetitionsCard competitions={vm.competitions} C={C} rtl={rtl} cardShadow={cardShadow} />
          ) : null}

          {/* Transfers — Figma 2431:17554 */}
          {vm.transfers.length > 0 ? (
            <View style={{ gap: 16, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
              <View
                style={[
                  styles.sectionTitleRow,
                  { flexDirection: rtl ? 'row-reverse' : 'row', alignSelf: rtl ? 'flex-end' : 'flex-start' },
                ]}
              >
                <Text style={[styles.sectionTitleLg, { fontFamily: fontSemi, color: C.ink }]}>
                  {pc.transferHistory}
                </Text>
                <Image source={PP_ICON.transfers} style={styles.sectionIcon} contentFit="contain" />
              </View>
              <View
                style={[
                  styles.transferCard,
                  cardShadow,
                  { backgroundColor: C.card, alignSelf: 'stretch' },
                ]}
              >
                {vm.transfers.slice(0, 8).map((tr, idx, arr) => (
                  <TransferRow
                    key={tr.key}
                    row={tr}
                    rtl={rtl}
                    last={idx === arr.length - 1}
                    first={idx === 0}
                    feeLabel={pc.transferFee}
                    C={C}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <PlayerProfileHeader onBack={onBack} scrollY={scrollY} colors={C} />

      <ImageViewerModal
        visible={viewerOpen && !!photoUri && !photoFailed}
        imageUrl={toFullscreenPhotoUrl(photoUri) || photoUri || ''}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

function AttrCell({
  label,
  value,
  icon,
  iconSize = 16,
  leading,
  C,
}: {
  label: string;
  value: string;
  icon?: number;
  iconSize?: number;
  leading?: ReactNode;
  C: PPColors;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  // Figma 1855:91: label above; value row is text then icon (icon on the right).
  return (
    <View style={styles.attrCell}>
      <Text style={[styles.attrLabel, { fontFamily: fontSemi, color: C.muted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.attrValueRow}>
        <Text style={[styles.attrValue, { fontFamily: fontBold, color: C.ink }]} numberOfLines={1}>
          {value}
        </Text>
        {leading ??
          (icon ? (
            <Image source={icon} style={{ width: iconSize, height: iconSize }} contentFit="contain" />
          ) : null)}
      </View>
    </View>
  );
}

function SeasonStatCell({
  value,
  label,
  icon,
  C,
  valueSize = 25,
  labelSize = 12,
  cards,
}: {
  value: string;
  label: string;
  icon?: number;
  C: PPColors;
  valueSize?: number;
  labelSize?: number;
  cards?: boolean;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  return (
    <View style={styles.seasonStatCell}>
      <Text style={[styles.seasonStatValue, { fontFamily: fontBold, color: C.ink, fontSize: valueSize }]}>
        {value}
      </Text>
      <View style={styles.seasonStatLabelRow}>
        <Text
          style={[styles.seasonStatLabel, { fontFamily: fontSemi, color: C.muted, fontSize: labelSize }]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {cards ? (
          <View style={styles.cardPair}>
            <View style={[styles.miniCard, { backgroundColor: C.cardYellow, transform: [{ rotate: '-25deg' }] }]} />
            <View
              style={[
                styles.miniCard,
                styles.miniCardOverlap,
                { backgroundColor: C.cardRed, transform: [{ rotate: '-25deg' }] },
              ]}
            />
          </View>
        ) : icon ? (
          <Image source={icon} style={styles.seasonStatIcon} contentFit="contain" />
        ) : null}
      </View>
    </View>
  );
}

function SeasonStatsCard({
  season,
  seasonLabel,
  seasons,
  selectedSeasonKey,
  onSelectSeason,
  C,
  rtl,
  cardShadow,
}: {
  season: PlayerSeasonSummary;
  seasonLabel: string | null;
  seasons: { key: string; label: string }[];
  selectedSeasonKey: string | null;
  onSelectSeason?: (seasonKey: string) => void;
  C: PPColors;
  rtl: boolean;
  cardShadow: object;
}) {
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);
  const [pickerOpen, setPickerOpen] = useState(false);
  const rowDir = rtl ? 'row' : 'row-reverse';
  const cardsValue = `${fmtNum(season.yellowCards)} / ${fmtNum(season.redCards)}`;

  return (
    <View style={{ gap: 16, alignSelf: 'stretch' }}>
      <View style={[styles.sectionRow, { flexDirection: 'row' }]}>
        <Pressable
          onPress={() => seasons.length > 1 && setPickerOpen((o) => !o)}
          hitSlop={8}
          style={[styles.seasonTap, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: pickerOpen }}
        >
          <Text style={[styles.seasonLabelMuted, { fontFamily: fontReg, color: C.muted }]}>
            {seasonLabel ?? '—'}
          </Text>
          {seasons.length > 1 ? (
            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} />
          ) : null}
        </Pressable>
        <View style={[styles.sectionTitleRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.sectionTitleLg, { fontFamily: fontSemi, color: C.ink }]}>
            {pc.seasonStatsTitle}
          </Text>
          <Image source={PP_ICON.seasonStats} style={styles.sectionIcon} contentFit="contain" />
        </View>
      </View>

      {pickerOpen ? (
        <View style={[styles.seasonDropdown, cardShadow, { backgroundColor: C.card, borderColor: C.border }]}>
          {seasons.map((item) => {
            const active = item.key === selectedSeasonKey;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onSelectSeason?.(item.key);
                  setPickerOpen(false);
                }}
                style={[styles.seasonOption, active && { backgroundColor: C.pale }]}
              >
                <Text
                  style={{
                    fontFamily: active ? fontBold : fontSemi,
                    color: active ? C.primary : C.ink,
                    fontSize: 14,
                    textAlign: rtl ? 'right' : 'left',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.seasonCard, cardShadow, { backgroundColor: C.card }]}>
        {/* RTL: first cell sits on the right — matches / goals / assists */}
        <View style={[styles.seasonTopRow, { flexDirection: rowDir, borderBottomColor: C.pale }]}>
          <SeasonStatCell
            value={fmtNum(season.matches)}
            label={pc.statMatches}
            icon={PP_ICON.court}
            C={C}
          />
          <View style={[styles.seasonDivider, { backgroundColor: C.pale }]} />
          <SeasonStatCell value={fmtNum(season.goals)} label={pc.statGoals} icon={PP_ICON.goals} C={C} />
          <View style={[styles.seasonDivider, { backgroundColor: C.pale }]} />
          <SeasonStatCell
            value={fmtNum(season.assists)}
            label={pc.statAssists}
            icon={PP_ICON.court}
            C={C}
          />
        </View>
        {/* RTL right→left: minutes / shots / chances / cards */}
        <View style={[styles.seasonBottomRow, { flexDirection: rowDir }]}>
          <SeasonStatCell
            value={fmtNum(season.minutes)}
            label={pc.minutesPlayed}
            icon={PP_ICON.time}
            C={C}
            valueSize={18}
            labelSize={10}
          />
          <View style={[styles.seasonDivider, { backgroundColor: C.pale }]} />
          <SeasonStatCell
            value={fmtNum(season.shotsOnTarget)}
            label={pc.shotsOnTarget}
            icon={PP_ICON.goalNet}
            C={C}
            valueSize={18}
            labelSize={10}
          />
          <View style={[styles.seasonDivider, { backgroundColor: C.pale }]} />
          <SeasonStatCell
            value={fmtNum(season.chancesCreated)}
            label={pc.chancesCreated}
            icon={PP_ICON.sneaker}
            C={C}
            valueSize={18}
            labelSize={10}
          />
          <View style={[styles.seasonDivider, { backgroundColor: C.pale }]} />
          <SeasonStatCell
            value={cardsValue}
            label={pc.cardsYellowRed}
            cards
            C={C}
            valueSize={18}
            labelSize={10}
          />
        </View>
      </View>
    </View>
  );
}

function fmtMatchDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y} - ${m} - ${day}`;
}

function CompetitionsCard({
  competitions,
  C,
  rtl,
  cardShadow,
}: {
  competitions: PlayerCompetitionStatRow[];
  C: PPColors;
  rtl: boolean;
  cardShadow: object;
}) {
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const rowDir = rtl ? 'row-reverse' : 'row';

  return (
    <View style={{ gap: 16, alignItems: rtl ? 'flex-end' : 'flex-start', alignSelf: 'stretch' }}>
      <View
        style={[
          styles.sectionTitleRow,
          { flexDirection: rowDir, alignSelf: rtl ? 'flex-end' : 'flex-start' },
        ]}
      >
        <Text style={[styles.sectionTitleLg, { fontFamily: fontSemi, color: C.ink }]}>
          {pc.perCompetition}
        </Text>
        <Image source={PP_ICON.court} style={styles.sectionIcon} contentFit="contain" />
      </View>

      {competitions.map((c) => (
        <View
          key={c.key}
          style={[styles.compCard, cardShadow, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <View style={[styles.compHeader, { flexDirection: rowDir }]}>
            {c.competitionLogo ? (
              <Image
                source={{ uri: c.competitionLogo }}
                style={styles.compLogo}
                contentFit="contain"
                cachePolicy="memory-disk"
                recyclingKey={c.competitionLogo}
                transition={0}
              />
            ) : (
              <View style={[styles.compLogoFallback, { backgroundColor: C.pale }]}>
                <Ionicons name="trophy-outline" size={14} color={C.primary} />
              </View>
            )}
            <Text
              style={[
                styles.compName,
                { fontFamily: fontSemi, color: C.ink, textAlign: rtl ? 'right' : 'left' },
              ]}
              numberOfLines={1}
            >
              {c.competitionName}
            </Text>
            {c.rating != null && Number.isFinite(c.rating) ? (
              <View style={[styles.compRatingPill, { backgroundColor: ratingTone(c.rating) }]}>
                <Text style={[styles.compRatingText, { fontFamily: fontBold, color: C.ratingText }]}>
                  {c.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.compStatsRow, { flexDirection: rowDir }]}>
            <CompStatCell value={fmtNum(c.appearances)} label={pc.appearances} C={C} />
            <CompStatCell value={fmtNum(c.goals)} label={pc.goals} C={C} />
            <CompStatCell value={fmtNum(c.assists)} label={pc.assists} C={C} />
            {c.minutes != null ? (
              <CompStatCell value={fmtNum(c.minutes)} label={pc.minutes} C={C} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function CompStatCell({
  value,
  label,
  C,
}: {
  value: string;
  label: string;
  C: PPColors;
}) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  return (
    <View style={styles.compStat}>
      <Text style={[styles.compStatValue, { fontFamily: fontBold, color: C.ink }]}>{value}</Text>
      <Text style={[styles.compStatLabel, { fontFamily: fontSemi, color: C.muted }]}>{label}</Text>
    </View>
  );
}

function LastMatchesCard({
  matches,
  C,
  rtl,
  cardShadow,
}: {
  matches: Player365LastMatch[];
  C: PPColors;
  rtl: boolean;
  cardShadow: object;
}) {
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const { isDark } = useResolvedAppScheme();
  const fontSemi = useAppFont(600);
  const fontBold = useAppFont(700);
  const fontExtraBold = useAppFont(800);
  const ordered = rtl ? matches : [...matches].reverse();
  const heavyInk = isDark ? C.ink : '#0a0a0a';

  return (
    <View style={{ gap: 16, alignItems: rtl ? 'flex-end' : 'flex-start', alignSelf: 'stretch' }}>
      <View
        style={[
          styles.sectionTitleRow,
          { flexDirection: rtl ? 'row-reverse' : 'row', alignSelf: rtl ? 'flex-end' : 'flex-start' },
        ]}
      >
        <Text style={[styles.sectionTitleLg, { fontFamily: fontSemi, color: C.ink }]}>
          {pc.lastMatches}
        </Text>
        <Image source={PP_ICON.history} style={styles.sectionIcon} contentFit="contain" />
      </View>
      <View
        style={[
          styles.lastMatchesCard,
          cardShadow,
          {
            backgroundColor: C.card,
            flexDirection: rtl ? 'row' : 'row-reverse',
            alignSelf: 'stretch',
          },
        ]}
      >
        {ordered.map((match, idx) => {
          const rating = match.rating ?? 0;
          const tone = match.ratingColor || ratingTone(rating);
          return (
            <React.Fragment key={match.gameId}>
              {idx > 0 ? <View style={[styles.matchDivider, { backgroundColor: C.pale }]} /> : null}
              <View style={styles.matchCell}>
                <View
                  style={[
                    styles.matchTop,
                    { flexDirection: rtl ? 'row-reverse' : 'row' },
                  ]}
                >
                  <View style={[styles.ratingPill, { backgroundColor: tone }]}>
                    <Text
                      style={[styles.ratingPillText, { fontFamily: fontBold, color: C.ratingText }]}
                      allowFontScaling={false}
                    >
                      {rating.toFixed(1)}
                    </Text>
                  </View>
                  <TeamBadge
                    name={match.opponentName || '—'}
                    logo={match.opponentLogo || undefined}
                    size={40}
                    color="transparent"
                    highQuality
                  />
                </View>
                <View style={styles.matchMeta}>
                  <Text style={[styles.matchDate, { fontFamily: fontSemi, color: C.muted }]}>
                    {fmtMatchDate(match.startTime)}
                  </Text>
                  <Text
                    style={[styles.matchOpponent, { fontFamily: fontExtraBold, color: heavyInk }]}
                    numberOfLines={1}
                  >
                    {shortOpponent(match.opponentName)}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

export function SectionHeader({
  icon,
  title,
  trailing,
  trailingNode,
  rtl,
  colors,
}: {
  icon: number;
  title: string;
  trailing?: string | null;
  trailingNode?: ReactNode;
  rtl: boolean;
  /** When the host screen is locked to dark (match player profile), pass dark tokens explicitly. */
  colors?: PPColors;
}) {
  const { isDark } = useResolvedAppScheme();
  const C = colors ?? getPPColors(isDark);
  const fontBold = useAppFont(700);
  return (
    <View style={[styles.legacySectionHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      <View style={[styles.attrValueRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
        <Image source={icon} style={{ width: 20, height: 20 }} contentFit="contain" />
        <Text style={[styles.sectionTitle, { fontFamily: fontBold, color: C.ink }]}>{title}</Text>
      </View>
      {trailingNode ??
        (trailing ? (
          <Text style={{ fontFamily: fontBold, color: C.primary, fontSize: 12 }}>{trailing}</Text>
        ) : null)}
    </View>
  );
}

function shortOpponent(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return parts.slice(0, 2).join(' ');
}

function TransferRow({
  row: tr,
  rtl,
  first,
  last,
  feeLabel,
  C,
}: {
  row: PlayerTransferRow;
  rtl: boolean;
  first: boolean;
  last: boolean;
  feeLabel: string;
  C: PPColors;
}) {
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);
  const euro = tr.price?.trim().startsWith('€') ?? false;
  const priceText = euro ? tr.price!.trim().replace(/^€\s*/, '') : tr.price;

  return (
    <View
      style={[
        styles.transferRow,
        { flexDirection: rtl ? 'row-reverse' : 'row' },
        !last && { borderBottomWidth: 1, borderBottomColor: C.pale },
      ]}
    >
      <View style={styles.timelineCol}>
        <View
          style={[
            styles.timelineLine,
            { backgroundColor: C.timelineInactive },
            first && { opacity: 0 },
          ]}
        />
        <Image
          source={tr.active || first ? PP_ICON.timelineDotActive : PP_ICON.timelineDot}
          style={styles.timelineDot}
          contentFit="contain"
        />
        <View
          style={[
            styles.timelineLine,
            { backgroundColor: C.timelineInactive },
            last && { opacity: 0 },
          ]}
        />
      </View>

      <View style={[styles.transferBody, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View
          style={[
            styles.transferClubBlock,
            { flexDirection: rtl ? 'row-reverse' : 'row', flex: 1 },
          ]}
        >
          <TeamBadge name={tr.clubName} logo={tr.clubLogo || undefined} size={25} color="transparent" />
          <View style={{ alignItems: rtl ? 'flex-end' : 'flex-start', flexShrink: 1 }}>
            <Text
              style={[styles.transferClub, { fontFamily: fontSemi, color: C.ink }]}
              numberOfLines={1}
            >
              {tr.clubName}
            </Text>
            {tr.date ? (
              <Text style={[styles.transferDate, { fontFamily: fontReg, color: C.muted }]}>
                {tr.date}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end', minWidth: 56 }}>
          {priceText ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {euro ? (
                  <Image source={PP_ICON.euro} style={styles.euroIcon} contentFit="contain" />
                ) : null}
                <Text style={[styles.transferPrice, { fontFamily: fontSemi, color: C.transferFee }]}>
                  {priceText}
                </Text>
              </View>
              <Text style={[styles.transferFee, { fontFamily: fontSemi, color: C.muted }]}>
                {feeLabel}
              </Text>
            </>
          ) : tr.title ? (
            <Text style={[styles.transferPrice, { fontFamily: fontSemi, color: C.transferFee }]}>
              {tr.title}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  headerTrailing: { alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 28, textAlign: 'center' },
  backBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  backBtnPressed: { opacity: 0.7 },
  backIcon: { width: 24, height: 24 },

  statusBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  statusText: { fontSize: 14, textAlign: 'center' },
  statusBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  statusBtnText: { color: '#fff', fontSize: 14 },

  hero: { width: '100%', overflow: 'visible', zIndex: 1 },
  heroStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroCutoutWrap: {
    position: 'absolute',
    zIndex: 3,
    // Soft contact shadow so the cutout sits on the stadium plate
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroCutout: { width: '100%', height: '100%' },
  heroPhotoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroIdentity: { position: 'absolute', zIndex: 4 },
  /** Figma rows are LTR DOM order [label][icon] packed to the end of the panel */
  heroMetaRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '100%',
  },
  heroNation: { textAlign: 'right' },
  heroNameRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 6,
    width: '100%',
  },
  heroName: { flexShrink: 1, flexGrow: 1, textAlign: 'right' },
  verifiedBadge: { width: 22, height: 22, marginTop: 4 },
  heroClubRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: '100%',
  },
  heroClub: { flexShrink: 1, textAlign: 'right' },
  heroSocials: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 2,
  },
  socialPill: {
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 98,
  },
  socialPillFilled: {},
  socialPillOutline: { borderWidth: 1 },
  socialPillText: { fontSize: 12, textAlign: 'center' },
  socialPillIcon: { width: 22, height: 22 },

  strip: {
    height: 68,
    borderRadius: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  attrCell: { alignItems: 'center', gap: 6, flexGrow: 1, flexBasis: 0 },
  attrLabel: { fontSize: 9, textAlign: 'center', width: '100%' },
  attrValueRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  attrValue: { fontSize: 15 },
  flag: { width: 16, height: 16, borderRadius: 2 },

  sectionRow: { alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sectionTitle: { fontSize: 16 },
  sectionTitleRow: { alignItems: 'center', gap: 8 },
  sectionTitleLg: { fontSize: 18 },
  sectionIcon: { width: 24, height: 24 },
  seasonTap: { alignItems: 'center' },
  seasonLabelMuted: { fontSize: 13 },
  seasonDropdown: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  seasonOption: { paddingHorizontal: 14, paddingVertical: 12 },

  seasonCard: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 24,
    gap: 16,
    alignSelf: 'stretch',
  },
  seasonTopRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  seasonBottomRow: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  seasonDivider: { width: 1, height: 36, alignSelf: 'center' },
  seasonStatCell: { flex: 1, alignItems: 'center', gap: 4, minWidth: 0 },
  seasonStatValue: { textAlign: 'center', width: '100%' },
  seasonStatLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  seasonStatLabel: { textAlign: 'center', flexShrink: 1 },
  seasonStatIcon: { width: 16, height: 16 },
  cardPair: { width: 18, height: 16, position: 'relative' },
  miniCard: { width: 10, height: 13, borderRadius: 2, position: 'absolute', left: 0, top: 1 },
  miniCardOverlap: { left: 4 },

  lastMatchesCard: {
    borderRadius: 16,
    minHeight: 141,
    paddingHorizontal: 18,
    paddingVertical: 21,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchCell: { flex: 1, alignItems: 'center', justifyContent: 'space-between', minHeight: 99, gap: 12 },
  matchTop: { alignItems: 'flex-start', justifyContent: 'flex-end', gap: 8, width: '100%' },
  ratingPill: {
    width: 54,
    height: 28,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ratingPillText: {
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    // Cairo/Inter optical center sits high inside fixed pills on iOS
    ...Platform.select({ ios: { transform: [{ translateY: 1.5 }] }, default: {} }),
  },
  matchMeta: { alignItems: 'center', gap: 4, width: '100%' },
  matchDate: { fontSize: 11, textAlign: 'center', width: '100%' },
  matchOpponent: { fontSize: 18, textAlign: 'center', width: '100%' },
  matchDivider: { width: 1, height: 81, alignSelf: 'center' },

  compCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignSelf: 'stretch',
    gap: 12,
  },
  compHeader: { alignItems: 'center', gap: 10 },
  compLogo: { width: 24, height: 24 },
  compLogoFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compName: { fontSize: 14, flex: 1 },
  compRatingPill: {
    minWidth: 42,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  compRatingText: { fontSize: 12 },
  compStatsRow: { justifyContent: 'space-between' },
  compStat: { alignItems: 'center', flex: 1 },
  compStatValue: { fontSize: 16 },
  compStatLabel: { fontSize: 11, marginTop: 2 },

  transferCard: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  transferRow: { minHeight: 57, alignItems: 'stretch', gap: 10 },
  timelineCol: { width: 19, alignItems: 'center' },
  timelineLine: { flex: 1, width: 1 },
  timelineDot: { width: 19, height: 18 },
  transferBody: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  transferClubBlock: { alignItems: 'center', gap: 6, flexShrink: 1 },
  transferClub: { fontSize: 15 },
  transferDate: { fontSize: 11, marginTop: 4 },
  transferPrice: { fontSize: 15 },
  transferFee: { fontSize: 10, marginTop: 4 },
  euroIcon: { width: 16, height: 16 },

  legacySectionHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
});
