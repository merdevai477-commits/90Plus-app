import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';

import { useDesignScale } from '../../../../utils/responsive';
import { getAppFont } from '../../../../utils/fontSetup';

/**
 * Level hexagon badge — real SVG polygon (not a box with borderRadius) with a
 * purple gradient stroke, and "Level" / number rendered as gradient-masked
 * text (RN equivalent of CSS background-clip: text).
 *
 * Gradient: linear-gradient(205deg, #DECFFF 19.21%, #3709A0 85.51%, #1A054B 150.83%)
 */
const LEVEL_TEXT_GRADIENT = ['#DECFFF', '#3709A0', '#1A054B'] as const;
const LEVEL_TEXT_GRADIENT_LOCATIONS = [0.1921, 0.8551, 1] as const;

// CSS 205deg direction vector, normalized to the unit box used by expo-linear-gradient.
const LEVEL_TEXT_GRADIENT_START = { x: 0.85, y: 0.05 };
const LEVEL_TEXT_GRADIENT_END = { x: 0.15, y: 0.95 };

const HEX_POINTS = '50,4 92,27 92,73 50,96 8,73 8,27';

function GradientText({ style, children }: { style: object; children: string }) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient
        colors={LEVEL_TEXT_GRADIENT}
        locations={LEVEL_TEXT_GRADIENT_LOCATIONS}
        start={LEVEL_TEXT_GRADIENT_START}
        end={LEVEL_TEXT_GRADIENT_END}
      >
        <Text style={[style, styles.hiddenText]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * Badge size in RAW FIGMA UNITS (node 18:71 — Group 3, 49 × 49).
 * CUSTOMIZE: change these two numbers to resize the hexagon; the SVG uses a
 * 0–100 viewBox so it rescales cleanly.
 */
const BADGE_SIZE = 49;
const BADGE_SIZE_COMPACT = 42;

function QuizLevelBadge({ level, isCompact = false }: { level: number; isCompact?: boolean }) {
  const { s } = useDesignScale();
  const size = s(isCompact ? BADGE_SIZE_COMPACT : BADGE_SIZE);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="quizLevelHexStroke" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#DECFFF" />
            <Stop offset="0.5" stopColor="#8351F5" />
            <Stop offset="1" stopColor="#3709A0" />
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={HEX_POINTS}
          fill="#0A0213"
          stroke="url(#quizLevelHexStroke)"
          strokeWidth={3}
        />
      </Svg>

      <GradientText style={[styles.levelLabel, isCompact && styles.levelLabelCompact]}>
        Level
      </GradientText>
      <GradientText style={[styles.levelNumber, isCompact && styles.levelNumberCompact]}>
        {String(level)}
      </GradientText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenText: {
    opacity: 0,
  },
  // CUSTOMIZE: "Level" caption above the number.
  levelLabel: {
    fontFamily: getAppFont(600),
    fontSize: 9,
    textAlign: 'right',
    marginBottom: 2,
  },
  levelLabelCompact: {
    fontSize: 8,
  },
  // CUSTOMIZE: the level number itself.
  levelNumber: {
    fontFamily: getAppFont(600),
    fontSize: 18,
    height: 22,
    alignSelf: 'stretch',
    textAlign: 'center',
    lineHeight: 22,
  },
  levelNumberCompact: {
    fontSize: 15,
    height: 18,
    lineHeight: 18,
  },
});

export default memo(QuizLevelBadge);
