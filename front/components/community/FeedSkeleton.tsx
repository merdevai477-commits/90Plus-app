import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { postCardStyles } from './PostCard';
import { SkeletonBlock } from './Shimmer';
import { AVATAR_SIZE, POST_IMAGE_RADIUS } from './theme';

function SkeletonCard({ isAr, withImage, imageHeight }: { isAr: boolean; withImage: boolean; imageHeight: number }) {
  const row = isAr ? 'row-reverse' : 'row';
  const align = isAr ? 'flex-end' : 'flex-start';
  return (
    <View style={postCardStyles.card}>
      <View style={[styles.header, { flexDirection: row }]}>
        <SkeletonBlock style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }} />
        <View style={{ flex: 1, gap: 8, alignItems: align }}>
          <SkeletonBlock style={{ width: '45%', height: 14, borderRadius: 7 }} />
          <SkeletonBlock style={{ width: '25%', height: 11, borderRadius: 6 }} />
        </View>
      </View>
      <View style={{ gap: 8, alignItems: align }}>
        <SkeletonBlock style={{ width: '92%', height: 13, borderRadius: 7 }} />
        <SkeletonBlock style={{ width: '70%', height: 13, borderRadius: 7 }} />
      </View>
      {withImage && <SkeletonBlock style={{ width: '100%', height: imageHeight, borderRadius: POST_IMAGE_RADIUS }} />}
      <View style={[styles.actions, { flexDirection: row }]}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ width: 52, height: 20, borderRadius: 10 }} />
        ))}
      </View>
    </View>
  );
}

export const FeedSkeleton = memo(function FeedSkeleton({ isAr, imageHeight }: { isAr: boolean; imageHeight: number }) {
  return (
    <View style={styles.list}>
      <SkeletonCard isAr={isAr} withImage imageHeight={imageHeight} />
      <SkeletonCard isAr={isAr} withImage={false} imageHeight={imageHeight} />
      <SkeletonCard isAr={isAr} withImage imageHeight={imageHeight} />
    </View>
  );
});

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  header: {
    alignItems: 'center',
    gap: 11,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 7,
  },
});
