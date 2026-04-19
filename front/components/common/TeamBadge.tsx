import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

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
  
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  // Show logo if available and no error
  const shouldShowLogo = logo && !imageError && logo.trim() !== '';
  const isTransparent = color === 'transparent';

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
          source={{ uri: logo }}
          style={[styles.logo, { width: size * 0.95, height: size * 0.95 }]}
          contentFit="contain"
          transition={100} // قللنا وقت الانتقال لظهور أسرع
          cachePolicy="memory-disk"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} // يمنع شعور المستخدم بتأخر التحميل
          onError={() => {
            console.log('Failed to load logo:', logo);
            setImageError(true);
          }}
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

