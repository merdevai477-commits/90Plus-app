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

/**
 * Exact SwiftUI / Figma CTA tokens:
 * open      bg(0.21,0.02,0.38) border(0.34,0.06,0.62) text(0.84,0.68,0.99)
 * predicted bg(0.09,0.38,0.02) border(0.07,0.29,0.02) text white
 * ended     bg(0.13,0.08,0.18,0.56) border(0.17,0.11,0.23) text(0.84,0.68,0.99)
 */
const CTA_THEME: Record<
  CtaState,
  { bg: string; border: string; text: string }
> = {
  open: {
    bg: '#360561',
    border: '#570F9E',
    text: '#D6ADFC',
  },
  predicted: {
    bg: '#176105',
    border: '#124A05',
    text: '#FFFFFF',
  },
  ended: {
    bg: 'rgba(33,20,46,0.85)',
    border: '#2B1C3A',
    text: '#D6ADFC',
  },
};

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

  const theme = CTA_THEME[ctaState];
  const ctaLabel =
    ctaState === 'predicted'
      ? pg.predicted
      : ctaState === 'ended'
        ? pg.matchEnded
        : pg.predictNow;

  const canPress = ctaState === 'open';

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

          {/* Visual chip is a View (not Pressable) so Android never greys out fills. */}
          <Pressable
            disabled={!canPress}
            onPress={onPredict}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPress }}
            style={({ pressed }) => [pressed && canPress && styles.ctaPressed]}
          >
            <View
              style={[
                styles.ctaChip,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.ctaTxt,
                  {
                    color: theme.text,
                    fontFamily: bold,
                    writingDirection: direction,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {ctaLabel}
              </Text>
            </View>
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
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaChip: {
    width: 105,
    height: 33,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  ctaTxt: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
