/**
 * "أضف جائزتك" 4-step progress header — Figma `Group 61` + labels
 * (`690:1366` step 1, `695:1760` step 2, `695:1868` step 3, `696:2207` step 4).
 *
 * Circles 36.9×38, radius 31, border 2 — active #3f0a71 / #4a0987 with Bold 16
 * white, idle #1b1521 / #32283b with Medium 16 #626262. Rails are 5 tall,
 * #2d2936, overlaid by a #4a0987 → #871aef fill: full for completed legs and
 * ~63% for the leg leaving the current step. Labels are Bold 10, #7d16df once
 * reached, otherwise #626262.
 *
 * Figma positions the circles at x 32.65 / 148.22 / 263.79 / 379.36 (even
 * 115.57 spacing). That is reproduced with `space-between` inside a 32.65
 * margin, and the rails are flexed between the circles — Figma's own rails
 * overshoot the following circle by 5–11px, which is a source artefact rather
 * than intent.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { PW, PW_GRADIENTS, usePWFonts, usePWScale } from './theme';

const STEP_KEYS = ['step1Title', 'step2Title', 'step3Title', 'step4Title'] as const;

/** Figma fills the outgoing rail of the current step to ~63%. */
const CURRENT_RAIL_FILL = 0.63;

export function PredictionStepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const { s, f } = usePWScale();
  const { bold, medium } = usePWFonts();
  const { t } = useTranslation();
  const wizard = t.predictAndWin.wizard;

  const circle = s(36.9);

  return (
    <View style={{ marginHorizontal: s(32.65) }}>
      <View style={styles.row}>
        {[1, 2, 3, 4].map((n) => {
          const reached = n <= step;
          const railFill = n < step ? 1 : n === step ? CURRENT_RAIL_FILL : 0;

          return (
            <React.Fragment key={n}>
              <View
                style={{
                  width: circle,
                  height: s(38),
                  borderRadius: s(31),
                  borderWidth: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: reached ? PW.stepActiveBg : PW.stepIdleBg,
                  borderColor: reached ? PW.stepActiveBorder : PW.stepIdleBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: reached ? bold : medium,
                    fontSize: f(16),
                    color: reached ? PW.text : PW.stepIdleText,
                  }}
                >
                  {n}
                </Text>
              </View>

              {n < 4 ? (
                <View style={{ flex: 1, height: s(5), backgroundColor: PW.railIdle }}>
                  {railFill > 0 ? (
                    <LinearGradient
                      colors={[...PW_GRADIENTS.rail]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        height: '100%',
                        width: `${railFill * 100}%`,
                        borderTopRightRadius: railFill < 1 ? s(9) : 0,
                        borderBottomRightRadius: railFill < 1 ? s(9) : 0,
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View style={[styles.row, { marginTop: s(19) }]}>
        {STEP_KEYS.map((key, i) => (
          <Text
            key={key}
            style={{
              flex: 1,
              fontFamily: bold,
              fontSize: f(10),
              lineHeight: f(10) * 1.268,
              color: i + 1 <= step ? PW.stepLabelActive : PW.stepIdleText,
              textAlign: i === 0 ? 'left' : i === 3 ? 'right' : 'center',
            }}
            numberOfLines={1}
          >
            {wizard[key]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
