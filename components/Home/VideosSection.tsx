import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
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
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Best Videos</Text>
        <TouchableOpacity onPress={onViewAllPress}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonLoader width={160} height={140} style={{ marginRight: 16 }} />
          <SkeletonLoader width={160} height={140} />
        </View>
      ) : (
        <FlatList
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
          contentContainerStyle={styles.horizontalList}
          scrollEnabled={true}
        />
      )}
    </View>
  );
};