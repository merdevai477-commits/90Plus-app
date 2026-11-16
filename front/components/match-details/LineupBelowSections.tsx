/**
 * Figma under-pitch lineup sections:
 * - Coach `1823:24048`
 * - Substitutes `1830:27634`
 * - Absences `1823:25316` (when injury data is available)
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './MatchText';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';
import { useLocalizedName } from '../../hooks/useLocalizedName';
import { shortPlayerName, type LineupPitchPlayer } from '../../utils/lineupMatchState';
import { getCountryDisplayName } from '../../utils/i18nHelpers';
import { getCountryFlagUri } from '../../utils/countryFlagUri';
import { LINEUP_ICON } from './lineupAssets';
import type { Injury } from '../../services/apiFootball';
import type { Language } from '../../src/i18n';

const DESIGN_W = 430;
const PHOTO_W = 83;
const PHOTO_H = 87;
const CARD_H = 87;
const COACH_PHOTO_W = 94;

export type LineupCoachInfo = {
  id?: number | null;
  name?: string | null;
  photo?: string | null;
  nationality?: string | null;
};

export type LineupSquadPlayer = LineupPitchPlayer & {
  nationality?: string | null;
};

type LineupBelowSectionsProps = {
  coach: LineupCoachInfo | null;
  teamName: string;
  teamLogo?: string | null;
  substitutes: LineupSquadPlayer[];
  absences: Injury[];
  rtl: boolean;
  language: Language;
  labels: {
    coach: string;
    substitutes: string;
    absences: string;
    playersCount: (n: number) => string;
    emptySubs: string;
  };
  resolvePhoto: (playerId: number, photo?: string | null, px?: number) => string;
  onCoachPress?: (coach: LineupCoachInfo) => void;
  onPlayerPress?: (player: LineupSquadPlayer) => void;
  onAbsencePress?: (injury: Injury) => void;
};

function MetaFlag({
  country,
  language,
}: {
  country?: string | null;
  language: Language;
}) {
  const { isDark } = useMatchDetailsTheme();
  if (!country?.trim()) return null;
  const label = getCountryDisplayName(country, language);
  const uri = getCountryFlagUri(country, null, 32);
  return (
    <View style={styles.metaRow}>
      <Text
        style={[styles.metaText, isDark && { color: 'rgba(255,255,255,0.55)' }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
      >
        {label}
      </Text>
      {uri ? (
        <Image source={{ uri }} style={styles.flag} contentFit="cover" transition={0} />
      ) : null}
    </View>
  );
}

function SectionHeader({
  title,
  icon,
  countLabel,
  rtl,
}: {
  title: string;
  icon: number;
  countLabel?: string | null;
  rtl: boolean;
}) {
  const { colors, isDark } = useMatchDetailsTheme();
  return (
    <View style={[styles.sectionHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      <View style={[styles.sectionTitleRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Text
          style={[styles.sectionTitle, { color: isDark ? '#F5F3FF' : colors.textPrimary }]}
          maxFontSizeMultiplier={1.2}
        >
          {title}
        </Text>
        <Image source={icon} style={styles.sectionIcon} contentFit="contain" transition={0} />
      </View>
      {countLabel ? (
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: isDark ? 'rgba(168,85,247,0.22)' : '#E9D5FF',
            },
          ]}
        >
          <Text
            style={[styles.countBadgeText, { color: isDark ? '#E9D5FF' : '#4B1FA3' }]}
            maxFontSizeMultiplier={1.1}
          >
            {countLabel}
          </Text>
        </View>
      ) : (
        <View />
      )}
    </View>
  );
}

function SquadPlayerCard({
  name,
  number,
  photoUri,
  nationality,
  secondary,
  language,
  rtl,
  onPress,
  style,
}: {
  name: string;
  number?: number | null;
  photoUri?: string | null;
  nationality?: string | null;
  /** Plain secondary line (injury reason / position) when not a country. */
  secondary?: string | null;
  language: Language;
  rtl: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { isDark } = useMatchDetailsTheme();
  const displayName = useLocalizedName(name);
  return (
    <TouchableOpacity
      style={[styles.playerCard, isDark && styles.playerCardDark, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={displayName}
    >
      {!isDark ? (
        <LinearGradient
          colors={['#FFFFFF', '#FCF9FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.playerTextCol, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
        <Text
          style={[styles.playerName, isDark && { color: '#F5F3FF' }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.15}
        >
          {shortPlayerName(displayName, 14)}
        </Text>
        {nationality ? (
          <MetaFlag country={nationality} language={language} />
        ) : secondary ? (
          <Text
            style={[styles.metaText, isDark && { color: 'rgba(255,255,255,0.55)' }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.1}
          >
            {secondary}
          </Text>
        ) : null}
      </View>
      <View style={styles.playerPhotoWrap}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.playerPhoto}
            contentFit="cover"
            contentPosition="top"
            transition={0}
          />
        ) : (
          <View style={[styles.playerPhotoFallback, isDark && { backgroundColor: '#1C1240' }]}>
            <Ionicons name="person" size={28} color="#8B5CF6" />
          </View>
        )}
        {number != null && number > 0 ? (
          <View
            style={[
              styles.numberBadge,
              rtl ? styles.numberBadgeRtl : styles.numberBadgeLtr,
              isDark && { backgroundColor: 'rgba(233,213,255,0.9)' },
            ]}
          >
            <Text style={styles.numberText} maxFontSizeMultiplier={1.05}>
              {number}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function CoachSection({
  coach,
  teamName,
  teamLogo,
  title,
  rtl,
  language,
  onPress,
}: {
  coach: LineupCoachInfo;
  teamName: string;
  teamLogo?: string | null;
  title: string;
  rtl: boolean;
  language: Language;
  onPress?: () => void;
}) {
  const { isDark } = useMatchDetailsTheme();
  const displayName = useLocalizedName(coach.name || '');
  if (!coach.name?.trim()) return null;

  return (
    <View style={styles.block}>
      <SectionHeader title={title} icon={LINEUP_ICON.coach} rtl={rtl} />
      <TouchableOpacity
        style={[styles.coachCard, isDark && styles.coachCardDark]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={displayName}
      >
        {!isDark ? (
          <LinearGradient
            colors={['#FFFFFF', '#FCF9FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}
        <View style={[styles.coachTextCol, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
          <Text
            style={[styles.coachName, isDark && { color: '#F5F3FF' }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.15}
          >
            {displayName}
          </Text>
          <View style={[styles.coachMetaRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {coach.nationality ? (
              <MetaFlag country={coach.nationality} language={language} />
            ) : null}
            {teamName ? (
              <View style={[styles.teamMeta, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text
                  style={[styles.metaText, isDark && { color: 'rgba(255,255,255,0.55)' }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.1}
                >
                  {teamName}
                </Text>
                {teamLogo ? (
                  <Image source={{ uri: teamLogo }} style={styles.teamLogo} contentFit="contain" />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.coachPhotoWrap}>
          {coach.photo ? (
            <Image
              source={{ uri: coach.photo }}
              style={styles.coachPhoto}
              contentFit="cover"
              contentPosition="top"
              transition={0}
            />
          ) : (
            <View style={[styles.coachPhotoFallback, isDark && { backgroundColor: '#1C1240' }]}>
              <Ionicons name="person" size={32} color="#8B5CF6" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function PlayersGridSection({
  title,
  icon,
  countLabel,
  emptyLabel,
  rtl,
  children,
}: {
  title: string;
  icon: number;
  countLabel: string;
  emptyLabel?: string;
  rtl: boolean;
  children?: React.ReactNode;
}) {
  const { isDark } = useMatchDetailsTheme();
  const hasChildren = children != null && children !== false;
  return (
    <View style={styles.block}>
      <SectionHeader title={title} icon={icon} countLabel={countLabel} rtl={rtl} />
      <View style={[styles.gridCard, isDark && styles.gridCardDark]}>
        {hasChildren ? (
          children
        ) : (
          <Text style={[styles.emptyText, isDark && { color: 'rgba(255,255,255,0.45)' }]}>
            {emptyLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

export function LineupBelowSections({
  coach,
  teamName,
  teamLogo,
  substitutes,
  absences,
  rtl,
  language,
  labels,
  resolvePhoto,
  onCoachPress,
  onPlayerPress,
  onAbsencePress,
}: LineupBelowSectionsProps) {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useMatchDetailsTheme();
  const s = Math.min(1, width / DESIGN_W);
  const cardW = Math.floor((width - 32 * s - 28 * s - 10 * s) / 2);

  const rows = useMemo(() => {
    const out: LineupSquadPlayer[][] = [];
    for (let i = 0; i < substitutes.length; i += 2) {
      out.push(substitutes.slice(i, i + 2));
    }
    return out;
  }, [substitutes]);

  const absenceRows = useMemo(() => {
    const out: Injury[][] = [];
    for (let i = 0; i < absences.length; i += 2) {
      out.push(absences.slice(i, i + 2));
    }
    return out;
  }, [absences]);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? '#030303' : colors.pageBg,
          paddingHorizontal: 16 * s,
          paddingTop: 18 * s,
          gap: 22 * s,
        },
      ]}
    >
      {coach?.name ? (
        <CoachSection
          coach={coach}
          teamName={teamName}
          teamLogo={teamLogo}
          title={labels.coach}
          rtl={rtl}
          language={language}
          onPress={coach.id && onCoachPress ? () => onCoachPress(coach) : undefined}
        />
      ) : null}

      <PlayersGridSection
        title={labels.substitutes}
        icon={LINEUP_ICON.subsSwap}
        countLabel={labels.playersCount(substitutes.length)}
        emptyLabel={labels.emptySubs}
        rtl={rtl}
      >
        {substitutes.length === 0 ? undefined : (
          <View style={styles.grid}>
            {rows.map((row, ri) => (
              <View
                key={`sub-row-${ri}`}
                style={[styles.gridRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
              >
                {row.map((player) => (
                  <SquadPlayerCard
                    key={`sub-${player.id ?? player.name}-${player.number}`}
                    name={player.name}
                    number={player.number}
                    photoUri={
                      player.id
                        ? resolvePhoto(player.id, player.photo, 160) || player.photo
                        : player.photo
                    }
                    nationality={player.nationality}
                    secondary={player.nationality ? null : player.pos || null}
                    language={language}
                    rtl={rtl}
                    onPress={
                      onPlayerPress && player.id ? () => onPlayerPress(player) : undefined
                    }
                    style={{ width: cardW, maxWidth: cardW }}
                  />
                ))}
                {row.length === 1 ? <View style={{ width: cardW }} /> : null}
              </View>
            ))}
          </View>
        )}
      </PlayersGridSection>

      {absences.length > 0 ? (
        <PlayersGridSection
          title={labels.absences}
          icon={LINEUP_ICON.absences}
          countLabel={labels.playersCount(absences.length)}
          rtl={rtl}
        >
          <View style={styles.grid}>
            {absenceRows.map((row, ri) => (
              <View
                key={`abs-row-${ri}`}
                style={[styles.gridRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
              >
                {row.map((injury) => (
                  <SquadPlayerCard
                    key={`abs-${injury.player.id}-${injury.reason}`}
                    name={injury.player.name}
                    number={null}
                    photoUri={injury.player.photo}
                    secondary={injury.reason || injury.type || null}
                    language={language}
                    rtl={rtl}
                    onPress={
                      onAbsencePress && injury.player.id
                        ? () => onAbsencePress(injury)
                        : undefined
                    }
                    style={{ width: cardW, maxWidth: cardW }}
                  />
                ))}
                {row.length === 1 ? <View style={{ width: cardW }} /> : null}
              </View>
            ))}
          </View>
        </PlayersGridSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  block: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  sectionTitleRow: {
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#24104E',
  },
  sectionIcon: {
    width: 24,
    height: 24,
  },
  countBadge: {
    minWidth: 68,
    height: 21,
    borderRadius: 43,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9D5FF',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B1FA3',
  },
  coachCard: {
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    shadowColor: 'rgba(75,31,163,0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  coachCardDark: {
    backgroundColor: '#120A22',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,85,247,0.28)',
    shadowOpacity: 0,
    elevation: 0,
  },
  coachTextCol: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 8,
    justifyContent: 'center',
    minWidth: 0,
  },
  coachName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#24104E',
  },
  coachMetaRow: {
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  teamMeta: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  teamLogo: {
    width: 14,
    height: 18,
  },
  coachPhotoWrap: {
    width: COACH_PHOTO_W,
    height: CARD_H,
    backgroundColor: '#F8F7FF',
    overflow: 'hidden',
  },
  coachPhoto: {
    width: '100%',
    height: '100%',
  },
  coachPhotoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F7FF',
  },
  gridCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(106,43,217,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 16,
    shadowColor: 'rgba(75,31,163,0.12)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  gridCardDark: {
    backgroundColor: '#0B0518',
    borderColor: 'rgba(168,85,247,0.22)',
    shadowOpacity: 0,
    elevation: 0,
  },
  grid: {
    gap: 16,
  },
  gridRow: {
    gap: 10,
    justifyContent: 'space-between',
  },
  playerCard: {
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    shadowColor: 'rgba(75,31,163,0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  playerCardDark: {
    backgroundColor: '#120A22',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,85,247,0.28)',
    shadowOpacity: 0,
    elevation: 0,
  },
  playerTextCol: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 8,
    justifyContent: 'center',
    minWidth: 0,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#24104E',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  flag: {
    width: 16,
    height: 16,
    borderRadius: 3,
    overflow: 'hidden',
  },
  playerPhotoWrap: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: '#F8F7FF',
    overflow: 'hidden',
  },
  playerPhoto: {
    width: '100%',
    height: '100%',
  },
  playerPhotoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F7FF',
  },
  numberBadge: {
    position: 'absolute',
    top: 7,
    width: 15,
    height: 15,
    borderRadius: 64,
    backgroundColor: '#E9D5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeLtr: {
    right: 8,
  },
  numberBadgeRtl: {
    right: 8,
  },
  numberText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#4B1FA3',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    paddingVertical: 12,
  },
});

export default LineupBelowSections;
