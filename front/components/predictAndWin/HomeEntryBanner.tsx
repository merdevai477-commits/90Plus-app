/**
 * Home entry point into the "توقع واربح" hub.
 *
 * Not a Figma frame — the hub is a stack route with no bottom-tab slot, so it
 * needs a launcher on Home. Styling is composed from the feature's own tokens
 * (FAB gradient, tile surface) so it reads as part of the same system.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { IconGiftFill } from './icons';
import { PW, PW_GRADIENTS, PW_RADII, usePWFonts, usePWScale } from './theme';

export function PredictAndWinHomeBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const { s, f } = usePWScale();
  const { semibold, regular } = usePWFonts();

  return (
    <Pressable
      onPress={() => router.push('/predict-and-win')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.wrapper, { opacity: pressed ? 0.93 : 1 }]}
    >
      <LinearGradient
        colors={[...PW_GRADIENTS.fab]}
        locations={[...PW_GRADIENTS.fabLocations]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.banner, { borderRadius: s(PW_RADII.cell), padding: s(14), gap: s(12) }]}
      >
        <View
          style={{
            width: s(46),
            height: s(46),
            borderRadius: s(23),
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconGiftFill width={s(26)} height={s(26)} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: semibold, fontSize: f(16), color: PW.text }}>
            {t.predictAndWin.title}
          </Text>
          <Text
            style={{
              fontFamily: regular,
              fontSize: f(11),
              color: 'rgba(255,255,255,0.78)',
              marginTop: s(2),
            }}
            numberOfLines={1}
          >
            {t.predictAndWin.tiles.daily.subtitle}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16 },
  banner: { flexDirection: 'row', alignItems: 'center' },
});
