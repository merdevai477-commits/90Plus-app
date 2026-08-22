/**
 * Daily remaining-matches progress card.
 */

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { PG, PG_RADII, usePGFonts } from './theme';

export function DailyProgressCard({
  isRTL,
  remaining,
  total,
}: {
  isRTL: boolean;
  remaining: number;
  total: number;
}) {
  const { extra, medium } = usePGFonts();
  const { t } = useTranslation();
  const cup = t.predictionGroups.cup;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const predicted = Math.max(0, total - remaining);
  const pct = total > 0 ? predicted / total : 0;

  return (
    <View style={styles.card}>
      <View style={[styles.top, row]}>
        <View style={[styles.labelRow, row]}>
          <Text style={[styles.num, { fontFamily: extra }]}>{remaining}</Text>
          <Text style={[styles.label, { fontFamily: medium }]}>{cup.remainingToday}</Text>
        </View>
        <Text style={[styles.frac, { fontFamily: extra }]}>
          {predicted}/{total}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(pct * 100)}%`, alignSelf: isRTL ? 'flex-end' : 'flex-start' },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.border,
    gap: 10,
  },
  top: { alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { alignItems: 'center', gap: 8 },
  num: { color: PG.text, fontSize: 28, lineHeight: 32 },
  label: { color: PG.text, fontSize: 14 },
  frac: { color: PG.textSecondary, fontSize: 13 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PG.primary,
  },
});
