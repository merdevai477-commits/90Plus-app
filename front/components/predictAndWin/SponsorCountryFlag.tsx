import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SponsorInfo } from '../../services/competitions.service';
import {
  getSponsorCountryFlagEmoji,
  getSponsorCountryFlagUri,
  resolveSponsorCountryIso,
} from '../../utils/sponsorCountry';

export function SponsorCountryFlag({
  sponsor,
  size = 14,
}: {
  sponsor: Pick<SponsorInfo, 'address' | 'socialLinks'>;
  size?: number;
}) {
  const iso = useMemo(() => resolveSponsorCountryIso(sponsor), [sponsor]);
  const uri = useMemo(
    () => getSponsorCountryFlagUri(sponsor, 40),
    [sponsor],
  );
  const emoji = useMemo(() => getSponsorCountryFlagEmoji(sponsor), [sponsor]);

  if (!iso) return null;

  const height = Math.max(8, Math.round(size * 0.72));

  return (
    <View
      style={[styles.wrap, { width: size, height }]}
      accessibilityRole="image"
      accessibilityLabel={iso === 'ps' ? 'Palestine' : iso}
    >
      {emoji ? (
        <Text style={[styles.emoji, { fontSize: height }]}>{emoji}</Text>
      ) : null}
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 2,
    overflow: 'hidden',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emoji: {
    textAlign: 'center',
  },
});
