import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface LeagueIconProps {
  name: string;
  size?: number;
  color?: string;
  logo?: string;
}

export default function LeagueIcon({ 
  name, 
  size = 40,
  color = '#FFD700',
  logo
}: LeagueIconProps) {
  const [imageError, setImageError] = useState(false);
  
  const shouldShowLogo = logo && !imageError && logo.trim() !== '';

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {shouldShowLogo ? (
        <Image
          source={{ uri: logo }}
          style={{ width: size * 0.7, height: size * 0.7 }}
          contentFit="contain"
          transition={200}
          onError={() => setImageError(true)}
        />
      ) : (
        <MaterialCommunityIcons 
          name="soccer" 
          size={size * 0.6} 
          color={color} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});

