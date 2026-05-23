/**
 * QuizQuestionMedia — Dynamic image slot (square vs wide) for API photos.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTranslation } from '../../src/i18n';
import {
  ACCENT_SOFT,
  QUIZ_CARD_BORDER,
  QUIZ_MEDIA_SQUARE,
  QUIZ_MEDIA_WIDE_RATIO,
  type QuizImageLayout,
} from './quiz.constants';

interface QuizQuestionMediaProps {
  imageUrl?: string | null;
  layout?: QuizImageLayout;
}

export function QuizQuestionMedia({
  imageUrl,
  layout = 'square',
}: QuizQuestionMediaProps) {
  const { t } = useTranslation();
  const [loadFailed, setLoadFailed] = useState(false);
  const isWide = layout === 'wide';

  useEffect(() => {
    setLoadFailed(false);
  }, [imageUrl]);

  const uri = imageUrl?.trim();
  const showImage = Boolean(uri) && !loadFailed;

  return (
    <View
      style={[styles.slot, isWide ? styles.slotWide : styles.slotSquare]}
      accessibilityLabel={
        showImage ? t.quiz.questionImage : t.quiz.questionImagePlaceholder
      }
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          transition={200}
          onError={() => {
            if (__DEV__) console.warn('[Quiz] image failed:', uri);
            setLoadFailed(true);
          }}
        />
      ) : (
        <View style={styles.placeholder}>
          <View style={[styles.iconRing, isWide && styles.iconRingWide]}>
            <Ionicons
              name={isWide ? 'football' : 'trophy'}
              size={isWide ? 40 : 44}
              color={ACCENT_SOFT}
            />
          </View>
        </View>
      )}

      {!showImage ? (
        <LinearGradient
          colors={['rgba(124, 58, 237, 0.18)', 'rgba(20, 14, 40, 0.98)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: QUIZ_CARD_BORDER,
    backgroundColor: '#120E24',
  },
  slotSquare: {
    width: QUIZ_MEDIA_SQUARE,
    height: QUIZ_MEDIA_SQUARE,
    alignSelf: 'center',
  },
  slotWide: {
    width: '100%',
    aspectRatio: QUIZ_MEDIA_WIDE_RATIO,
    maxHeight: 168,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  iconRingWide: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});
