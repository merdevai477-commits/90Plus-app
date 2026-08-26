/**
 * Daily remaining-matches progress card — Figma 492:3207.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import GradientText from '../ShareWin/components/GradientText';
import { useTranslation } from '../../src/i18n';
import { usePGFonts } from './theme';

const NUM_GRADIENT = ['#FFFFFF', '#999999'] as const;
const FILL_GRADIENT = ['#5F00B9', '#2B0053'] as const;

export function DailyProgressCard({
  isRTL,
  remaining,
  total,
}: {
  isRTL: boolean;
  remaining: number;
  total: number;
}) {
  const { bold, medium } = usePGFonts();
  const { t, direction } = useTranslation();
  const cup = t.predictionGroups.cup;

  const safeTotal = Math.max(0, total);
  const safeRemaining = Math.max(0, Math.min(remaining, safeTotal || remaining));
  const predicted = Math.max(0, safeTotal - safeRemaining);
  const pct = safeTotal > 0 ? Math.min(1, predicted / safeTotal) : 0;
  const fracLabel = useMemo(
    () => `${safeTotal}/${predicted}`,
    [safeTotal, predicted],
  );

  /** Figma Arabic: big remaining digit sits on the right of the meta column. */
  const shellRow: ViewStyle = { flexDirection: isRTL ? 'row' : 'row-reverse' };
  const labelRow: ViewStyle = { flexDirection: isRTL ? 'row' : 'row-reverse' };

  return (
    <LinearGradient
      colors={['#0C051A', '#07040D']}
      start={{ x: 0.5, y: 1 }}
      end={{ x: 0.5, y: 0 }}
      style={styles.card}
    >
      <View style={[styles.row, shellRow]}>
        <View style={[styles.meta, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.labelRow, labelRow]}>
            <Text
              style={[styles.frac, { fontFamily: medium, writingDirection: direction }]}
              numberOfLines={1}
            >
              {fracLabel}
            </Text>
            <Text
              style={[styles.label, { fontFamily: medium, writingDirection: direction }]}
              numberOfLines={1}
            >
              {cup.remainingToday}
            </Text>
          </View>

          <View style={styles.track}>
            <LinearGradient
              colors={FILL_GRADIENT}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                styles.fill,
                {
                  width: `${Math.round(pct * 100)}%`,
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                },
              ]}
            />
          </View>
        </View>

        <GradientText
          colors={NUM_GRADIENT}
          style={[styles.num, { fontFamily: bold }]}
        >
          {String(safeRemaining)}
        </GradientText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 88,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(89,10,164,0.62)',
    justifyContent: 'center',
  },
  row: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  num: {
    color: '#FFFFFF',
    fontSize: 43,
    lineHeight: 48,
    textAlign: 'center',
    minWidth: 36,
  },
  meta: {
    flex: 1,
    gap: 12,
    minWidth: 0,
    justifyContent: 'center',
  },
  labelRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    flexShrink: 1,
  },
  frac: {
    color: '#979797',
    fontSize: 13,
    textAlign: 'center',
  },
  track: {
    width: '100%',
    maxWidth: 254,
    height: 7,
    borderRadius: 11,
    backgroundColor: '#202020',
    overflow: 'hidden',
  },
  fill: {
    height: 7,
    borderRadius: 11,
  },
});
