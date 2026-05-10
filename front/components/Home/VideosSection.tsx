import React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { VideoCard } from './VideoCard';
import { SkeletonLoader } from './SkeletonLoader';
import { Video } from './types';
import { styles } from './homeStyles'; // Updated styles import

interface VideosSectionProps {
  videos: Video[];
  isLoading: boolean;
  imageErrors: Set<string>;
  onImageError: (id: string) => void;
  onVideoPress: () => void;
  onViewAllPress: () => void;
}

export const VideosSection: React.FC<VideosSectionProps> = ({
  videos,
  isLoading,
  imageErrors,
  onImageError,
  onVideoPress,
  onViewAllPress,
}) => {
  // homeStyles exports an untyped StyleSheet; narrow the keys we use here
  const s = styles as unknown as {
    section: ViewStyle;
    sectionHeader: ViewStyle;
    sectionTitle: TextStyle;
    viewAllText: TextStyle;
    skeletonContainer: ViewStyle;
    horizontalList: ViewStyle;
  };

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Best Videos</Text>
        <TouchableOpacity onPress={onViewAllPress}>
          <Text style={s.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={s.skeletonContainer}>
          <SkeletonLoader width={160} height={140} style={{ marginRight: 16 }} />
          <SkeletonLoader width={160} height={140} />
        </View>
      ) : (
        <FlashList
          data={videos}
          renderItem={({ item }) => (
            <VideoCard
              item={item}
              onPress={onVideoPress}
              imageError={imageErrors.has(item.id)}
              onImageError={() => onImageError(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontalList}
        />
      )}
    </View>
  );
};