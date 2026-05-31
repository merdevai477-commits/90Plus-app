/**
 * QuizQuestionMedia — Dynamic image slot (square vs wide) for API photos.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import {
  QUIZ_MEDIA_SQUARE,
  QUIZ_MEDIA_WIDE_RATIO,
  type QuizImageLayout,
} from './quiz.constants';

interface QuizQuestionMediaProps {
  imageUrl?: string | null;
  layout?: QuizImageLayout;
  onLoadFailed?: () => void;
  priority?: 'low' | 'normal' | 'high';
}

function MediaSkeleton({ isWide }: { isWide: boolean }) {
  return (
    <View style={[styles.skeleton, isWide ? styles.imageWide : styles.imageSquare]}>
      <Ionicons name="image-outline" size={32} color="rgba(192,132,252,0.35)" />
    </View>
  );
}

function QuizQuestionMediaInner({
  imageUrl,
  layout = 'square',
  onLoadFailed,
  priority = 'high',
}: QuizQuestionMediaProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isWide = layout === 'wide';

  useEffect(() => {
    setLoadFailed(false);
    setLoaded(false);
  }, [imageUrl]);

  const uri = imageUrl?.trim();
  if (!uri) {
    return null;
  }

  if (loadFailed) {
    return (
      <View style={[styles.fallback, isWide ? styles.imageWide : styles.imageSquare]}>
        <Ionicons name="football-outline" size={36} color="rgba(192,132,252,0.5)" />
      </View>
    );
  }

  return (
    <View style={isWide ? styles.imageWide : styles.imageSquare}>
      {!loaded ? <MediaSkeleton isWide={isWide} /> : null}
      <Image
        source={{ uri }}
        style={[
          styles.image,
          isWide ? styles.imageWide : styles.imageSquare,
          !loaded && styles.imageHidden,
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        priority={priority}
        transition={100}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (__DEV__) {
            console.warn('[Quiz] image failed:', uri);
          }
          setLoadFailed(true);
          onLoadFailed?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageHidden: {
    position: 'absolute',
    opacity: 0,
  },
  imageSquare: {
    width: QUIZ_MEDIA_SQUARE,
    height: QUIZ_MEDIA_SQUARE,
    alignSelf: 'center',
  },
  imageWide: {
    width: '100%',
    aspectRatio: QUIZ_MEDIA_WIDE_RATIO,
    maxHeight: 168,
  },
  skeleton: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fallback: {
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
});

export const QuizQuestionMedia = React.memo(QuizQuestionMediaInner);
