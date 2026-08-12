/**
 * =============================================================================
 * QUESTIONS HUB — SINGLE STAT (label over value)
 * =============================================================================
 *
 * One column inside the stats strip. Figma "Frame 25/26/27" — a 12pt label
 * above a 22pt value, 4pt apart.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   LABEL TYPE / COLOUR ... ../styles.ts → hub.summaryLabel
 *                           (colour token: HUB_COLOR.textStatLabel)
 *   VALUE TYPE / COLOUR ... ../styles.ts → hub.summaryValue
 *                           (colour token: HUB_COLOR.textStatValue)
 *   NARROW VARIANTS ....... ../styles.ts → summaryLabelCompact /
 *                           summaryValueCompact
 *   WHICH STATS SHOW ...... ../data.ts → buildSummaryStats()
 * =============================================================================
 */

import React, { memo } from 'react';
import { Text, View } from 'react-native';

import type { Stat } from '../data';
import { useQuestionsHubStyles } from '../styles';

function StatItem({ stat, isCompact }: { stat: Stat; isCompact: boolean }) {
  const { hub } = useQuestionsHubStyles();

  return (
    <View style={hub.summaryBlock}>
      <Text
        style={[hub.summaryLabel, isCompact && hub.summaryLabelCompact]}
        numberOfLines={2}
      >
        {isCompact ? stat.compactLabel ?? stat.label : stat.label}
      </Text>
      <Text
        style={[hub.summaryValue, isCompact && hub.summaryValueCompact]}
        numberOfLines={1}
      >
        {stat.value}
      </Text>
    </View>
  );
}

export default memo(StatItem);
