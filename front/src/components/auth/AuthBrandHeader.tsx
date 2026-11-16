import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthScale } from './authLayoutMetrics';
import { useAuthTheme } from './useAuthTheme';
import { useTranslation } from '@/src/i18n';

type Props = {
  /** Override tagline lines; defaults to welcome-back copy for login. */
  titleLines?: [string, string];
  tagline?: string;
};

/**
 * Purple branded header from Figma Login / Sign Up.
 * Soft purple spotlight + orbit are View ellipses (Figma 1604:5448 / 1604:5449)
 * so they render on Android without depending on SVG image assets.
 */
export function AuthBrandHeader({ titleLines, tagline }: Props) {
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const { s, f } = useAuthScale();
  const { colors } = useAuthTheme();

  const lines: [string, string] = titleLines ??
    (isRTL
      ? ['مرحباً بعودتك إلى', '90Plus.']
      : ['Welcome back to', '90Plus.']);
  const sub =
    tagline ?? (isRTL ? 'توقَّع • شارك • اربح' : 'Predict  •  Play  •  Win');

  return (
    <LinearGradient
      colors={[...colors.headerGradient]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.root, { height: s(232) }]}
    >
      {/* Brand orbit — large soft circle (Figma Brand orbit) */}
      <View
        pointerEvents="none"
        style={[
          styles.decor,
          {
            width: s(420),
            height: s(330),
            borderRadius: s(210),
            left: s(-228),
            top: s(-175),
            backgroundColor: 'rgba(168, 85, 247, 0.28)',
          },
        ]}
      />
      {/* Soft purple spotlight (Figma 1604:5448) */}
      <View
        pointerEvents="none"
        style={[
          styles.decor,
          {
            width: s(223),
            height: s(214),
            borderRadius: s(112),
            left: s(-40),
            top: s(36),
            backgroundColor: 'rgba(168, 85, 247, 0.45)',
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.decor,
          {
            width: s(140),
            height: s(140),
            borderRadius: s(70),
            left: s(24),
            top: s(88),
            backgroundColor: 'rgba(233, 213, 255, 0.18)',
          },
        ]}
      />

      <View
        style={[
          styles.messaging,
          isRTL ? styles.messagingRtl : styles.messagingLtr,
          {
            top: s(58),
            width: s(220),
            gap: s(16),
            ...(isRTL ? { right: s(28) } : { left: s(28) }),
          },
        ]}
      >
        <Text
          style={[
            styles.brand,
            {
              fontSize: f(22),
              lineHeight: f(30),
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        >
          90PLUS
        </Text>

        <View
          style={[
            styles.taglineRow,
            { gap: s(12) },
            isRTL ? null : styles.taglineRowLtr,
          ]}
        >
          {isRTL ? (
            <>
              <View style={[styles.taglineCopy, { width: s(189), gap: s(12) }]}>
                <View style={{ gap: s(4) }}>
                  {lines.map((line) => (
                    <Text
                      key={line}
                      style={[
                        styles.titleLine,
                        {
                          fontSize: f(22),
                          lineHeight: f(30),
                          textAlign: 'right',
                        },
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
                <Text
                  style={[
                    styles.sub,
                    {
                      color: colors.headerTagline,
                      fontSize: f(13),
                      lineHeight: f(18),
                      textAlign: 'right',
                    },
                  ]}
                >
                  {sub}
                </Text>
              </View>
              <View
                style={[
                  styles.gold,
                  {
                    backgroundColor: colors.goldAccent,
                    width: s(3),
                    height: s(37),
                    borderRadius: s(2),
                  },
                ]}
              />
            </>
          ) : (
            <>
              <View
                style={[
                  styles.gold,
                  {
                    backgroundColor: colors.goldAccent,
                    width: s(3),
                    height: s(37),
                    borderRadius: s(2),
                  },
                ]}
              />
              <View style={[styles.taglineCopy, { width: s(189), gap: s(12) }]}>
                <View style={{ gap: s(4) }}>
                  {lines.map((line) => (
                    <Text
                      key={line}
                      style={[
                        styles.titleLine,
                        {
                          fontSize: f(22),
                          lineHeight: f(30),
                          textAlign: 'left',
                        },
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
                <Text
                  style={[
                    styles.sub,
                    {
                      color: colors.headerTagline,
                      fontSize: f(13),
                      lineHeight: f(18),
                      textAlign: 'left',
                    },
                  ]}
                >
                  {sub}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute',
  },
  messaging: {
    position: 'absolute',
    zIndex: 2,
  },
  messagingRtl: {
    alignItems: 'flex-end',
  },
  messagingLtr: {
    alignItems: 'flex-start',
  },
  brand: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taglineRowLtr: {
    flexDirection: 'row',
  },
  taglineCopy: {
    alignItems: 'stretch',
  },
  titleLine: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sub: {
    fontWeight: '600',
  },
  gold: {
    flexShrink: 0,
  },
});
