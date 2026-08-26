/**
 * Daily remaining-matches progress card — Figma 477:2766.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { usePGFonts } from './theme';

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
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const predicted = Math.max(0, total - remaining);
  const pct = total > 0 ? Math.min(1, predicted / total) : 0;

  return (
    <LinearGradient
      colors={['#0C051A', '#07040D']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.card}
    >
      <View style={[styles.top, row]}>
        <Text style={[styles.num, { fontFamily: bold }]}>{remaining}</Text>
        <View style={[styles.meta, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.labelRow, row]}>
            <Text
              style={[
                styles.frac,
                { fontFamily: medium, writingDirection: direction },
              ]}
            >
              {total}/{predicted}
            </Text>
            <Text
              style={[
                styles.label,
                { fontFamily: medium, writingDirection: direction },
              ]}
            >
              {cup.remainingToday}
            </Text>
          </View>
          <View style={styles.track}>
            <LinearGradient
              colors={['#5F00B9', '#2B0053']}
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
  top: { alignItems: 'center', gap: 12 },
  num: {
    color: '#fff',
    fontSize: 43,
    lineHeight: 48,
    minWidth: 48,
    textAlign: 'center',
  },
  meta: { flex: 1, gap: 12 },
  labelRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  label: { color: '#fff', fontSize: 15 },
  frac: { color: '#979797', fontSize: 13 },
  track: {
    width: '100%',
    maxWidth: 254,
    height: 7,
    borderRadius: 11,
    backgroundColor: '#202020',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 11,
  },
});
