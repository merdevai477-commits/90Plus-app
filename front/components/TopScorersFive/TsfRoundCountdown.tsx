/**
 * Per-league round countdown — Figma node 2308:5630 (Card / Monthly Countdown).
 * Ticks toward slot unlock or the gameweek reopen (+1h after endAt).
 */

import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { splitCountdown } from '../ShareWin/data';
import { SW_ASSET } from '../ShareWin/assets';

const GRADIENT = ['#9533F4', '#6A2BD9', '#4B1FA3'] as const;

type Props = {
  leagueName: string;
  crest: number;
  tintCrest?: boolean;
  round: number | null;
  targetAt: string | null;
  /** Thin floating bar for the pitch chrome (back + timer row). */
  compact?: boolean;
};

export function TsfRoundCountdown({
  leagueName,
  crest,
  tintCrest,
  round,
  targetAt,
  compact,
}: Props) {
  const { t, language } = useTranslation();
  const copy = t.topScorersFive.pick.countdown;
  const isAr = language === 'ar';
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetAt]);

  const remainingMs = useMemo(() => {
    if (!targetAt) return 0;
    return Math.max(0, new Date(targetAt).getTime() - now);
  }, [now, targetAt]);

  if (!targetAt || remainingMs <= 0) return null;

  const parts = splitCountdown(remainingMs);
  // Forced LTR track: ثوان → دقائق → ساعات → أيام (Days on the right, like Figma).
  const units = [
    { value: parts.seconds, label: copy.seconds },
    { value: parts.minutes, label: copy.minutes },
    { value: parts.hours, label: copy.hours },
    { value: parts.days, label: copy.days },
  ];
  const roundLabel =
    round != null && round > 0 ? copy.round.replace('{n}', String(round)) : null;

  if (compact) {
    return (
      <LinearGradient
        colors={[...GRADIENT]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.slim}
        testID="tsf-round-countdown-slim"
      >
        <View style={[styles.slimMeta, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
          <Image
            source={crest}
            style={[styles.slimCrest, tintCrest ? { tintColor: '#FFFFFF' } : null]}
            resizeMode="contain"
          />
          <Text style={[styles.slimLeague, { fontFamily: fontSemi }]} numberOfLines={1}>
            {leagueName}
          </Text>
          {roundLabel ? (
            <Text style={[styles.slimRound, { fontFamily: fontSemi }]} numberOfLines={1}>
              {roundLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.slimUnits} accessibilityRole="timer">
          {units.map((unit, index) => (
            <View key={unit.label} style={styles.slimUnitSlot}>
              {index > 0 ? <Text style={[styles.slimColon, { fontFamily: fontBold }]}>:</Text> : null}
              <View style={styles.slimUnit}>
                <Text style={[styles.slimDigit, { fontFamily: fontBold }]}>{unit.value}</Text>
                <Text style={[styles.slimLabel, { fontFamily: fontSemi }]}>{unit.label}</Text>
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
      testID="tsf-round-countdown"
    >
      <View style={[styles.head, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        {roundLabel ? (
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontFamily: fontSemi }]}>{roundLabel}</Text>
          </View>
        ) : (
          <View style={styles.badgeSpacer} />
        )}
        <View style={[styles.leagueWrap, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
          <Text style={[styles.league, { fontFamily: fontBold }]} numberOfLines={1}>
            {leagueName}
          </Text>
          <Image
            source={crest}
            style={[styles.crest, tintCrest ? { tintColor: '#FFFFFF' } : null]}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={[styles.headline, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <Text style={[styles.headlineText, { fontFamily: fontBold }]} numberOfLines={1}>
          {copy.reopensIn}
        </Text>
        <View style={styles.clockWrap}>
          <Image source={SW_ASSET.clockV2} style={styles.clock} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.units} accessibilityRole="timer">
        {units.map((unit, index) => (
          <View key={unit.label} style={styles.unitSlot}>
            {index > 0 ? (
              <Image source={SW_ASSET.colonDots} style={styles.colon} resizeMode="contain" />
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

/** Resolve the ISO target for the formation countdown. */
export function resolveTsfCountdownTarget(input: {
  nowMs?: number;
  lockedUntil: string | null;
  endAt: string | null;
  reopenAt: string | null;
  leagueLocked: boolean;
  /** At least one player is already on the pitch — show the timer immediately. */
  hasPicks?: boolean;
}): string | null {
  const now = input.nowMs ?? Date.now();

  if (input.lockedUntil) {
    const lockMs = new Date(input.lockedUntil).getTime();
    if (Number.isFinite(lockMs) && lockMs > now) return input.lockedUntil;
  }

  const reopenIso =
    input.reopenAt ??
    (input.endAt ? new Date(new Date(input.endAt).getTime() + 3_600_000).toISOString() : null);
  const reopenMs = reopenIso ? new Date(reopenIso).getTime() : NaN;
  const endMs = input.endAt ? new Date(input.endAt).getTime() : NaN;

  if (input.hasPicks || input.leagueLocked) {
    if (Number.isFinite(endMs) && endMs > now) return input.endAt;
    if (Number.isFinite(reopenMs) && reopenMs > now) return reopenIso;
    return null;
  }

  if (!Number.isFinite(reopenMs) || reopenMs <= now) return null;
  if (!Number.isFinite(endMs)) return null;
  if (now < endMs - 3_600_000) return null;
  return reopenIso;
}

const styles = StyleSheet.create({
  slim: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#2A1060',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  slimMeta: {
    alignItems: 'center',
    gap: 4,
    maxWidth: '34%',
    flexShrink: 1,
  },
  slimCrest: {
    width: 18,
    height: 22,
  },
  slimLeague: {
    color: '#F9F6FE',
    fontSize: 10,
    flexShrink: 1,
  },
  slimRound: {
    color: 'rgba(249,246,254,0.82)',
    fontSize: 9,
  },
  slimUnits: {
    flex: 1,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
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
    fontSize: 15,
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
    fontSize: 14,
    marginHorizontal: 1,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 7,
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
  badgeSpacer: {
    width: 64,
    height: 24,
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
    fontSize: 11,
    flexShrink: 1,
    textAlign: 'right',
  },
  crest: {
    width: 26,
    height: 32,
  },
  headline: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minHeight: 22,
    width: '100%',
  },
  headlineText: {
    color: '#FFFFFF',
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
  },
  clockWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    width: 18,
    height: 18,
    tintColor: '#FFFFFF',
  },
  units: {
    // Keep LTR so RTL apps don't flip Days to the left.
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 90,
  },
  unitSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unit: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  digit: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29267A',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  digitText: {
    color: '#FFFFFF',
    fontSize: 40,
    textAlign: 'center',
    includeFontPadding: false,
  },
  unitLabel: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 10,
    textAlign: 'center',
    height: 14,
  },
  colon: {
    width: 8,
    height: 28,
    marginBottom: 18,
    tintColor: '#FFFFFF',
  },
});
