/**
 * Squad selection countdown.
 * The home payload's `showTimer` decides whether this card is mounted.
 * `locked` only changes the copy: time until close, or time until the next open.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import {
  ckSelectionProgress,
  resolveCkSelectionWindow,
  splitCkCountdown,
  type CkSelectionWindow,
} from './coachKingSelectionWindow';

function useSelectionWindow(nowMs: number): CkSelectionWindow {
  return useMemo(() => resolveCkSelectionWindow(new Date(nowMs)), [nowMs]);
}

function UnitBox({ value, label }: { value: string; label: string }) {
  const fontBold = useAppFont(700);
  const fontReg = useAppFont(400);
  return (
    <View style={styles.unit}>
      <Text style={[styles.unitValue, { fontFamily: fontBold }]}>{value}</Text>
      <Text style={[styles.unitLabel, { fontFamily: fontReg }]}>{label}</Text>
    </View>
  );
}

type DeadlineProps = {
  /** Server gameweek bounds. When set, they win over the local Tuesday window. */
  startAt?: string | null;
  endAt?: string | null;
  /** Server says this gameweek no longer accepts picks. */
  locked?: boolean;
};

export function CoachKingDeadline({ startAt, endAt, locked = false }: DeadlineProps) {
  const { t, language } = useTranslation();
  const copy = t.coachKingGame.deadline;
  const isAr = language === 'ar';
  const fontSemi = useAppFont(600);
  const fontReg = useAppFont(400);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Recompute the fallback window at most once a minute so midnight flips cleanly.
  const windowMs = now - (now % 60_000);
  const fallback = useSelectionWindow(windowMs);
  const targetAt = endAt || fallback.targetAt;
  const windowStartAt = startAt || fallback.windowStartAt;
  const phase = locked ? 'closed' : 'open';
  const window: CkSelectionWindow = {
    phase,
    targetAt,
    windowStartAt,
    windowEndAt: targetAt,
  };
  const remaining = Math.max(0, new Date(window.targetAt).getTime() - now);
  const parts = splitCkCountdown(remaining);
  const progress = ckSelectionProgress(window, new Date(now));
  const headline = phase === 'open' ? copy.closesIn : copy.opensIn;
  const tip = phase === 'open' ? copy.tipOpen : copy.tipClosed;
  const row = isAr ? 'row-reverse' : 'row';

  return (
    <View style={styles.card} testID="ck-deadline">
      <View style={[styles.header, { flexDirection: row }]}>
        <View style={styles.badge}>
          <Text style={[styles.badgeTxt, { fontFamily: fontSemi }]}>{copy.currentRound}</Text>
        </View>
        <View style={[styles.headline, { flexDirection: row }]}>
          <Ionicons name={phase === 'open' ? 'lock-open' : 'lock-closed'} size={16} color="#F8C94A" />
          <Text style={[styles.headlineTxt, { fontFamily: fontReg }]}>{headline}</Text>
        </View>
      </View>

      <View style={[styles.units, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
        <UnitBox value={parts.seconds} label={copy.seconds} />
        <Text style={styles.colon}>:</Text>
        <UnitBox value={parts.minutes} label={copy.minutes} />
        <Text style={styles.colon}>:</Text>
        <UnitBox value={parts.hours} label={copy.hours} />
        {parts.showDays ? (
          <>
            <Text style={styles.colon}>:</Text>
            <UnitBox value={parts.days} label={copy.days} />
          </>
        ) : null}
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(progress * 100)}%`,
              alignSelf: isAr ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </View>

      <Text style={[styles.tip, { fontFamily: fontReg }]}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#09001D',
    borderWidth: 1,
    borderColor: '#200E4A',
    rowGap: 13,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: 'rgba(197,174,250,0.2)',
    borderRadius: 58,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeTxt: { color: '#C7B1F9', fontSize: 11 },
  headline: { alignItems: 'center', columnGap: 4 },
  headlineTxt: { color: '#FFFFFF', fontSize: 12 },
  units: {
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
  },
  unit: {
    backgroundColor: '#170835',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    rowGap: 6,
    minWidth: 60,
  },
  unitValue: { color: '#FFFFFF', fontSize: 20, textAlign: 'center' },
  unitLabel: { color: '#B9A9E8', fontSize: 14, textAlign: 'center' },
  colon: { color: '#B9A9E8', fontSize: 24, marginBottom: 10 },
  track: {
    height: 6,
    borderRadius: 43,
    backgroundColor: '#281443',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: 6,
    borderRadius: 43,
    backgroundColor: '#8B5CF6',
  },
  tip: {
    color: '#8B8B8B',
    fontSize: 11,
    textAlign: 'center',
  },
});
