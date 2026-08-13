import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { with365ImageSize } from '../../utils/scores365AthletePhoto';

interface TeamBadgeProps {
  name: string;
  color?: string;
  size?: number;
  logo?: string;
}

export default function TeamBadge({ 
  name, 
  color = '#1a1a2e',
  size = 50,
  logo
}: TeamBadgeProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when the logo URL changes (FlashList recycling).
  React.useEffect(() => {
    setImageError(false);
  }, [logo]);
  
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  // Show logo if available and no error
  const shouldShowLogo = logo && !imageError && logo.trim() !== '';
  const isTransparent = color === 'transparent';
  const sizedLogo = shouldShowLogo
    ? with365ImageSize(logo, size <= 48 ? 64 : 128) ?? logo
    : undefined;

  return (
    <View style={[
      styles.container, 
      { 
        width: size, 
        height: size,
        borderRadius: size / 2,
        backgroundColor: shouldShowLogo && !isTransparent ? 'rgba(255,255,255,0.05)' : color,
        borderWidth: isTransparent ? 0 : 2,
      }
    ]}>
      {shouldShowLogo ? (
        <Image
          source={{ uri: sizedLogo }}
          style={[styles.logo, { width: size * 0.95, height: size * 0.95 }]}
          contentFit="contain"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={sizedLogo}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.3 }]}>
          {initials}
        </Text>
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
  },
  logo: {
    borderRadius: 0,
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

