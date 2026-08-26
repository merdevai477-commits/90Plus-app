/**
 * Compact VS match card — Figma CTA states (open / predicted / ended).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { PredictionMatch } from './data';
import { usePGFonts } from './theme';

type CtaState = 'open' | 'predicted' | 'ended';

const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST']);

/** Exact Figma / SwiftUI CTA fills (solid — avoid LinearGradient flex bugs). */
const CTA = {
  openBg: '#350662',
  openBorder: '#570F9E',
  openText: '#D6ADFC',
  predictedBg: '#175F03',
  predictedBorder: '#124A02',
  predictedText: '#FFFFFF',
  endedBg: 'rgba(33,20,46,0.56)',
  endedBorder: '#2B1C3A',
  endedText: '#D6ADFC',
} as const;

function resolveCtaState(saved: boolean, status: string): CtaState {
  const short = (status || '').toUpperCase();
  const finished = FINISHED.has(short);
  const notUpcoming = short !== '' && short !== 'NS' && short !== 'TBD';
  if (finished || (notUpcoming && !saved)) return 'ended';
  if (saved) return 'predicted';
  return 'open';
}

export function MatchVsCard({
  match,
  isRTL,
  saved,
  locked: _locked,
  status,
  onPredict,
}: {
  match: PredictionMatch;
  isRTL: boolean;
  saved?: boolean;
  locked?: boolean;
  status?: string;
  onPredict: () => void;
}) {
  const { bold, medium } = usePGFonts();
  const { t, direction } = useTranslation();
  const pg = t.predictionGroups.predictions;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const ctaState = useMemo(
    () => resolveCtaState(Boolean(saved), status ?? match.status ?? ''),
    [saved, status, match.status],
  );

  const ctaLabel =
    ctaState === 'predicted'
      ? pg.predicted
      : ctaState === 'ended'
        ? pg.matchEnded
        : pg.predictNow;

  const disabled = ctaState !== 'open';

  const backgroundColor =
    ctaState === 'predicted'
      ? CTA.predictedBg
      : ctaState === 'ended'
        ? CTA.endedBg
        : CTA.openBg;

  const borderColor =
    ctaState === 'predicted'
      ? CTA.predictedBorder
      : ctaState === 'ended'
        ? CTA.endedBorder
        : CTA.openBorder;

  const textColor =
    ctaState === 'predicted'
      ? CTA.predictedText
      : ctaState === 'ended'
        ? CTA.endedText
        : CTA.openText;

  const team = (side: 'home' | 'away', size: number) => {
    const tm = match[side];
    return (
      <View style={[styles.team, { width: side === 'home' ? 78 : 70 }]}>
        <TeamBadge
          name={tm.name}
          logo={tm.logo ?? undefined}
          size={size}
          color="transparent"
          highQuality
        />
        <Text
          style={[
            styles.teamName,
            { fontFamily: bold, fontSize: 13, writingDirection: direction },
          ]}
          numberOfLines={2}
        >
          {tm.name}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={[styles.row, row]}>
        {team('home', 50)}
        <View style={styles.mid}>
          <Text style={[styles.vs, { fontFamily: bold }]}>VS</Text>
          <Text style={[styles.time, { fontFamily: medium }]}>{match.time}</Text>
          <Pressable
            disabled={disabled}
            onPress={onPredict}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor, borderColor },
              pressed && !disabled && styles.ctaPressed,
            ]}
          >
            <Text
              style={[
                styles.ctaTxt,
                {
                  color: textColor,
                  fontFamily: bold,
                  writingDirection: direction,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {ctaLabel}
            </Text>
          </Pressable>
        </View>
        {team('away', 50)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 133,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(138,56,245,0.55)',
    backgroundColor: '#07040D',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  teamName: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mid: {
    width: 112,
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  vs: {
    color: '#A855F7',
    fontSize: 21,
  },
  time: {
    color: '#777777',
    fontSize: 13,
  },
  cta: {
    width: 105,
    height: 33,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  ctaPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  ctaTxt: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
