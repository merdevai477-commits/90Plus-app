/**
 * WebVideo Component
 * Placeholder for web video player
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface WebVideoPlayerProps {
  source?: { uri: string };
  style?: any;
  [key: string]: any;
}

const WebVideoPlayer: React.FC<WebVideoPlayerProps> = ({ source, style, ...props }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Video Player (Web)</Text>
      {source?.uri && <Text style={styles.uri}>{source.uri}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
  uri: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
});

export default WebVideoPlayer;