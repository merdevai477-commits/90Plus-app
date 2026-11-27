/**
 * Squad selection countdown — same purple timer language as Top Scorers Five.
 * Always ticks toward close (while open) or unlock (while locked).
 */

import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import {
  resolveCkSelectionWindow,
  splitCkCountdown,
} from './coachKingSelectionWindow';

const GRADIENT = ['#9533F4', '#6A2BD9', '#4B1FA3'] as const;
const BADGE = require('../../assets/images/coach-king/coach-week-badge.png');
const SLIM_BASE_WIDTH = 390;

function slimScale(width: number): number {
  return Math.min(1.18, Math.max(0.86, width / SLIM_BASE_WIDTH));
}

type DeadlineProps = {
  /** Server gameweek bounds. When set, they win over the local Tuesday window. */
  startAt?: string | null;
  endAt?: string | null;
  /** Server says this gameweek no longer accepts picks. */
  locked?: boolean;
  /** Thin bar under the page header. */
  compact?: boolean;
};

export function CoachKingDeadline({
  startAt: _startAt,
  endAt,
  locked = false,
  compact = false,
}: DeadlineProps) {
  const { t, language } = useTranslation();
  const copy = t.coachKingGame.deadline;
  const isAr = language === 'ar';
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const { width: windowWidth } = useWindowDimensions();
  const scale = slimScale(windowWidth);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const windowMs = now - (now % 60_000);
  const fallback = useMemo(() => resolveCkSelectionWindow(new Date(windowMs)), [windowMs]);
  const targetAt = endAt || fallback.targetAt;
  const remaining = Math.max(0, new Date(targetAt).getTime() - now);
  if (remaining <= 0 && !endAt) return null;

  const parts = splitCkCountdown(remaining);
  const phase = locked ? 'closed' : 'open';
  const headline = phase === 'open' ? copy.closesIn : copy.opensIn;
  const tip = phase === 'open' ? copy.tipOpen : copy.tipClosed;

  // Forced LTR track: ثوان → دقائق → ساعات → أيام (Days on the right, like TSF).
  const units = [
    { value: parts.seconds, label: copy.seconds },
    { value: parts.minutes, label: copy.minutes },
    { value: parts.hours, label: copy.hours },
    { value: parts.days, label: copy.days },
  ];

  if (compact) {
    const digitSize = Math.round(17 * scale);
    const labelSize = Math.round(8 * scale);
    const colonSize = Math.round(15 * scale);
    const crestW = Math.round(18 * scale);
    const crestH = Math.round(22 * scale);
    const leagueSize = Math.round(12 * scale);
    const unitMin = Math.round(28 * scale);
    return (
      <LinearGradient
        colors={[...GRADIENT]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.slim, { minHeight: Math.round(56 * scale), borderRadius: Math.round(16 * scale) }]}
        testID="ck-deadline-slim"
      >
        <View style={styles.slimMeta}>
          <Image source={BADGE} style={{ width: crestW, height: crestH }} resizeMode="contain" />
          <Text
            style={[
              styles.slimLeague,
              {
                fontFamily: fontSemi,
                fontSize: leagueSize,
                textAlign: isAr ? 'right' : 'left',
                writingDirection: isAr ? 'rtl' : 'ltr',
              },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {copy.currentRound}
          </Text>
        </View>
        <View style={styles.slimUnits} accessibilityRole="timer">
          {units.map((unit, index) => (
            <View key={unit.label} style={styles.slimUnitSlot}>
              {index > 0 ? (
                <Text style={[styles.slimColon, { fontFamily: fontBold, fontSize: colonSize }]}>:</Text>
              ) : null}
              <View style={[styles.slimUnit, { minWidth: unitMin }]}>
                <Text style={[styles.slimDigit, { fontFamily: fontBold, fontSize: digitSize }]}>
                  {unit.value}
                </Text>
                <Text style={[styles.slimLabel, { fontFamily: fontSemi, fontSize: labelSize }]}>
                  {unit.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...GRADIENT]}
      locations={[0, 0.48, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.card}
      testID="ck-deadline"
    >
      <View style={[styles.head, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { fontFamily: fontSemi }]}>{copy.currentRound}</Text>
        </View>
        <View style={[styles.leagueWrap, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
          <Text
            style={[styles.league, { fontFamily: fontBold, textAlign: isAr ? 'right' : 'left' }]}
            numberOfLines={2}
          >
            {headline}
          </Text>
          <Image source={BADGE} style={styles.crest} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.units} accessibilityRole="timer">
        {units.map((unit, index) => (
          <View key={unit.label} style={styles.unitSlot}>
            {index > 0 ? (
              <Text style={[styles.colon, { fontFamily: fontBold }]}>:</Text>
            ) : null}
            <View style={styles.unit}>
              <View style={styles.digit}>
                <Text style={[styles.digitText, { fontFamily: fontBold }]}>{unit.value}</Text>
              </View>
              <Text style={[styles.unitLabel, { fontFamily: fontSemi }]}>{unit.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.tip, { fontFamily: fontSemi }]}>{tip}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  slim: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#2A1060',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  slimMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '42%',
    maxWidth: '46%',
    minWidth: 0,
  },
  slimLeague: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 16,
  },
  slimUnits: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '54%',
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 1,
    minWidth: 0,
  },
  slimUnitSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slimUnit: {
    alignItems: 'center',
    minWidth: 28,
  },
  slimDigit: {
    color: '#FFFFFF',
    fontSize: 17,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  slimLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 8,
    marginTop: 1,
  },
  slimColon: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginHorizontal: 0,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 12,
    shadowColor: '#4D40CC',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  head: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 40,
    height: 24,
    minWidth: 64,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#F9F6FE',
    fontSize: 10,
  },
  leagueWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  league: {
    color: '#F9F6FE',
    fontSize: 12,
    flexShrink: 1,
  },
  crest: {
    width: 26,
    height: 32,
  },
  units: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  unitSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unit: {
    width: 68,
    alignItems: 'center',
    gap: 4,
  },
  digit: {
    width: 68,
    height: 64,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    color: '#FFFFFF',
    fontSize: 32,
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 10,
    textAlign: 'center',
  },
  colon: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 28,
    marginBottom: 16,
    marginHorizontal: 2,
  },
  tip: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
