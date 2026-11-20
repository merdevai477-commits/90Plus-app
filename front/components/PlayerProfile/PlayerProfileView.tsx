import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
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
  PlayerDetailedStats,
  PlayerProfileViewModel,
  PlayerTransferRow,
} from './types';

const DESIGN_WIDTH = 430;
const HERO_BODY = 398;
const HEADER_BAR_HEIGHT = 44;

function useRtl() {
  const { language } = useTranslation();
  return language === 'ar';
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: name.trim(), last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function handleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const last = path.split('/').filter(Boolean).pop();
    if (!last) return null;
    return last.startsWith('@') ? last : `@${last}`;
  } catch {
    return null;
  }
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
  const rtl = useRtl();
  const fontBold = useAppFont(700);
  const pageTitle = title ?? t.playerCareer.pageTitle;

  const barOpacity = scrollY
    ? scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, 1], extrapolate: 'clamp' })
    : 0;

  return (
    <View
      style={[
        styles.header,
        { paddingTop: Math.max(insets.top, 10), height: Math.max(insets.top, 10) + HEADER_BAR_HEIGHT },
        scrollY ? styles.headerOverlay : null,
        { flexDirection: rtl ? 'row' : 'row-reverse' },
      ]}
    >
      {scrollY ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: C.hero, opacity: barOpacity }]}
        />
      ) : null}

      <View style={[styles.headerTrailing, { flexDirection: rtl ? 'row' : 'row-reverse' }]}>
        <Text
          style={[styles.headerTitle, { fontFamily: fontBold, color: C.softLilac }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {pageTitle}
        </Text>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.playerCareer.goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Image
            source={PP_ICON.arrowBack}
            style={[styles.backIcon, !rtl && { transform: [{ scaleX: -1 }] }]}
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
  socials?: { facebookUrl: string | null; instagramUrl: string | null } | null;
}

export default function PlayerProfileView({
  vm,
  statsContent,
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
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setPhotoIndex(0);
  }, [vm.photoKey]);

  const scale = Math.min(width / DESIGN_WIDTH, 1.08);
  const heroHeight = Math.round(HERO_BODY * scale);
  const pad = 20;
  const { first, last } = splitName(vm.name);
  const photoUri = vm.photoCandidates[photoIndex];
  const photoFailed = photoIndex >= vm.photoCandidates.length;
  const flagUri = vm.nationality ? getCountryFlagUri(vm.nationality, null, 80) : null;
  const subline = [vm.position, vm.clubName, vm.nationality].filter(Boolean).join(' · ');

  const cardShadow = {
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.35 : 0.2,
    shadowRadius: 2,
    elevation: 3,
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />
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
        {/* Hero — Figma 1855:12 photo + identity panel */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.hero }]} />
          <Image source={PP_STADIUM} style={[StyleSheet.absoluteFill, { opacity: 0.2 }]} contentFit="cover" />
          <View
            style={[
              styles.heroSide,
              { backgroundColor: C.heroSide, width: Math.round(160 * scale) },
              rtl ? { right: 0 } : { left: 0 },
            ]}
          />

          {/* Photo: Figma 308×287, left in RTL / right in LTR, bottom-aligned */}
          <Pressable
            style={[
              styles.heroPhotoWrap,
              {
                width: Math.round(308 * scale),
                height: Math.round(287 * scale),
                bottom: -8,
              },
              rtl ? { left: Math.round(-34 * scale) } : { right: Math.round(-34 * scale) },
            ]}
            onPress={() => photoUri && !photoFailed && setViewerOpen(true)}
            accessibilityRole="imagebutton"
          >
            {photoUri && !photoFailed ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.heroPhoto}
                contentFit="cover"
                contentPosition="top"
                cachePolicy="memory-disk"
                priority="high"
                transition={300}
                recyclingKey={`${vm.photoKey}-${photoIndex}`}
                onError={() =>
                  setPhotoIndex((i) =>
                    i + 1 < vm.photoCandidates.length ? i + 1 : vm.photoCandidates.length,
                  )
                }
              />
            ) : (
              <View style={styles.heroPhotoFallback}>
                <Ionicons name="person" size={72} color="rgba(255,255,255,0.25)" />
              </View>
            )}
          </Pressable>

          <View
            style={[
              styles.heroIdentity,
              {
                width: Math.round(124 * scale),
                top: Math.round(117 * scale),
                gap: Math.round(16 * scale),
                alignItems: rtl ? 'flex-end' : 'flex-start',
              },
              rtl ? { right: Math.round(22 * scale) } : { left: Math.round(22 * scale) },
            ]}
          >
            <View style={{ gap: Math.round(12 * scale), alignItems: rtl ? 'flex-end' : 'flex-start' }}>
              {vm.jerseyNumber != null ? (
                <Text
                  style={[
                    styles.jersey,
                    {
                      fontFamily: fontBold,
                      fontSize: Math.round(72 * scale),
                      lineHeight: Math.round(78 * scale),
                      color: C.jersey,
                      textAlign: rtl ? 'right' : 'left',
                      width: '100%',
                    },
                  ]}
                  allowFontScaling={false}
                >
                  {vm.jerseyNumber}
                </Text>
              ) : null}
              <View style={{ alignItems: rtl ? 'flex-end' : 'flex-start' }}>
                <Text
                  style={[
                    styles.nameFirst,
                    {
                      fontFamily: fontBold,
                      fontSize: Math.round(22 * scale),
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {first.toUpperCase()}
                </Text>
                {last ? (
                  <Text
                    style={[
                      styles.nameLast,
                      {
                        fontFamily: fontBold,
                        fontSize: Math.round(25 * scale),
                        textAlign: rtl ? 'right' : 'left',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {last.toUpperCase()}
                  </Text>
                ) : null}
                {subline ? (
                  <Text
                    style={[
                      styles.heroSub,
                      {
                        fontFamily: fontReg,
                        color: C.softLilac,
                        textAlign: rtl ? 'right' : 'left',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {subline}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.heroSocials, { flexDirection: 'row', width: 80, justifyContent: 'space-between' }]}>
              {socials?.instagramUrl ? (
                <Pressable onPress={() => Linking.openURL(socials.instagramUrl!).catch(() => undefined)}>
                  <Image source={PP_ICON.instagram} style={styles.socialIcon} contentFit="contain" />
                </Pressable>
              ) : (
                <View style={styles.socialIcon} />
              )}
              {socials?.facebookUrl ? (
                <Pressable onPress={() => Linking.openURL(socials.facebookUrl!).catch(() => undefined)}>
                  <Image source={PP_ICON.facebook} style={styles.socialIcon} contentFit="contain" />
                </Pressable>
              ) : (
                <View style={styles.socialIcon} />
              )}
            </View>
          </View>
        </View>

        {/* Attributes — Figma 1855:91: position · height · age · nationality */}
        <View
          style={[
            styles.strip,
            cardShadow,
            {
              marginHorizontal: pad,
              marginTop: -56,
              backgroundColor: C.card,
              // Figma frame order is L→R: position, height, age, nationality
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

        <View style={{ paddingHorizontal: pad, marginTop: 24, gap: 24 }}>
          {/* Season statistics — Figma 1855:6120 */}
          {vm.season ? (
            <View style={{ gap: 16, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
              <View style={[styles.sectionRow, { flexDirection: 'row', width: '100%' }]}>
                <Text style={[styles.seasonLabel, { fontFamily: fontSemi, color: C.primary }]}>
                  {vm.seasonLabel ?? '—'}
                </Text>
                <Text style={[styles.sectionTitle, { fontFamily: fontBold, color: C.ink }]}>
                  {pc.seasonStatsTitle}
                </Text>
              </View>
              <View style={[styles.keyStatsRow, { flexDirection: 'row', alignSelf: 'stretch' }]}>
                {[
                  { value: fmtNum(vm.season.minutes), label: pc.minutes },
                  { value: fmtNum(vm.season.matches), label: pc.statMatches },
                  { value: fmtNum(vm.season.assists), label: pc.statAssists },
                  { value: fmtNum(vm.season.goals), label: pc.statGoals },
                ].map((s) => (
                  <View
                    key={s.label}
                    style={[
                      styles.keyStatCard,
                      cardShadow,
                      {
                        backgroundColor: C.card,
                        borderWidth: 1,
                        borderColor: C.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.keyStatValue, { fontFamily: fontBold, color: isDark ? C.ink : '#241444' }]}
                    >
                      {s.value}
                    </Text>
                    <Text style={[styles.keyStatLabel, { fontFamily: fontReg, color: C.muted }]}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Detailed statistics + season dropdown beside title */}
          <DetailedStatsSection
            detailed={vm.detailed}
            C={C}
            rtl={rtl}
            cardShadow={cardShadow}
            seasons={vm.seasons}
            seasonLabel={vm.seasonLabel}
            selectedSeasonKey={vm.selectedSeasonKey}
            pickerOpen={pickerOpen}
            onTogglePicker={() => setPickerOpen((o) => !o)}
            onSelectSeason={(key) => {
              onSelectSeason?.(key);
              setPickerOpen(false);
            }}
          />

          {/* Deep stats: comparison rings, trend, competitions */}
          {statsContent ? <View style={{ marginTop: 4 }}>{statsContent}</View> : null}

          {/* Average rating */}
          {vm.averageRating != null ? (
            <LinearGradient
              colors={['#5422ae', '#230e48']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.ratingCard, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}
            >
              <Text style={[styles.ratingLabel, { fontFamily: fontSemi, color: C.ratingLabel }]}>
                {pc.averageRating}
              </Text>
              <View style={[styles.ratingValueRow, { flexDirection: rtl ? 'row' : 'row-reverse' }]}>
                <Image source={PP_ICON.star} style={styles.starIcon} contentFit="contain" />
                <Text style={[styles.ratingValue, { fontFamily: fontBold }]}>
                  {vm.averageRating.toFixed(1)}
                </Text>
              </View>
            </LinearGradient>
          ) : null}

          {/* Last 10 matches average (replaces per-90 radar) */}
          <Last10AverageSection matches={vm.lastMatches} C={C} rtl={rtl} cardShadow={cardShadow} />

          {/* Transfers */}
          {vm.transfers.length > 0 ? (
            <View style={{ gap: 16 }}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontFamily: fontBold, color: C.ink, textAlign: rtl ? 'right' : 'left' },
                ]}
              >
                {pc.transferHistory}
              </Text>
              <View
                style={[
                  styles.transferCard,
                  cardShadow,
                  { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
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

          {/* Social media */}
          {(socials?.instagramUrl || socials?.facebookUrl) ? (
            <SocialSection socials={socials} C={C} rtl={rtl} cardShadow={cardShadow} />
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

export function SectionHeader({
  icon,
  title,
  trailing,
  trailingNode,
  rtl,
}: {
  icon: number;
  title: string;
  trailing?: string | null;
  trailingNode?: ReactNode;
  rtl: boolean;
}) {
  const { isDark } = useResolvedAppScheme();
  const C = getPPColors(isDark);
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

function DetailedStatsSection({
  detailed,
  C,
  rtl,
  cardShadow,
  seasons,
  seasonLabel,
  selectedSeasonKey,
  pickerOpen,
  onTogglePicker,
  onSelectSeason,
}: {
  detailed: PlayerDetailedStats | null;
  C: PPColors;
  rtl: boolean;
  cardShadow: object;
  seasons: { key: string; label: string }[];
  seasonLabel: string | null;
  selectedSeasonKey: string | null;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onSelectSeason: (key: string) => void;
}) {
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);

  const items: {
    key: string;
    value: string;
    label: string;
    icon?: number;
    chip?: 'yellow';
  }[] = [];

  if (detailed) {
    if (detailed.passAccuracy != null) {
      items.push({
        key: 'pass',
        value: fmtPct(detailed.passAccuracy),
        label: pc.passAccuracy,
        icon: PP_ICON.passChain,
      });
    }
    if (detailed.shotsOnTarget != null) {
      items.push({
        key: 'sot',
        value: fmtNum(detailed.shotsOnTarget),
        label: pc.shotsOnTarget,
        icon: PP_ICON.goalNet,
      });
    }
    if (detailed.shots != null) {
      items.push({
        key: 'shots',
        value: fmtNum(detailed.shots),
        label: pc.shots,
        icon: PP_ICON.shots,
      });
    }
    if (detailed.yellowCards != null) {
      items.push({
        key: 'yc',
        value: fmtNum(detailed.yellowCards),
        label: pc.yellowCards,
        chip: 'yellow',
      });
    }
    if (detailed.chancesCreated != null) {
      items.push({
        key: 'cc',
        value: fmtNum(detailed.chancesCreated),
        label: pc.chancesCreated,
        icon: PP_ICON.sparkle,
      });
    }
    if (detailed.dribbles != null) {
      items.push({
        key: 'dr',
        value: fmtNum(detailed.dribbles),
        label: pc.successfulDribbles,
        icon: PP_ICON.dribble,
      });
    }
  }

  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));

  return (
    <View style={{ gap: 16, alignSelf: 'stretch' }}>
      {/* Figma 1857:2937 title + season dropdown beside it */}
      <View style={[styles.sectionRow, { flexDirection: 'row', width: '100%' }]}>
        <Pressable
          onPress={() => seasons.length > 1 && onTogglePicker()}
          hitSlop={8}
          style={[styles.seasonDropdownPill, { backgroundColor: C.pale, borderColor: C.border }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: pickerOpen }}
        >
          <Text style={[styles.seasonLabel, { fontFamily: fontSemi, color: C.primary }]} numberOfLines={1}>
            {seasonLabel ?? '—'}
          </Text>
          {seasons.length > 1 ? (
            <Ionicons
              name={pickerOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={C.primary}
            />
          ) : null}
        </Pressable>
        <Text style={[styles.sectionTitle, { fontFamily: fontBold, color: C.ink }]}>
          {pc.detailedStatsTitle}
        </Text>
      </View>

      {pickerOpen ? (
        <View
          style={[
            styles.seasonDropdown,
            cardShadow,
            { backgroundColor: C.card, borderColor: C.border, alignSelf: 'stretch' },
          ]}
        >
          {seasons.map((season) => {
            const active = season.key === selectedSeasonKey;
            return (
              <Pressable
                key={season.key}
                onPress={() => onSelectSeason(season.key)}
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
                  {season.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {rows.map((row, ri) => (
        <View
          key={`row-${ri}`}
          style={[styles.detailRow, { flexDirection: rtl ? 'row' : 'row-reverse' }]}
        >
          {row.map((item) => (
            <View
              key={item.key}
              style={[
                styles.detailCard,
                cardShadow,
                {
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.border,
                  flexDirection: rtl ? 'row' : 'row-reverse',
                },
              ]}
            >
              <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
                <Text style={[styles.detailValue, { fontFamily: fontBold, color: C.ink }]}>
                  {item.value}
                </Text>
                <Text
                  style={[styles.detailLabel, { fontFamily: fontReg, color: C.muted }]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </View>
              {item.chip === 'yellow' ? (
                <View style={[styles.yellowChip, { backgroundColor: C.cardYellow }]} />
              ) : item.icon ? (
                <Image source={item.icon} style={styles.detailIcon} contentFit="contain" />
              ) : null}
            </View>
          ))}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={{ flex: 1 }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

function Last10AverageSection({
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
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);

  const last10 = useMemo(() => {
    const played = matches.filter((m) => m.played && m.rating != null);
    return played.slice(0, 10);
  }, [matches]);

  if (last10.length === 0) return null;

  const avg = last10.reduce((a, m) => a + (m.rating as number), 0) / last10.length;

  return (
    <View style={{ gap: 12, alignSelf: 'stretch' }}>
      <View style={{ gap: 3, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
        <Text style={[styles.sectionTitle, { fontFamily: fontBold, color: C.ink }]}>
          {pc.last10Average}
        </Text>
        <Text style={[styles.sectionDesc, { fontFamily: fontReg, color: C.muted }]}>
          {pc.last10Desc}
        </Text>
      </View>

      <View
        style={[
          styles.last10Card,
          cardShadow,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        <LinearGradient
          colors={['#5422ae', '#230e48']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.last10Hero, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
        >
          <View style={{ alignItems: rtl ? 'flex-end' : 'flex-start', flex: 1 }}>
            <Text style={[styles.last10HeroLabel, { fontFamily: fontSemi }]}>{pc.averageRating}</Text>
            <View style={[styles.ratingValueRow, { flexDirection: rtl ? 'row' : 'row-reverse' }]}>
              <Image source={PP_ICON.star} style={styles.starIcon} contentFit="contain" />
              <Text style={[styles.ratingValue, { fontFamily: fontBold }]}>{avg.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={[styles.last10Count, { fontFamily: fontSemi }]}>
            {last10.length}/10
          </Text>
        </LinearGradient>

        <Text
          style={[
            styles.last10FormTitle,
            { fontFamily: fontBold, color: C.ink, textAlign: rtl ? 'right' : 'left' },
          ]}
        >
          {pc.last10Form}
        </Text>

        <View style={[styles.last10Row, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {last10.map((m) => {
            const rating = m.rating as number;
            return (
              <View key={m.gameId} style={styles.last10PillWrap}>
                <TeamBadge
                  name={m.opponentName || '—'}
                  logo={m.opponentLogo || undefined}
                  size={22}
                  color="transparent"
                />
                <View style={[styles.last10Pill, { backgroundColor: ratingTone(rating) }]}>
                  <Text style={[styles.last10PillText, { fontFamily: fontSemi, color: C.ratingText }]}>
                    {rating.toFixed(1)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
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
              <Text style={[styles.transferDate, { fontFamily: fontSemi, color: C.primary }]}>
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

function SocialSection({
  socials,
  C,
  rtl,
  cardShadow,
}: {
  socials: { facebookUrl: string | null; instagramUrl: string | null };
  C: PPColors;
  rtl: boolean;
  cardShadow: object;
}) {
  const { t } = useTranslation();
  const pc = t.playerCareer;
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);

  const rows = [
    socials.instagramUrl
      ? {
          key: 'ig',
          url: socials.instagramUrl,
          icon: PP_ICON.instagram,
          handle: handleFromUrl(socials.instagramUrl) ?? '@instagram',
        }
      : null,
    socials.facebookUrl
      ? {
          key: 'fb',
          url: socials.facebookUrl,
          icon: PP_ICON.facebook,
          handle: handleFromUrl(socials.facebookUrl) ?? '@facebook',
        }
      : null,
  ].filter(Boolean) as { key: string; url: string; icon: number; handle: string }[];

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.sectionRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Text style={[styles.sectionTitle, { fontFamily: fontBold, color: C.ink, fontSize: 15 }]}>
          {pc.socialMedia}
        </Text>
        <Text style={[styles.sectionDesc, { fontFamily: fontSemi, color: C.muted }]}>
          {pc.officialAccounts}
        </Text>
      </View>
      <View
        style={[
          styles.socialCard,
          cardShadow,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {rows.map((row, idx) => (
          <React.Fragment key={row.key}>
            <Pressable
              onPress={() => Linking.openURL(row.url).catch(() => undefined)}
              style={[styles.socialRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
            >
              <View
                style={[styles.socialAccount, { flexDirection: rtl ? 'row-reverse' : 'row', flex: 1 }]}
              >
                <Image source={row.icon} style={styles.socialIcon} contentFit="contain" />
                <View style={{ alignItems: rtl ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={{
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Text style={{ fontFamily: fontSemi, color: C.ink, fontSize: 12.5 }}>
                      {row.handle}
                    </Text>
                    <Image source={PP_ICON.verified} style={{ width: 14, height: 14 }} contentFit="contain" />
                  </View>
                  <Text style={{ fontFamily: fontReg, color: C.muted, fontSize: 10.5 }}>
                    {pc.openProfile}
                  </Text>
                </View>
              </View>
              <Image source={PP_ICON.externalLink} style={{ width: 16, height: 16 }} contentFit="contain" />
            </Pressable>
            {idx < rows.length - 1 ? (
              <View style={[styles.socialDivider, { backgroundColor: C.divider }]} />
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    alignItems: 'center',
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
  heroSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: -3, height: 0 },
    elevation: 4,
  },
  heroPhotoWrap: { position: 'absolute', zIndex: 3 },
  heroPhoto: { width: '100%', height: '100%' },
  heroPhotoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroIdentity: { position: 'absolute', zIndex: 4 },
  jersey: { includeFontPadding: false },
  nameFirst: { color: '#fff' },
  nameLast: { color: '#fff', marginTop: -2 },
  heroSub: { fontSize: 12, marginTop: 2 },
  heroSocials: { marginTop: 0 },
  socialIcon: { width: 36, height: 36 },

  strip: {
    height: 66,
    borderRadius: 20,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  attrCell: { alignItems: 'center', gap: 6, flexGrow: 1, flexBasis: 0 },
  attrLabel: { fontSize: 9, textAlign: 'center', width: '100%' },
  attrValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  attrValue: { fontSize: 15 },
  flag: { width: 16, height: 16, borderRadius: 2 },

  sectionRow: { alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sectionTitle: { fontSize: 16 },
  sectionDesc: { fontSize: 10 },
  seasonTap: { alignItems: 'center' },
  seasonLabel: { fontSize: 11, textAlign: 'right' },
  seasonDropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '48%',
  },
  seasonDropdown: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  seasonOption: { paddingHorizontal: 14, paddingVertical: 12 },

  keyStatsRow: { gap: 10 },
  keyStatCard: {
    flex: 1,
    height: 76,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 0,
  },
  keyStatValue: { fontSize: 19 },
  keyStatLabel: { fontSize: 10 },

  detailRow: { gap: 10 },
  detailCard: {
    flex: 1,
    height: 68,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'flex-start',
  },
  detailValue: { fontSize: 16, height: 24 },
  detailLabel: { fontSize: 10, minHeight: 20 },
  detailIcon: { width: 21, height: 21 },
  yellowChip: { width: 16, height: 21, borderRadius: 3 },

  ratingCard: {
    height: 82,
    borderRadius: 16,
    paddingHorizontal: 33,
    justifyContent: 'center',
    gap: 7,
  },
  ratingLabel: { fontSize: 11 },
  ratingValueRow: { alignItems: 'center', gap: 8 },
  ratingValue: { color: '#fff', fontSize: 26 },
  starIcon: { width: 21, height: 21 },

  last10Card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  last10Hero: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  last10HeroLabel: { color: '#e9d5ff', fontSize: 11, marginBottom: 4 },
  last10Count: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  last10FormTitle: { fontSize: 14 },
  last10Row: {
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  last10PillWrap: { alignItems: 'center', gap: 6, width: 52 },
  last10Pill: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  last10PillText: { fontSize: 12 },

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
  transferFee: { fontSize: 8, marginTop: 4 },
  euroIcon: { width: 16, height: 16 },

  socialCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  socialRow: { height: 56, alignItems: 'center', gap: 12 },
  socialAccount: { alignItems: 'center', gap: 12 },
  socialDivider: { height: 1, width: '100%' },

  legacySectionHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
});
