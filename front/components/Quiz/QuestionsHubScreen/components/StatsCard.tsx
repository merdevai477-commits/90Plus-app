/**
 * =============================================================================
 * QUESTIONS HUB — STATS STRIP SHELL
 * =============================================================================
 *
 * The rounded container at the bottom of the hub holding the level badge, XP,
 * answered count and total-XP figures. Figma "Frame 29" (404 × 85 @ 22, 1087).
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   HEIGHT / RADIUS / PADDING ... ../styles.ts → hub.summaryStrip
 *   FILL + BORDER COLOUR ........ ../styles.ts → HUB_COLOR.statsBg /
 *                                 HUB_COLOR.statsBorder
 *   NARROW-PHONE VARIANT ........ ../styles.ts → hub.summaryStripCompact
 *                                 (triggered under 360pt — see ../data.ts →
 *                                 getQuestionsHubLayout().isCompact)
 *   CONTENTS .................... ./BottomNavigation.tsx
 * =============================================================================
 */

import React, { memo, type ReactNode } from 'react';
import { View } from 'react-native';

import { useQuestionsHubStyles } from '../styles';

function StatsCard({ isCompact, children }: { isCompact: boolean; children: ReactNode }) {
  const { hub } = useQuestionsHubStyles();

  return (
    <View style={[hub.summaryStrip, isCompact && hub.summaryStripCompact]}>
      {children}
    </View>
  );
}

export default memo(StatsCard);
