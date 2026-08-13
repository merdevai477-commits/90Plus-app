import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { with365ImageSize } from '../../utils/scores365AthletePhoto';

interface CachedAthletePhotoProps {
  uri?: string | null;
  size?: number;
  recyclingKey?: string | number;
  onPress?: () => void;
}

export default function CachedAthletePhoto({
  uri,
  size = 40,
  recyclingKey,
  onPress,
}: CachedAthletePhotoProps) {
  const [failed, setFailed] = useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [uri]);
  const displayUri = uri
    ? with365ImageSize(uri, size <= 48 ? 64 : size <= 96 ? 80 : 128) ?? uri
    : undefined;
  const showImage = !!displayUri && !failed;

  const inner = (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        !showImage && styles.fallback,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: displayUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={String(recyclingKey ?? displayUri)}
          transition={0}
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.45)} color={Colors.purpleSoft} />
      )}
    </View>
  );

  if (onPress && showImage) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="imagebutton">
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.white08,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: Colors.purpleMuted,
  },
});
