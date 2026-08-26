/**
 * Compact VS match card with Predict Now CTA — Figma 477:2766 + CTA states.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { PredictionMatch } from './data';
import { usePGFonts } from './theme';

type CtaState = 'open' | 'predicted' | 'ended';

const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST']);

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

  const ctaStyle =
    ctaState === 'predicted'
      ? styles.ctaPredicted
      : ctaState === 'ended'
        ? styles.ctaEnded
        : styles.ctaOpen;

  const ctaTxtStyle =
    ctaState === 'predicted'
      ? styles.ctaTxtPredicted
      : ctaState === 'ended'
        ? styles.ctaTxtEnded
        : styles.ctaTxtOpen;

  const disabled = ctaState !== 'open';

  const team = (side: 'home' | 'away', size: number) => {
    const tm = match[side];
    return (
      <View style={[styles.team, { width: side === 'home' ? 72 : 64 }]}>
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
            { fontFamily: bold, fontSize: side === 'home' ? 13 : 14, writingDirection: direction },
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
        {team('home', 52)}
        <View style={styles.mid}>
          <Text style={[styles.vs, { fontFamily: bold }]}>VS</Text>
          <Text style={[styles.time, { fontFamily: medium }]}>{match.time}</Text>
          <Pressable
            disabled={disabled}
            onPress={onPredict}
            style={({ pressed }) => [
              styles.cta,
              ctaStyle,
              pressed && !disabled && { opacity: 0.9 },
            ]}
          >
            <Text
              style={[styles.ctaTxt, ctaTxtStyle, { fontFamily: bold, writingDirection: direction }]}
              numberOfLines={1}
            >
              {ctaLabel}
            </Text>
          </Pressable>
        </View>
        {team('away', 54)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 133,
    paddingHorizontal: 34,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(83,25,138,0.65)',
    backgroundColor: '#07040D',
    justifyContent: 'center',
  },
  row: { alignItems: 'center', justifyContent: 'space-between' },
  team: { alignItems: 'center', gap: 9 },
  teamName: { color: '#fff', textAlign: 'center' },
  mid: { width: 105, alignItems: 'center', gap: 9, height: 133, justifyContent: 'center' },
  vs: { color: '#A855F7', fontSize: 21 },
  time: { color: '#777', fontSize: 13 },
  cta: {
    width: 105,
    height: 33,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaOpen: {
    backgroundColor: '#350662',
    borderColor: '#580E9E',
  },
  ctaPredicted: {
    backgroundColor: '#175F03',
    borderColor: '#124A02',
  },
  ctaEnded: {
    backgroundColor: 'rgba(33,20,46,0.56)',
    borderColor: '#2B1C3A',
  },
  ctaTxt: { fontSize: 10, textAlign: 'center' },
  ctaTxtOpen: { color: '#D6AEFC' },
  ctaTxtPredicted: { color: '#FFFFFF' },
  ctaTxtEnded: { color: '#D6AEFC' },
});
