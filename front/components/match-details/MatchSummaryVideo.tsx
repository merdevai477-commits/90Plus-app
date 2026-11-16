import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const PLAY_ICON = require('../../assets/images/match-events/summary-play.svg');

type Props = {
  thumbnail?: string | null;
  url?: string | null;
  playLabel: string;
  onPlay?: (url: string) => void;
};

/** Replaces the momentum card when a full-match recap video exists. */
export function MatchSummaryVideo({ thumbnail, url, playLabel, onPlay }: Props) {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 32, 420);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playLabel}
      disabled={!url}
      onPress={() => {
        if (url) onPlay?.(url);
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
