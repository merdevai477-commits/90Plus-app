/**
 * Tries a background-removed 365Scores cutout first, then falls back to the
 * regular headshot so lineup cards can look like floating “character” photos.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  scores365AthleteCutoutCandidates,
  scores365AthleteImageVersionFromUrl,
  isScores365ImageUrl,
} from '../../utils/scores365AthletePhoto';

type AthleteCutoutImageProps = {
  athleteId?: number | null;
  photo?: string | null;
  width: number;
  height: number;
  /** Soft plate behind the cutout (Figma lavender). */
  plateColor?: string;
  fallbackIconColor?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: 'contain' | 'cover';
  recyclingKey?: string | number;
};

export function AthleteCutoutImage({
  athleteId,
  photo,
  width,
  height,
  plateColor = '#F3EDFF',
  fallbackIconColor = '#8B5CF6',
  style,
  imageStyle,
  contentFit = 'contain',
  recyclingKey,
}: AthleteCutoutImageProps) {
  const candidates = useMemo(() => {
    const id = athleteId && athleteId > 0 ? athleteId : 0;
    const version = scores365AthleteImageVersionFromUrl(photo);
    const size = Math.max(160, Math.round(Math.max(width, height) * 2));
    const list: string[] = [];
    // Always try the 365 cutout by id first — background removal only works there.
    if (id > 0) {
      list.push(...scores365AthleteCutoutCandidates(id, photo, size, version));
    } else if (isScores365ImageUrl(photo)) {
      list.push(...scores365AthleteCutoutCandidates(0, photo, size, version));
    }
    if (photo?.trim()) list.push(photo.trim());
    return [...new Set(list.filter(Boolean))];
  }, [athleteId, photo, width, height]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [candidates.join('|')]);

  const uri = candidates[index];
  const showImage = Boolean(uri);

  return (
    <View style={[{ width, height, backgroundColor: plateColor }, styles.plate, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={[styles.image, imageStyle]}
          contentFit={contentFit}
          contentPosition="bottom"
          cachePolicy="memory-disk"
          recyclingKey={String(recyclingKey ?? uri)}
          transition={0}
          onError={() => {
            if (index < candidates.length - 1) setIndex((i) => i + 1);
          }}
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="person" size={Math.round(Math.min(width, height) * 0.4)} color={fallbackIconColor} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AthleteCutoutImage;
