/**
 * Squad renewal countdown — purple timer bar (same language as Top Scorers Five).
 * Compact mode sits in the floating top chrome next to the back button.
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
  /** Thin bar for the floating top chrome. */
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

  // Forced LTR track: ثوان → دقائق → ساعات → أيام (Days on the right).
  const units = [
    { value: parts.seconds, label: copy.seconds },
    { value: parts.minutes, label: copy.minutes },
    { value: parts.hours, label: copy.hours },
    { value: parts.days, label: copy.days },
  ];

  if (compact) {
    const digitSize = Math.round(16 * scale);
    const labelSize = Math.round(8 * scale);
    const colonSize = Math.round(14 * scale);
    const crest = Math.round(20 * scale);
    const titleSize = Math.round(12 * scale);
    const unitMin = Math.round(26 * scale);
    return (
      <LinearGradient
        colors={[...GRADIENT]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.slim, { borderRadius: Math.round(16 * scale) }]}
        testID="ck-deadline-slim"
      >
        <View style={[styles.slimHead, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Image source={BADGE} style={{ width: crest, height: crest }} resizeMode="contain" />
          <Text
            style={[
              styles.slimTitle,
              {
                fontFamily: fontSemi,
                fontSize: titleSize,
                textAlign: isAr ? 'right' : 'left',
                writingDirection: isAr ? 'rtl' : 'ltr',
              },
            ]}
            numberOfLines={2}
          >
            {headline}
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
      <View style={[styles.head, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
        <Image source={BADGE} style={styles.crest} resizeMode="contain" />
        <Text
          style={[
            styles.league,
            {
              fontFamily: fontBold,
              textAlign: isAr ? 'right' : 'left',
              writingDirection: isAr ? 'rtl' : 'ltr',
            },
          ]}
          numberOfLines={2}
        >
          {headline}
        </Text>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  slim: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    shadowColor: '#2A1060',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  slimHead: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minWidth: 0,
  },
  slimTitle: {
    color: '#FFFFFF',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 17,
  },
  slimUnits: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    gap: 1,
  },
  slimUnitSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slimUnit: {
    alignItems: 'center',
    minWidth: 26,
  },
  slimDigit: {
    color: '#FFFFFF',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  slimLabel: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },
  slimColon: {
    color: 'rgba(255,255,255,0.7)',
    marginHorizontal: 1,
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
    gap: 10,
    width: '100%',
  },
  league: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 20,
  },
  crest: {
    width: 28,
    height: 28,
    flexShrink: 0,
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
});
