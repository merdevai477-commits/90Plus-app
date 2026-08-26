import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { with365ImageSize } from '../../utils/scores365AthletePhoto';

interface TeamBadgeProps {
  name: string;
  color?: string;
  size?: number;
  logo?: string;
  /** Prefer sharper CDN assets for hero / modal crests. */
  highQuality?: boolean;
}

export default function TeamBadge({
  name,
  color = '#1a1a2e',
  size = 50,
  logo,
  highQuality = false,
}: TeamBadgeProps) {
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Reset error state when the logo URL changes (FlashList recycling).
  React.useEffect(() => {
    setImageError(false);
    setLoaded(false);
  }, [logo]);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  const shouldShowLogo = Boolean(logo && !imageError && logo.trim() !== '');
  const isTransparent = color === 'transparent';
  const cdnSize = highQuality
    ? Math.max(256, Math.round(size * 4))
    : size <= 40
      ? 128
      : size <= 64
        ? 192
        : 256;
  const sizedLogo = shouldShowLogo
    ? with365ImageSize(logo, cdnSize) ?? logo
    : undefined;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: isTransparent ? 0 : size / 2,
          backgroundColor:
            shouldShowLogo && !isTransparent ? 'rgba(255,255,255,0.05)' : color,
          borderWidth: isTransparent ? 0 : 2,
        },
      ]}
    >
      {shouldShowLogo ? (
        <Image
          source={{ uri: sizedLogo }}
          style={[
            styles.logo,
            {
              width: size * (isTransparent ? 1 : 0.95),
              height: size * (isTransparent ? 1 : 0.95),
              opacity: loaded ? 1 : 0.35,
            },
          ]}
          contentFit="contain"
          transition={180}
          cachePolicy="memory-disk"
          recyclingKey={sizedLogo}
          priority={highQuality ? 'high' : 'normal'}
          onLoad={() => setLoaded(true)}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.3 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  logo: {
    borderRadius: 0,
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
