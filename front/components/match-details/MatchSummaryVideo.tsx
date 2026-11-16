import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { HighlightVideoSheet } from './HighlightVideoSheet';

const PLAY_ICON = require('../../assets/images/match-events/summary-play.svg');

type Props = {
  thumbnail?: string | null;
  url?: string | null;
  playLabel: string;
};

/** Replaces the momentum card when a full-match recap video exists. */
export function MatchSummaryVideo({ thumbnail, url, playLabel }: Props) {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 32, 420);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playLabel}
        disabled={!url}
        onPress={() => {
          if (url) setOpen(true);
        }}
        style={[styles.card, { width: cardW }]}
      >
        {thumbnail ? (
          <ExpoImage source={{ uri: thumbnail }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.fallback]} />
        )}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} style={styles.shade} />
        <ExpoImage source={PLAY_ICON} style={styles.play} contentFit="contain" />
      </Pressable>
      {url ? (
        <HighlightVideoSheet visible={open} url={url} onClose={() => setOpen(false)} closeLabel={playLabel} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 14,
    height: 168,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  fallback: {
    backgroundColor: '#111111',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
  },
  play: {
    width: 42,
    height: 42,
  },
});
