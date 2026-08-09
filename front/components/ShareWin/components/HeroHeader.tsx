/**
 * Share & Win hero — Figma node 119:625.
 * "شارك" in purple + " واربح" in white, subtitle, then "كل مشاركة = نقاط XP"
 * where both value words carry the #9E78F7 → #460BCB gradient.
 */

import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { useTranslation } from '../../../src/i18n';
import { SW_GRADIENT, useShareWinStyles } from '../styles';
import GradientText from './GradientText';

const HeroHeader = memo(function HeroHeader() {
  const { sw } = useShareWinStyles();
  const { t } = useTranslation();
  const copy = t.shareWin;

  return (
    <View style={sw.heroWrap}>
      <Text style={sw.heroTitle} accessibilityRole="header">
        <Text style={sw.heroTitleAccent}>{copy.titleHighlight}</Text>
        <Text>{copy.titleRest}</Text>
      </Text>

      <View style={sw.heroSubtitleGroup}>
        <Text style={sw.heroSubtitle}>{copy.subtitle}</Text>

        <View style={sw.heroPerShareRow}>
          <Text style={sw.heroPerShareLead}>{copy.perShareLead}</Text>
          <GradientText
            colors={SW_GRADIENT.heroXp}
            horizontal
            style={sw.heroPerShareValue}
          >
            {copy.perSharePoints}
          </GradientText>
          <Text style={sw.heroPerShareLead}>{' '}</Text>
          <GradientText
            colors={SW_GRADIENT.heroXp}
            horizontal
            style={sw.heroPerShareValue}
          >
            {copy.perShareXp}
          </GradientText>
        </View>
      </View>
    </View>
  );
});

export default HeroHeader;
