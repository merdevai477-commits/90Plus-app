import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useAuthScale } from './authLayoutMetrics';
import { useAuthTheme } from './useAuthTheme';
import { AUTH_V2_ASSETS } from './authV2Assets';
import { useTranslation } from '@/src/i18n';

type Props = {
  /** Override tagline lines; defaults to welcome-back copy for login. */
  titleLines?: [string, string];
  tagline?: string;
};

/**
 * Purple branded header from Figma Login (1613:5666) / Sign Up (1604:5520).
 * Gradient + soft orbit decorations + 90PLUS + gold accent bar.
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
      <Image
        source={AUTH_V2_ASSETS.brandOrbit}
        style={[
          styles.orbit,
          {
            width: s(420),
            height: s(330),
            left: s(-228),
            top: s(-175),
          },
        ]}
        contentFit="contain"
      />
      <Image
        source={AUTH_V2_ASSETS.brandSpotlight}
        style={[
          styles.spotlight,
          {
            width: s(223),
            height: s(214),
            left: s(-98),
            top: s(43),
          },
        ]}
        contentFit="contain"
      />

      <View
        style={[
          styles.messaging,
          isRTL ? styles.messagingRtl : styles.messagingLtr,
          {
            top: s(58),
            width: s(207),
            gap: s(16),
            ...(isRTL ? { right: s(34) } : { left: s(34) }),
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
            isRTL ? styles.taglineRowRtl : null,
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
                          fontSize: f(23),
                          lineHeight: f(31),
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
                          fontSize: f(23),
                          lineHeight: f(31),
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
  orbit: {
    position: 'absolute',
    opacity: 0.85,
  },
  spotlight: {
    position: 'absolute',
    opacity: 0.9,
  },
  messaging: {
    position: 'absolute',
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
  taglineRowRtl: {
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
