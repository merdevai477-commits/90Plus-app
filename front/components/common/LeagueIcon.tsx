import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { leagueLogoUrl } from '../../utils/playerStatsAggregate';

interface LeagueIconProps {
  name: string;
  size?: number;
  color?: string;
  logo?: string;
  leagueId?: number;
}

export default function LeagueIcon({ 
  name, 
  size = 40,
  color = '#FFD700',
  logo,
  leagueId,
}: LeagueIconProps) {
  const [imageError, setImageError] = useState(false);
  const [uriIndex, setUriIndex] = useState(0);

  const candidates = useMemo(() => {
    const resolved = leagueId != null ? leagueLogoUrl(leagueId, logo) : (logo?.trim() ?? '');
    const urls: string[] = [];
    if (resolved) urls.push(resolved);
    if (leagueId != null && leagueId > 0) {
      urls.push(`https://media.api-sports.io/football/leagues/${leagueId}.png`);
    }
    return [...new Set(urls)];
  }, [leagueId, logo]);

  const uri = candidates[uriIndex] ?? '';
  const shouldShowLogo = uri && !imageError && uriIndex < candidates.length;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {shouldShowLogo ? (
        <Image
          source={{ uri }}
          style={{ width: size * 0.72, height: size * 0.72 }}
          contentFit="contain"
          transition={200}
          cachePolicy="memory-disk"
          priority="high"
          onError={() => {
            if (uriIndex + 1 < candidates.length) {
              setUriIndex((i) => i + 1);
            } else {
              setImageError(true);
            }
          }}
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
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});

