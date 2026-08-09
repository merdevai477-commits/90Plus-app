/**
 * =============================================================================
 * QUESTIONS HUB — SECTION HEADING
 * =============================================================================
 *
 * "Choose Challenge Type" / "اختر نوع التحدي" plus the short vertical rule to
 * its trailing side. Figma "Frame 6" (142 × 37 @ x 282, y 365) in node 1:2.
 *
 * ── WHAT YOU CAN CHANGE HERE ─────────────────────────────────────────────────
 *   HEADING TEXT ......... ../data.ts → getQuestionsHubCopy().sectionTitle
 *   FONT SIZE / WEIGHT ... ../styles.ts → hub.sectionTitle
 *   RULE SIZE / COLOUR ... ../styles.ts → hub.sectionRule
 *   ALIGNMENT / MARGINS .. ../styles.ts → hub.sectionHead
 *   LOADING SHIMMER ...... renders an ActivityIndicator while `loading`
 * =============================================================================
 */

import React, { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { HUB_COLOR, useQuestionsHubStyles } from '../styles';
import { SECTION_RULE_GRADIENT } from '../../gameChrome';

function SectionHeader({
  title,
  isRtl,
  loading,
}: {
  title: string;
  isRtl: boolean;
  /** True while the modes list is being refreshed from the API. */
  loading?: boolean;
}) {
  const { hub } = useQuestionsHubStyles();

  return (
    <View style={hub.sectionHead}>
      {loading ? (
        <ActivityIndicator size="small" color={HUB_COLOR.textStatValue} />
      ) : null}
      <Text
        style={[hub.sectionTitle, isRtl && hub.sectionTitleRtl]}
        numberOfLines={1}
        // Lets the heading shrink instead of clipping on very narrow phones.
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {title}
      </Text>
      <LinearGradient
        colors={[...SECTION_RULE_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={hub.sectionRule}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}

export default memo(SectionHeader);
