/**
 * QuizQuestionMedia — Dynamic image slot (square vs wide) for API photos.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import {
  QUIZ_MEDIA_SQUARE,
  QUIZ_MEDIA_WIDE_RATIO,
  type QuizImageLayout,
} from './quiz.constants';

interface QuizQuestionMediaProps {
  imageUrl?: string | null;
  layout?: QuizImageLayout;
  onLoadFailed?: () => void;
}

export function QuizQuestionMedia({
  imageUrl,
  layout = 'square',
  onLoadFailed,
}: QuizQuestionMediaProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const isWide = layout === 'wide';

  useEffect(() => {
    setLoadFailed(false);
  }, [imageUrl]);

  const uri = imageUrl?.trim();
  if (!uri || loadFailed) {
    return null;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, isWide ? styles.imageWide : styles.imageSquare]}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      transition={200}
      onError={() => {
        if (__DEV__) {
          console.warn('[Quiz] image failed:', uri);
        }
        setLoadFailed(true);
        onLoadFailed?.();
      }}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 16,
    overflow: 'hidden',
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
});
